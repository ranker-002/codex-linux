import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { SecurityManager } from '../security/SecurityManager';
import { AuditLogger } from '../security/AuditLogger';
import log from 'electron-log';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const wsRateLimits = new Map<string, RateLimitEntry>();
const WS_RATE_LIMIT = 30;
const WS_RATE_WINDOW_MS = 60000;

function checkWebSocketRateLimit(socketId: string): boolean {
  const now = Date.now();
  const entry = wsRateLimits.get(socketId);
  
  if (!entry || now > entry.resetTime) {
    wsRateLimits.set(socketId, { count: 1, resetTime: now + WS_RATE_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= WS_RATE_LIMIT) {
    return false;
  }
  
  entry.count++;
  return true;
}

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  projectPath: z.string().min(1),
  providerId: z.string().min(1),
  model: z.string().optional(),
  skills: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
});

const ExecuteTaskSchema = z.object({
  task: z.string().min(1).max(5000),
});

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

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'];
    this.io = new Server(this.server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
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

    try {
      const isValid = await this.securityManager.validateApiKey(apiKey);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }
      next();
    } catch (error) {
      log.error('Authentication error:', error);
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
        const validated = CreateAgentSchema.safeParse(req.body);
        if (!validated.success) {
          res.status(400).json({ error: 'Invalid request', details: validated.error.errors });
          return;
        }
        const agentConfig = {
          name: validated.data.name,
          projectPath: validated.data.projectPath,
          providerId: validated.data.providerId,
          model: validated.data.model || 'gpt-4o',
          skills: validated.data.skills,
          systemPrompt: validated.data.systemPrompt,
          metadata: validated.data.metadata,
        };
        const agent = await this.agentOrchestrator.createAgent(agentConfig);
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
        const validated = SendMessageSchema.safeParse(req.body);
        if (!validated.success) {
          res.status(400).json({ error: 'Invalid request', details: validated.error.errors });
          return;
        }
        const response = await this.agentOrchestrator.sendMessage(req.params.id, validated.data.message);
        res.json(response);
      } catch (error) {
        log.error('Failed to send message:', error);
        res.status(500).json({ error: 'Failed to send message' });
      }
    });

    this.app.post('/api/agents/:id/tasks', async (req: Request, res: Response) => {
      try {
        const validated = ExecuteTaskSchema.safeParse(req.body);
        if (!validated.success) {
          res.status(400).json({ error: 'Invalid request', details: validated.error.errors });
          return;
        }
        const taskObj = await this.agentOrchestrator.executeTask(req.params.id, validated.data.task);
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
    this.app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
      log.error('API Error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private setupWebSocket(): void {
    this.io.on('connection', (socket: Socket) => {
      log.info('Client connected:', socket.id);

      socket.on('subscribe_agent', (agentId: string) => {
        socket.join(`agent:${agentId}`);
      });

      socket.on('send_message', async (data: { agentId: string; message: string }) => {
        if (!checkWebSocketRateLimit(socket.id)) {
          socket.emit('error', { message: 'Rate limit exceeded' });
          return;
        }
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
        wsRateLimits.delete(socket.id);
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