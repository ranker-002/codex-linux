import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { SecurityManager } from '../security/SecurityManager';
import { AuditLogger } from '../security/AuditLogger';
import log from 'electron-log';

export class APIServer {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private io: Server;
  private port: number;
  private agentOrchestrator: AgentOrchestrator;
  private securityManager: SecurityManager;
  private auditLogger: AuditLogger;

  constructor(
    agentOrchestrator: AgentOrchestrator,
    securityManager: SecurityManager,
    auditLogger: AuditLogger,
    port: number = 3001
  ) {
    this.agentOrchestrator = agentOrchestrator;
    this.securityManager = securityManager;
    this.auditLogger = auditLogger;
    this.port = port;

    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // API key authentication middleware
    this.app.use(this.authenticate.bind(this));
  }

  private async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    const publicRoutes = ['/api/health', '/api/auth/token'];
    
    if (publicRoutes.includes(req.path)) {
      return next();
    }

    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    // Validate API key
    try {
      // In real implementation, verify against stored keys
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid API key' });
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Agents API
    this.app.get('/api/agents', async (req: Request, res: Response) => {
      try {
        const agents = await this.agentOrchestrator.listAgents();
        res.json(agents);
      } catch (error) {
        log.error('Failed to list agents:', error);
        res.status(500).json({ error: 'Failed to list agents' });
      }
    });

    this.app.post('/api/agents', async (req: Request, res: Response) => {
      try {
        const agent = await this.agentOrchestrator.createAgent(req.body);
        await this.auditLogger.log('agent_created', { agentId: agent.id });
        res.status(201).json(agent);
      } catch (error) {
        log.error('Failed to create agent:', error);
        res.status(500).json({ error: 'Failed to create agent' });
      }
    });

    this.app.get('/api/agents/:id', async (req: Request, res: Response) => {
      try {
        const agent = await this.agentOrchestrator.getAgent(req.params.id);
        if (!agent) {
          res.status(404).json({ error: 'Agent not found' });
          return;
        }
        res.json(agent);
      } catch (error) {
        log.error('Failed to get agent:', error);
        res.status(500).json({ error: 'Failed to get agent' });
      }
    });

    this.app.post('/api/agents/:id/messages', async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        const response = await this.agentOrchestrator.sendMessage(req.params.id, message);
        res.json(response);
      } catch (error) {
        log.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
      }
    });

    this.app.post('/api/agents/:id/tasks', async (req: Request, res: Response) => {
      try {
        const { task } = req.body;
        const taskObj = await this.agentOrchestrator.executeTask(req.params.id, task);
        res.status(201).json(taskObj);
      } catch (error) {
        log.error('Failed to execute task:', error);
        res.status(500).json({ error: 'Failed to execute task' });
      }
    });

    this.app.delete('/api/agents/:id', async (req: Request, res: Response) => {
      try {
        await this.agentOrchestrator.deleteAgent(req.params.id);
        await this.auditLogger.log('agent_deleted', { agentId: req.params.id });
        res.status(204).send();
      } catch (error) {
        log.error('Failed to delete agent:', error);
        res.status(500).json({ error: 'Failed to delete agent' });
      }
    });

    // Webhooks
    this.app.post('/api/webhooks/automation', async (req: Request, res: Response) => {
      try {
        const { automationId, payload } = req.body;
        // Trigger automation
        await this.auditLogger.log('webhook_triggered', { automationId, payload });
        res.json({ success: true });
      } catch (error) {
        log.error('Webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    });

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      log.error('API Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      log.info('Client connected:', socket.id);

      // Subscribe to agent events
      socket.on('subscribe_agent', (agentId: string) => {
        socket.join(`agent:${agentId}`);
      });

      // Send message to agent
      socket.on('send_message', async (data: { agentId: string; message: string }) => {
        try {
          const response = await this.agentOrchestrator.sendMessage(
            data.agentId,
            data.message
          );
          socket.emit('message_response', response);
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('disconnect', () => {
        log.info('Client disconnected:', socket.id);
      });
    });

    // Forward agent events to WebSocket clients
    this.agentOrchestrator.on('agent:message', (data) => {
      this.io.to(`agent:${data.agentId}`).emit('agent_message', data);
    });

    this.agentOrchestrator.on('agent:taskCompleted', (data) => {
      this.io.to(`agent:${data.agentId}`).emit('task_completed', data);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        log.info(`API Server running on port ${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        log.info('API Server stopped');
        resolve();
      });
    });
  }
}