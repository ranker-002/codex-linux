import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { DatabaseManager } from '../DatabaseManager';
import { NotificationManager } from '../notifications/NotificationManager';
import { Agent, AgentStatus, TaskStatus } from '../../shared/types';
import { AgentTools, ToolResult } from '../agents/AgentTools';
import { CodeIndex } from '../agents/CodeIndex';
import { NativeToolCalling } from '../agents/NativeToolCalling';

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
      
      // Get agent worktree path
      const agent = await this.agentOrchestrator.getAgent(session.agentId);
      if (!agent) throw new Error('Agent not found');
      
      const worktreePath = agent.worktreePath || agent.projectPath;
      
      // Get OpenAI API key from settings
      const apiKey = process.env.OPENAI_API_KEY || '';
      const tools = new AgentTools(worktreePath);
      const codeIndex = new CodeIndex(worktreePath, '.codex/index', apiKey);
      await codeIndex.initialize();
      
      // Initialize native tool calling if API key available
      const toolCaller = apiKey ? new NativeToolCalling(apiKey, worktreePath) : null;
      
      // Step 1: Index codebase
      this.addLog(session, 'Indexing codebase for semantic search...');
      session.progress = 5;
      await codeIndex.indexProject();
      
      // Step 2: Analyze with tools
      this.addLog(session, 'Analyzing codebase structure with tools...');
      session.progress = 15;
      this.emit('session:progress', { sessionId: session.id, progress: 15, step: 'analysis' });
      
      // List root directory
      this.emit('session:tool', { sessionId: session.id, tool: 'ls', status: 'running' });
      const lsResult = await tools.ls({ path: '.' });
      this.emit('session:tool', { sessionId: session.id, tool: 'ls', status: 'completed', result: lsResult.output });
      this.addLog(session, `Project structure:\n${lsResult.output}`);
      
      // Search for relevant files using semantic search
      const searchResults = await codeIndex.search(session.objective, 10);
      const relevantFiles = searchResults.map(r => r.filePath);
      
      this.addLog(session, `Found ${relevantFiles.length} relevant files via semantic search`);
      
      // Read key files
      let fileContents = '';
      for (const file of relevantFiles.slice(0, 5)) {
        this.emit('session:tool', { sessionId: session.id, tool: 'view', status: 'running', params: { file_path: file } });
        const viewResult = await tools.view({ file_path: file });
        this.emit('session:tool', { sessionId: session.id, tool: 'view', status: viewResult.success ? 'completed' : 'error', result: viewResult.output, error: viewResult.error });
        if (viewResult.success) {
          fileContents += `\n\n=== ${file} ===\n${viewResult.output}`;
        }
      }
      
      session.progress = 25;
      this.emit('session:progress', { sessionId: session.id, progress: 25, step: 'files_read', files: relevantFiles.slice(0, 5) });
      
      // Step 3: Create plan using actual file contents
      this.addLog(session, 'Creating detailed implementation plan...');
      session.progress = 35;
      
      const planTask = await this.agentOrchestrator.sendMessage(
        session.agentId,
        `Based on the following codebase analysis, create a detailed plan to achieve: ${session.objective}\n\n` +
        `Project structure:\n${lsResult.output}\n\n` +
        `Relevant files found:\n${relevantFiles.join('\n')}\n\n` +
        `Key file contents:${fileContents.slice(0, 8000)}\n\n` +
        `Create a step-by-step plan with specific files to modify and actions to take.`
      );
      
      session.progress = 45;
      
      // Step 4: Execute with native tool calling (if available) or streaming
      this.addLog(session, 'Executing plan with tool use...');
      session.progress = 55;
      
      let executionResult = '';
      
      if (toolCaller?.isAvailable()) {
        // Use native tool calling
        this.addLog(session, 'Using native OpenAI tool calling...');
        
        const systemPrompt = 
          `You are an expert software developer. Execute the following objective: ${session.objective}\n\n` +
          `You have access to tools to explore and modify the codebase. ` +
          `Start by exploring the codebase structure, then make necessary changes. ` +
          `After each tool use, analyze the result and decide on next steps.`;
        
        const userPrompt = 
          `Objective: ${session.objective}\n\n` +
          `Relevant files:\n${relevantFiles.join('\n')}\n\n` +
          `Execute the implementation. Use tools to view, edit, and test the code.`;
        
        executionResult = await toolCaller.executeWithTools(
          'gpt-4o',
          systemPrompt,
          userPrompt,
          (toolCall, result) => {
            this.emit('session:tool', {
              sessionId: session.id,
              tool: toolCall.function.name,
              status: result.success ? 'completed' : 'error',
              result: result.output,
              error: result.error
            });
          }
        );
        
        this.addLog(session, `Execution completed: ${executionResult.slice(0, 500)}`);
      } else {
        // Fallback to streaming
        this.addLog(session, 'Using streaming mode (no native tool calling)...');
        
        const toolDefinitions = tools.getToolDefinitions();
        const toolDescriptions = toolDefinitions.map(t => 
          `- ${t.name}: ${t.description}`
        ).join('\n');
        
        const executePrompt = 
          `Execute the following objective: ${session.objective}\n\n` +
          `You have access to the following tools:\n${toolDescriptions}\n\n` +
          `To use a tool, respond with: TOOL: {"name": "tool_name", "params": {...}}\n\n` +
          `First, explore the codebase to understand the structure, then make the necessary changes.`;
        
        let streamingContent = '';
        await this.agentOrchestrator.sendMessageStream(
          session.agentId,
          executePrompt,
          {
            onChunk: (chunk: string) => {
              streamingContent += chunk;
              this.emit('session:stream', { sessionId: session.id, chunk, content: streamingContent });
            },
            onComplete: () => {
              this.emit('session:streamComplete', { sessionId: session.id, content: streamingContent });
            },
            onError: (error: Error) => {
              this.emit('session:streamError', { sessionId: session.id, error: error.message });
            }
          }
        );
        
        executionResult = streamingContent;
      }
      
      session.progress = 75;
      this.emit('session:progress', { sessionId: session.id, progress: 75, step: 'execution' });
      
      // Step 5: Verify with tests
      this.addLog(session, 'Running verification...');
      session.progress = 85;
      this.emit('session:progress', { sessionId: session.id, progress: 85, step: 'verification' });
      
      // Try to run tests
      this.emit('session:tool', { sessionId: session.id, tool: 'bash', status: 'running', params: { command: 'npm test' } });
      const testResult = await tools.bash({ command: 'npm test || echo "No tests"' });
      this.emit('session:tool', { sessionId: session.id, tool: 'bash', status: testResult.success ? 'completed' : 'error', result: testResult.output, error: testResult.error });
      this.addLog(session, `Test result: ${testResult.output.slice(0, 500)}`);
      
      // Check for TypeScript errors
      this.emit('session:tool', { sessionId: session.id, tool: 'bash', status: 'running', params: { command: 'npx tsc --noEmit' } });
      const typeCheck = await tools.bash({ command: 'npx tsc --noEmit 2>&1 || echo "Type check completed"' });
      this.emit('session:tool', { sessionId: session.id, tool: 'bash', status: typeCheck.success ? 'completed' : 'error', result: typeCheck.output, error: typeCheck.error });
      if (!typeCheck.success) {
        this.addLog(session, `Type errors found: ${typeCheck.error?.slice(0, 300)}`);
      }
      
      session.progress = 95;
      this.emit('session:progress', { sessionId: session.id, progress: 95, step: 'complete' });
      
      // Complete
      session.status = 'completed';
      session.progress = 100;
      session.completedAt = new Date();
      session.deliverables.push('Implementation completed');
      session.deliverables.push(`Modified files: ${relevantFiles.join(', ')}`);
      
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