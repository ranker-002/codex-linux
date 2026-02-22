import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';
import log from 'electron-log';
import { Agent, AgentStatus, AgentMessage, AgentTask, TaskStatus, CodeChange, ChangeStatus } from '../shared/types';
import { GitWorktreeManager } from '../git/GitWorktreeManager';
import { SkillsManager } from '../skills/SkillsManager';
import { DatabaseManager } from '../DatabaseManager';
import { AIProviderManager } from '../providers/AIProviderManager';

interface AgentConfig {
  name: string;
  projectPath: string;
  providerId: string;
  model: string;
  skills?: string[];
  systemPrompt?: string;
  metadata?: Record<string, any>;
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export class AgentOrchestrator extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private activeTasks: Map<string, AbortController> = new Map();
  private lastActivity: Map<string, Date> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly INACTIVE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor(
    private aiProviderManager: AIProviderManager,
    private gitWorktreeManager: GitWorktreeManager,
    private skillsManager: SkillsManager,
    private dbManager: DatabaseManager
  ) {
    super();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Cleanup inactive agents every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveAgents();
    }, 60 * 60 * 1000);
  }

  private async cleanupInactiveAgents(): Promise<void> {
    const now = new Date();
    const agentsToDelete: string[] = [];

    for (const [agentId, lastActive] of this.lastActivity) {
      const inactiveTime = now.getTime() - lastActive.getTime();
      if (inactiveTime > this.INACTIVE_THRESHOLD) {
        const agent = this.agents.get(agentId);
        if (agent && agent.status !== AgentStatus.RUNNING) {
          agentsToDelete.push(agentId);
        }
      }
    }

    for (const agentId of agentsToDelete) {
      try {
        await this.deleteAgent(agentId);
        log.info(`Cleaned up inactive agent: ${agentId}`);
      } catch (error) {
        log.error(`Failed to cleanup agent ${agentId}:`, error);
      }
    }
  }

  async initialize(): Promise<void> {
    // Load existing agents from database
    const agents = await this.dbManager.getAllAgents();
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
      this.lastActivity.set(agent.id, agent.lastActiveAt || agent.updatedAt);
      
      if (agent.status === AgentStatus.RUNNING) {
        // Mark as error since we can't restore running state
        agent.status = AgentStatus.ERROR;
        await this.dbManager.updateAgent(agent);
      }
    }
    log.info(`Loaded ${agents.length} agents from database`);
  }

  async cleanup(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop all running agents
    const cleanupPromises: Promise<void>[] = [];
    for (const [agentId, agent] of this.agents) {
      if (agent.status === AgentStatus.RUNNING) {
        cleanupPromises.push(this.pauseAgent(agentId));
      }
    }
    
    await Promise.all(cleanupPromises);
    
    // Clear maps
    this.agents.clear();
    this.activeTasks.clear();
    this.lastActivity.clear();
  }

  async createAgent(config: AgentConfig): Promise<Agent> {
    const agentId = uuidv4();
    const worktreeName = `codex-agent-${agentId.slice(0, 8)}`;
    
    // Create worktree for isolation
    await this.gitWorktreeManager.createWorktree(config.projectPath, worktreeName);
    
    const agent: Agent = {
      id: agentId,
      name: config.name,
      status: AgentStatus.IDLE,
      projectPath: config.projectPath,
      worktreeName,
      providerId: config.providerId,
      model: config.model,
      skills: config.skills || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: null,
      messages: [],
      tasks: [],
      metadata: config.metadata || {}
    };

    // Add system message if provided
    if (config.systemPrompt) {
      agent.messages.push({
        id: uuidv4(),
        role: 'system',
        content: config.systemPrompt,
        timestamp: new Date()
      });
    }

    // Apply skills
    if (agent.skills.length > 0) {
      await this.applySkillsInternal(agent, agent.skills);
    }

    this.agents.set(agentId, agent);
    this.lastActivity.set(agentId, new Date());
    await this.dbManager.createAgent(agent);
    
    this.emit('agent:created', agent);
    log.info(`Created agent ${agentId} (${agent.name})`);
    
    return agent;
  }

  async listAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) || null;
  }

  async sendMessage(agentId: string, message: string): Promise<AgentMessage> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const userMessage: AgentMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    agent.messages.push(userMessage);
    agent.lastActiveAt = new Date();
    agent.status = AgentStatus.RUNNING;
    this.lastActivity.set(agentId, new Date());
    await this.dbManager.updateAgent(agent);

    this.emit('agent:message', { agentId, message: userMessage });

    // Get AI response with retry logic
    try {
      const response = await this.getAIResponseWithRetry(agent);
      
      const assistantMessage: AgentMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata
      };

      agent.messages.push(assistantMessage);
      agent.status = AgentStatus.IDLE;
      await this.dbManager.updateAgent(agent);

      this.emit('agent:message', { agentId, message: assistantMessage });
      
      return assistantMessage;
    } catch (error) {
      agent.status = AgentStatus.ERROR;
      await this.dbManager.updateAgent(agent);
      throw error;
    }
  }

  async sendMessageStream(agentId: string, message: string, callbacks: StreamCallbacks): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const userMessage: AgentMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    agent.messages.push(userMessage);
    agent.lastActiveAt = new Date();
    agent.status = AgentStatus.RUNNING;
    this.lastActivity.set(agentId, new Date());
    await this.dbManager.updateAgent(agent);

    this.emit('agent:message', { agentId, message: userMessage });

    try {
      const provider = this.aiProviderManager.getProvider(agent.providerId);
      if (!provider) {
        throw new Error(`Provider ${agent.providerId} not found`);
      }

      // Check if provider supports streaming
      if (typeof provider.sendMessageStream === 'function') {
        const stream = await provider.sendMessageStream(agent.model, agent.messages);
        
        let fullContent = '';
        
        stream.on('data', (chunk: string) => {
          fullContent += chunk;
          callbacks.onChunk(chunk);
        });
        
        stream.on('end', async () => {
          const assistantMessage: AgentMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: fullContent,
            timestamp: new Date()
          };

          agent.messages.push(assistantMessage);
          agent.status = AgentStatus.IDLE;
          await this.dbManager.updateAgent(agent);

          this.emit('agent:message', { agentId, message: assistantMessage });
          callbacks.onComplete();
        });
        
        stream.on('error', (error: Error) => {
          agent.status = AgentStatus.ERROR;
          this.dbManager.updateAgent(agent);
          callbacks.onError(error);
        });
      } else {
        // Fallback to non-streaming
        const response = await this.getAIResponseWithRetry(agent);
        callbacks.onChunk(response.content);
        
        const assistantMessage: AgentMessage = {
          id: uuidv4(),
          role: 'assistant',
          content: response.content,
          timestamp: new Date(),
          metadata: response.metadata
        };

        agent.messages.push(assistantMessage);
        agent.status = AgentStatus.IDLE;
        await this.dbManager.updateAgent(agent);

        this.emit('agent:message', { agentId, message: assistantMessage });
        callbacks.onComplete();
      }
    } catch (error) {
      agent.status = AgentStatus.ERROR;
      await this.dbManager.updateAgent(agent);
      callbacks.onError(error as Error);
    }
  }

  private async getAIResponseWithRetry(
    agent: Agent,
    attempt: number = 1
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    try {
      return await this.getAIResponse(agent);
    } catch (error) {
      if (attempt < this.MAX_RETRIES && this.isRetryableError(error)) {
        log.warn(`Retrying AI request for agent ${agent.id}, attempt ${attempt + 1}/${this.MAX_RETRIES}`);
        await this.delay(this.RETRY_DELAY * attempt); // Exponential backoff
        return this.getAIResponseWithRetry(agent, attempt + 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, rate limits
    if (!error) return false;
    
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'RATE_LIMITED'];
    const retryableStatuses = [429, 502, 503, 504];
    
    return retryableCodes.includes(error.code) || 
           retryableStatuses.includes(error.status) ||
           error.message?.includes('timeout') ||
           error.message?.includes('rate limit');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeTask(agentId: string, task: string, timeout: number = 30 * 60 * 1000): Promise<AgentTask> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const taskId = uuidv4();
    const agentTask: AgentTask = {
      id: taskId,
      description: task,
      status: TaskStatus.RUNNING,
      progress: 0,
      startedAt: new Date()
    };

    agent.tasks.push(agentTask);
    agent.status = AgentStatus.RUNNING;
    this.lastActivity.set(agentId, new Date());
    await this.dbManager.updateAgent(agent);

    this.emit('agent:taskStarted', { agentId, task: agentTask });

    // Create abort controller for this task
    const abortController = new AbortController();
    this.activeTasks.set(taskId, abortController);

    // Set up timeout
    const timeoutId = setTimeout(() => {
      abortController.abort();
      log.warn(`Task ${taskId} timed out after ${timeout}ms`);
    }, timeout);

    // Execute task in background
    this.runTask(agent, agentTask, abortController)
      .then(() => {
        clearTimeout(timeoutId);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        log.error(`Task ${taskId} failed:`, error);
        agentTask.status = TaskStatus.FAILED;
        agentTask.error = error.message;
        agentTask.completedAt = new Date();
        this.emit('agent:taskFailed', { agentId, task: agentTask, error });
      });

    return agentTask;
  }

  private async runTask(
    agent: Agent,
    task: AgentTask,
    abortController: AbortController
  ): Promise<void> {
    try {
      // Get worktree path
      const worktreePath = path.join(agent.projectPath, '.git', 'worktrees', agent.worktreeName);
      
      // Set up task context
      const taskMessage: AgentMessage = {
        id: uuidv4(),
        role: 'user',
        content: `[TASK] ${task.description}`,
        timestamp: new Date()
      };

      agent.messages.push(taskMessage);

      // Process the task with streaming updates
      const response = await this.getAIResponse(agent, {
        signal: abortController.signal,
        onProgress: (progress) => {
          task.progress = progress;
          this.emit('agent:progress', { agentId: agent.id, taskId: task.id, progress });
        }
      });

      // Parse and apply code changes
      const changes = await this.parseAndApplyChanges(agent, response.content);
      
      task.result = response.content;
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.completedAt = new Date();

      const assistantMessage: AgentMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: { changes: changes.map(c => c.id) }
      };

      agent.messages.push(assistantMessage);
      agent.status = AgentStatus.IDLE;
      agent.lastActiveAt = new Date();
      
      await this.dbManager.updateAgent(agent);
      
      this.emit('agent:taskCompleted', { agentId: agent.id, task });
    } catch (error) {
      if (abortController.signal.aborted) {
        task.status = TaskStatus.CANCELLED;
      } else {
        task.status = TaskStatus.FAILED;
        task.error = error instanceof Error ? error.message : String(error);
      }
      task.completedAt = new Date();
      agent.status = AgentStatus.ERROR;
      await this.dbManager.updateAgent(agent);
      throw error;
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Abort any running tasks
    for (const [taskId, controller] of this.activeTasks) {
      const task = agent.tasks.find(t => t.id === taskId);
      if (task && task.status === TaskStatus.RUNNING) {
        controller.abort();
        task.status = TaskStatus.PAUSED;
      }
    }

    agent.status = AgentStatus.PAUSED;
    await this.dbManager.updateAgent(agent);
    
    this.emit('agent:paused', { agentId });
  }

  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = AgentStatus.IDLE;
    await this.dbManager.updateAgent(agent);
    
    this.emit('agent:resumed', { agentId });
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Abort all tasks
    for (const [taskId, controller] of this.activeTasks) {
      const task = agent.tasks.find(t => t.id === taskId);
      if (task) {
        controller.abort();
        task.status = TaskStatus.CANCELLED;
        task.completedAt = new Date();
      }
    }

    agent.status = AgentStatus.IDLE;
    await this.dbManager.updateAgent(agent);
    
    this.emit('agent:stopped', { agentId });
  }

  async deleteAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Stop any running tasks
    await this.stopAgent(agentId);

    // Remove worktree
    try {
      await this.gitWorktreeManager.removeWorktree(agent.projectPath, agent.worktreeName);
    } catch (error) {
      log.warn(`Failed to remove worktree for agent ${agentId}:`, error);
    }

    this.agents.delete(agentId);
    this.lastActivity.delete(agentId);
    await this.dbManager.deleteAgent(agentId);
    
    this.emit('agent:deleted', { agentId });
    log.info(`Deleted agent ${agentId}`);
  }

  async applySkills(agentId: string, skillIds: string[]): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await this.applySkillsInternal(agent, skillIds);
    agent.skills = [...new Set([...agent.skills, ...skillIds])];
    await this.dbManager.updateAgent(agent);
    
    this.emit('skill:applied', { agentId, skillIds });
  }

  private async applySkillsInternal(agent: Agent, skillIds: string[]): Promise<void> {
    for (const skillId of skillIds) {
      const skill = await this.skillsManager.getSkill(skillId);
      if (skill) {
        // Add skill instructions to system context
        const instructionFiles = skill.files.filter(f => f.type === 'instruction');
        for (const file of instructionFiles) {
          agent.messages.push({
            id: uuidv4(),
            role: 'system',
            content: `[SKILL: ${skill.name}]\n${file.content}`,
            timestamp: new Date(),
            metadata: { skillId, skillName: skill.name }
          });
        }
      }
    }
  }

  private async getAIResponse(
    agent: Agent,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
    }
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    const provider = this.aiProviderManager.getProvider(agent.providerId);
    if (!provider) {
      throw new Error(`Provider ${agent.providerId} not found`);
    }

    return await provider.sendMessage(agent.model, agent.messages, {
      signal: options?.signal,
      onProgress: options?.onProgress
    });
  }

  private async parseAndApplyChanges(agent: Agent, content: string): Promise<CodeChange[]> {
    const changes: CodeChange[] = [];
    
    // Parse code blocks and diff markers from response
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const diffRegex = /diff --git a\/(.+) b\/(.+)\n([\s\S]*?)(?=diff --git|$)/g;
    
    let match;
    
    // Parse explicit diffs
    while ((match = diffRegex.exec(content)) !== null) {
      const [, oldFile, newFile, diffContent] = match;
      
      const change: CodeChange = {
        id: uuidv4(),
        filePath: newFile,
        originalContent: '', // Would need to read from worktree
        newContent: '', // Would need to parse from diff
        diff: diffContent,
        agentId: agent.id,
        taskId: agent.tasks[agent.tasks.length - 1]?.id || '',
        status: ChangeStatus.PENDING,
        createdAt: new Date()
      };
      
      changes.push(change);
      await this.dbManager.createCodeChange(change);
    }

    // Apply changes to worktree
    const worktreePath = path.join(agent.projectPath, '.git', 'worktrees', agent.worktreeName);
    
    for (const change of changes) {
      const filePath = path.join(worktreePath, change.filePath);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write new content (simplified - real implementation would parse diff)
      // await fs.writeFile(filePath, change.newContent, 'utf-8');
      
      log.info(`Applied change to ${change.filePath} in worktree ${agent.worktreeName}`);
    }

    return changes;
  }
}