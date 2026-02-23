import { EventEmitter } from 'events';
import log from 'electron-log';
import { AIProviderManager } from '../providers/AIProviderManager';
import { VisionManager } from './VisionManager';
import { PermissionManager } from '../security/PermissionManager';

export interface UIElement {
  id?: string;
  type: 'button' | 'input' | 'link' | 'text' | 'image' | 'container' | 'other';
  text?: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  attributes?: Record<string, string>;
}

export interface ComputerAction {
  type: 'click' | 'doubleClick' | 'rightClick' | 'type' | 'scroll' | 'drag' | 'wait' | 'key' | 'screenshot';
  target?: {
    element?: UIElement;
    coordinates?: { x: number; y: number };
    selector?: string;
  };
  value?: string;
  delay?: number;
  metadata?: Record<string, any>;
}

export interface ComputerTask {
  id: string;
  description: string;
  goal: string;
  maxSteps: number;
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions: ComputerAction[];
  results: string[];
  error?: string;
}

export interface ComputerUseSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  screenshots: string[];
  actions: ComputerAction[];
  currentUrl?: string;
  currentApp?: string;
}

export class ComputerUseManager extends EventEmitter {
  private visionManager: VisionManager;
  private aiProviderManager: AIProviderManager;
  private permissionManager: PermissionManager;
  private activeSessions: Map<string, ComputerUseSession> = new Map();
  private activeTasks: Map<string, ComputerTask> = new Map();
  private readonly MAX_STEPS = 50;
  private readonly STEP_DELAY = 2000; // 2 seconds between actions

  constructor(
    aiProviderManager: AIProviderManager,
    permissionManager: PermissionManager
  ) {
    super();
    this.aiProviderManager = aiProviderManager;
    this.permissionManager = permissionManager;
    this.visionManager = new VisionManager(aiProviderManager);
  }

  async executeTask(
    description: string,
    goal: string,
    options: {
      maxSteps?: number;
      requirePermission?: boolean;
      targetUrl?: string;
      targetApp?: string;
    } = {}
  ): Promise<ComputerTask> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    const task: ComputerTask = {
      id: taskId,
      description,
      goal,
      maxSteps: options.maxSteps || this.MAX_STEPS,
      currentStep: 0,
      status: 'pending',
      actions: [],
      results: []
    };

    this.activeTasks.set(taskId, task);

    // Check permission if required
    if (options.requirePermission !== false) {
      const permission = await this.permissionManager.checkPermission('computer-use', {
        type: 'tool',
        action: 'execute-computer-task',
        details: { goal, maxSteps: task.maxSteps }
      });

      if (!permission.allowed) {
        task.status = 'failed';
        task.error = 'Permission denied';
        return task;
      }
    }

    try {
      task.status = 'running';
      this.emit('task:started', task);

      // Create session
      const session = await this.createSession(taskId, options);
      
      // Execute steps
      while (task.currentStep < task.maxSteps && task.status === 'running') {
        await this.executeStep(task, session);
        
        // Check if goal is achieved
        if (await this.isGoalAchieved(task, session)) {
          task.status = 'completed';
          break;
        }

        // Delay between steps
        await this.delay(this.STEP_DELAY);
      }

      if (task.currentStep >= task.maxSteps && task.status === 'running') {
        task.status = 'completed';
        task.results.push('Maximum steps reached');
      }

      session.endTime = new Date();
      this.emit('task:completed', task);
      
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      this.emit('task:failed', task, error);
      log.error('ComputerUse: Task failed:', error);
    }

