import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { DatabaseManager } from '../DatabaseManager';
import { NotificationManager } from '../notifications/NotificationManager';
import { Agent, AgentStatus, TaskStatus } from '../../shared/types';

interface CoworkSession {
  id: string;
  name: string;
  agentId: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  objective: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  logs: string[];
  deliverables: string[];
  autoApprove: boolean;
}

export class CoworkManager extends EventEmitter {
  private sessions: Map<string, CoworkSession> = new Map();
  private agentOrchestrator: AgentOrchestrator;
  private dbManager: DatabaseManager;
  private notificationManager: NotificationManager;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    agentOrchestrator: AgentOrchestrator,
    dbManager: DatabaseManager,
    notificationManager: NotificationManager
  ) {
    super();
    this.agentOrchestrator = agentOrchestrator;
    this.dbManager = dbManager;
    this.notificationManager = notificationManager;
  }

  async initialize(): Promise<void> {
    // Load existing sessions from DB
    await this.loadSessions();
    
    // Start monitoring loop
    this.checkInterval = setInterval(() => this.monitorSessions(), 5000);
    
    log.info('Cowork manager initialized');
  }

  async createSession(
    name: string,
    objective: string,
    projectPath: string,
    options: {
      autoApprove?: boolean;
      skills?: string[];
    } = {}
  ): Promise<CoworkSession> {
    const sessionId = uuidv4();
    
    // Create background agent
    const agent = await this.agentOrchestrator.createAgent({
      name: `Cowork: ${name}`,
      projectPath,
      providerId: 'openai',
      model: 'gpt-4o', // Use best model for autonomous work
      skills: options.skills || ['refactoring', 'testing'],
    });

    const session: CoworkSession = {
      id: sessionId,
      name,
      agentId: agent.id,
      status: 'idle',
      objective,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      logs: [],
      deliverables: [],
      autoApprove: options.autoApprove ?? false,
    };

    this.sessions.set(sessionId, session);
    await this.saveSession(session);

    this.emit('session:created', session);
    log.info(`Cowork session created: ${sessionId}`);

    return session;
  }

  async startSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'running';
    session.updatedAt = new Date();
    
    // Start the autonomous workflow
    this.runAutonomousWorkflow(session);
    
    await this.saveSession(session);
    this.emit('session:started', session);
    
    this.notificationManager.show({
      title: 'Cowork Session Started',
      body: `"${session.name}" is now working in the background`,
    });
  }

  async pauseSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    session.status = 'paused';
    session.updatedAt = new Date();
    
    await this.agentOrchestrator.pauseAgent(session.agentId);
    await this.saveSession(session);
    
    this.emit('session:paused', session);
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    await this.agentOrchestrator.stopAgent(session.agentId);
    
    session.status = 'completed';
    session.completedAt = new Date();
    session.updatedAt = new Date();
    
    await this.saveSession(session);
    this.emit('session:stopped', session);
  }

  private async runAutonomousWorkflow(session: CoworkSession): Promise<void> {
    try {
      this.addLog(session, 'Starting autonomous workflow...');
      
      // Step 1: Analyze codebase
      this.addLog(session, 'Analyzing codebase structure...');
      session.progress = 10;
      this.emit('session:progress', { sessionId: session.id, progress: 10 });
      
      const analysisTask = await this.agentOrchestrator.executeTask(
        session.agentId,
        `Analyze the codebase structure and identify files relevant to: ${session.objective}. Provide a summary of the project structure and key files.`
      );
      
      // Wait for analysis
      await this.waitForTask(session.agentId, analysisTask.id);
      session.progress = 25;
      
      // Step 2: Plan approach
      this.addLog(session, 'Planning implementation approach...');
      session.progress = 30;
      
      const planTask = await this.agentOrchestrator.executeTask(
        session.agentId,
        `Based on the analysis, create a detailed plan to achieve: ${session.objective}. Break it down into specific steps and files to modify.`
      );
      
      await this.waitForTask(session.agentId, planTask.id);
      session.progress = 40;
      
      // Step 3: Execute implementation
      this.addLog(session, 'Implementing changes...');
      session.progress = 50;
      
      const implementationTask = await this.agentOrchestrator.executeTask(
        session.agentId,
        `Execute the plan to achieve: ${session.objective}. Implement all necessary changes. ${session.autoApprove ? 'Auto-approve all changes.' : 'Wait for approval before applying each change.'}`
      );
      
      await this.waitForTask(session.agentId, implementationTask.id);
      session.progress = 80;
      
      // Step 4: Verify and test
      this.addLog(session, 'Running verification and tests...');
      session.progress = 90;
      
      const verifyTask = await this.agentOrchestrator.executeTask(
        session.agentId,
        'Verify that all changes work correctly. Run any available tests and check for errors.'
      );
      
      await this.waitForTask(session.agentId, verifyTask.id);
      
      // Complete
      session.status = 'completed';
      session.progress = 100;
      session.completedAt = new Date();
      session.deliverables.push('Implementation completed');
      
      this.addLog(session, 'Session completed successfully!');
      await this.saveSession(session);
      
      this.emit('session:completed', session);
      
      this.notificationManager.show({
        title: 'Cowork Session Completed',
        body: `"${session.name}" has finished working`,
      });
      
    } catch (error) {
      session.status = 'error';
      this.addLog(session, `Error: ${error}`);
      await this.saveSession(session);
      
      this.emit('session:error', { sessionId: session.id, error });
      
      this.notificationManager.show({
        title: 'Cowork Session Error',
        body: `"${session.name}" encountered an error`,
      });
    }
  }

  private async waitForTask(agentId: string, taskId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(async () => {
        try {
          const agent = await this.agentOrchestrator.getAgent(agentId);
          const task = agent?.tasks.find(t => t.id === taskId);
          
          if (!task) {
            clearInterval(checkInterval);
            reject(new Error('Task not found'));
            return;
          }
          
          if (task.status === TaskStatus.COMPLETED) {
            clearInterval(checkInterval);
            resolve();
          } else if (task.status === TaskStatus.FAILED) {
            clearInterval(checkInterval);
            reject(new Error(task.error || 'Task failed'));
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 1000);
      
      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Task timeout'));
      }, 30 * 60 * 1000);
    });
  }

  private addLog(session: CoworkSession, message: string): void {
    const timestamp = new Date().toISOString();
    session.logs.push(`[${timestamp}] ${message}`);
    this.emit('session:log', { sessionId: session.id, message });
  }

  private async monitorSessions(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        // Update progress and check health
        const agent = await this.agentOrchestrator.getAgent(session.agentId);
        if (agent?.status === AgentStatus.ERROR) {
          session.status = 'error';
          this.addLog(session, 'Agent encountered an error');
          await this.saveSession(session);
        }
      }
    }
  }

  getSessions(): CoworkSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getSession(sessionId: string): CoworkSession | undefined {
    return this.sessions.get(sessionId);
  }

  private async loadSessions(): Promise<void> {
    // Load from database
    const sessions = await this.dbManager.getCoworkSessions?.() || [];
    for (const session of sessions) {
      this.sessions.set(session.id, session);
    }
  }

  private async saveSession(session: CoworkSession): Promise<void> {
    await this.dbManager.saveCoworkSession?.(session);
  }

  async cleanup(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Stop all running sessions
    for (const session of this.sessions.values()) {
      if (session.status === 'running') {
        await this.stopSession(session.id);
      }
    }
  }
}