    return task;
  }

  private async createSession(
    taskId: string,
    options: { targetUrl?: string; targetApp?: string }
  ): Promise<ComputerUseSession> {
    const sessionId = `session_${Date.now()}`;
    
    const session: ComputerUseSession = {
      id: sessionId,
      taskId,
      startTime: new Date(),
      screenshots: [],
      actions: [],
      currentUrl: options.targetUrl,
      currentApp: options.targetApp
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  private async executeStep(task: ComputerTask, session: ComputerUseSession): Promise<void> {
    task.currentStep++;
    
    try {
      // 1. Capture screenshot
      const screenshot = await this.captureScreenshot();
      session.screenshots.push(screenshot);

      // 2. Analyze current state with AI
      const analysis = await this.analyzeScreenState(screenshot, task);

      // 3. Determine next action
      const action = await this.determineNextAction(analysis, task, session);
      
      if (!action) {
        task.status = 'completed';
        task.results.push('No further actions needed');
        return;
      }

      // 4. Execute action
      await this.executeAction(action, session);
      task.actions.push(action);
      session.actions.push(action);

      // 5. Record result
      task.results.push(`Step ${task.currentStep}: ${action.type} executed`);

      this.emit('step:completed', task, action);

    } catch (error: any) {
      log.error(`ComputerUse: Step ${task.currentStep} failed:`, error);
      task.results.push(`Step ${task.currentStep}: Error - ${error.message}`);
      
      // Don't fail immediately, try to recover
      if (task.currentStep >= 3) {
        throw error;
      }
    }
  }

  private async captureScreenshot(): Promise<string> {
    // Use desktopCapturer from Electron
    const { desktopCapturer } = await import('electron');
    
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }

    // Get primary screen or first available
    const primarySource = sources.find(s => s.name === 'Entire screen') || sources[0];
    
    return primarySource.thumbnail.toDataURL();
  }

  private async analyzeScreenState(
    screenshot: string,
    task: ComputerTask
  ): Promise<{
    description: string;
    elements: UIElement[];
    currentState: string;
    progress: string;
  }> {
    const prompt = `Analyze this screenshot and provide:
1. A description of what is currently visible
2. A list of interactive UI elements with their approximate coordinates
3. The current state relative to the goal: "${task.goal}"
4. Progress assessment

Goal: ${task.goal}
Current Step: ${task.currentStep}/${task.maxSteps}

Respond in JSON format:
{
  "description": "...",
  "elements": [
    {"type": "button", "text": "Submit", "coordinates": {"x": 100, "y": 200, "width": 80, "height": 30}, "confidence": 0.95}
  ],
  "currentState": "...",
  "progress": "..."
}`;

    const result = await this.visionManager.analyzeScreenshot(
      screenshot.replace(/^data:image\/[^;]+;base64,/, ''),
      prompt
    );

    try {
      // Try to parse JSON response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      log.warn('ComputerUse: Failed to parse AI response as JSON');
    }

    // Fallback to text parsing
    return {
      description: result.content,
      elements: [],
      currentState: 'Unknown',
      progress: 'Unable to determine'
    };
  }

  private async determineNextAction(
    analysis: any,
    task: ComputerTask,
    _session: ComputerUseSession
  ): Promise<ComputerAction | null> {
    const prompt = `Based on the current screen state and goal, determine the next action to take.

Goal: ${task.goal}
Current Step: ${task.currentStep}/${task.maxSteps}
Screen Description: ${analysis.description}
Current State: ${analysis.currentState}
Progress: ${analysis.progress}

Available UI Elements:
${JSON.stringify(analysis.elements, null, 2)}

Determine the single next action to progress toward the goal. Respond in JSON format:
{
  "type": "click|type|scroll|wait|key",
  "target": {
    "element": {"type": "button", "text": "...", "coordinates": {"x": 100, "y": 200}},
    "coordinates": {"x": 100, "y": 200}
  },
  "value": "text to type (if applicable)",
  "delay": 1000,
  "reason": "explanation of why this action"
}

Or respond with {"action": null} if the goal is achieved or cannot be progressed.`;

    const provider = this.aiProviderManager.getActiveProviderInstance();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const response = await provider.sendMessage('gpt-4o', [
      { role: 'user', content: prompt }
    ] as Array<{ role: string; content: string }>);

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const actionData = JSON.parse(jsonMatch[0]);
        if (actionData.action === null) {
          return null;
        }
        return {
          type: actionData.type,
          target: actionData.target,
          value: actionData.value,
          delay: actionData.delay,
          metadata: { reason: actionData.reason }
        };
      }
    } catch (e) {
      log.warn('ComputerUse: Failed to parse action from AI response');
    }

    return null;
  }

  private async executeAction(action: ComputerAction, session: ComputerUseSession): Promise<void> {
    switch (action.type) {
      case 'click':
        await this.simulateClick(action.target?.coordinates || action.target?.element?.coordinates);
        break;
      case 'doubleClick':
        await this.simulateDoubleClick(action.target?.coordinates || action.target?.element?.coordinates);
        break;
      case 'type':
        await this.simulateType(action.value || '');
        break;
      case 'scroll':
        await this.simulateScroll(action.target?.coordinates);
        break;
      case 'key':
        await this.simulateKeyPress(action.value || '');
        break;
      case 'wait':
        await this.delay(action.delay || 1000);
        break;
      case 'screenshot':
        const screenshot = await this.captureScreenshot();
        session.screenshots.push(screenshot);
        break;
    }

    this.emit('action:executed', action);
  }

  private async simulateClick(coordinates?: { x: number; y: number }): Promise<void> {
    if (!coordinates) {
      log.warn('ComputerUse: Click action without coordinates');
      return;
    }

    // Use robotjs or similar for actual automation
    // For now, emit event for UI to handle
    this.emit('action:click', coordinates);
    log.info(`ComputerUse: Click at (${coordinates.x}, ${coordinates.y})`);
  }

  private async simulateDoubleClick(coordinates?: { x: number; y: number }): Promise<void> {
    if (!coordinates) return;
    this.emit('action:doubleClick', coordinates);
    log.info(`ComputerUse: Double click at (${coordinates.x}, ${coordinates.y})`);
  }

  private async simulateType(text: string): Promise<void> {
    this.emit('action:type', text);
    log.info(`ComputerUse: Type "${text}"`);
  }

  private async simulateScroll(coordinates?: { x: number; y: number }): Promise<void> {
    this.emit('action:scroll', coordinates);
    log.info('ComputerUse: Scroll');
  }

  private async simulateKeyPress(key: string): Promise<void> {
    this.emit('action:key', key);
    log.info(`ComputerUse: Key press "${key}"`);
  }

  private async isGoalAchieved(task: ComputerTask, session: ComputerUseSession): Promise<boolean> {
    if (task.currentStep === 0) return false;

    const lastScreenshot = session.screenshots[session.screenshots.length - 1];
    if (!lastScreenshot) return false;

    const prompt = `Analyze if the goal has been achieved based on the current screenshot.

Goal: ${task.goal}
Previous Actions: ${task.actions.map(a => a.type).join(', ')}

Has the goal been achieved? Respond with only "yes" or "no".`;

    try {
      const result = await this.visionManager.analyzeScreenshot(
        lastScreenshot.replace(/^data:image\/[^;]+;base64,/, ''),
        prompt
      );

      return result.content.toLowerCase().includes('yes');
    } catch (error) {
      log.error('ComputerUse: Failed to check goal achievement:', error);
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;

    task.status = 'cancelled';
    this.emit('task:cancelled', task);
    return true;
  }

  getActiveTask(taskId: string): ComputerTask | undefined {
    return this.activeTasks.get(taskId);
  }

  getAllActiveTasks(): ComputerTask[] {
    return Array.from(this.activeTasks.values()).filter(t => t.status === 'running');
  }

  getSession(sessionId: string): ComputerUseSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  cleanup(): void {
    // Cancel all active tasks
    for (const [taskId, task] of this.activeTasks) {
      if (task.status === 'running') {
        this.cancelTask(taskId);
      }
    }

    this.activeTasks.clear();
    this.activeSessions.clear();
    this.visionManager.cleanup();
    this.removeAllListeners();
  }
}

export default ComputerUseManager;
