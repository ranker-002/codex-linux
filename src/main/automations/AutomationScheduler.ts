import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Automation, AutomationTrigger, AutomationAction, Agent } from '../../shared/types';
import { NotificationManager } from '../notifications/NotificationManager';

const execAsync = promisify(exec);

const AUTOMATIONS_FILE = 'automations.json';

export class AutomationScheduler extends EventEmitter {
  private automations: Map<string, Automation> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private notificationManager?: NotificationManager;
  private dataDir: string;

  constructor() {
    super();
    this.dataDir = path.join(app.getPath('userData'), 'data');
  }

  setNotificationManager(notificationManager: NotificationManager): void {
    this.notificationManager = notificationManager;
  }

  async initialize(): Promise<void> {
    await this.loadAutomations();
    log.info('Automation scheduler initialized');
  }

  private async loadAutomations(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, AUTOMATIONS_FILE);
      const data = await fs.readFile(filePath, 'utf-8');
      const automations: Automation[] = JSON.parse(data);
      
      for (const automation of automations) {
        automation.createdAt = new Date(automation.createdAt);
        automation.updatedAt = new Date(automation.updatedAt);
        if (automation.lastRunAt) {
          automation.lastRunAt = new Date(automation.lastRunAt);
        }
        this.automations.set(automation.id, automation);
        
        if (automation.enabled) {
          await this.scheduleAutomation(automation);
        }
      }
      log.info(`Loaded ${automations.length} automations`);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        log.error('Failed to load automations:', error);
      }
    }
  }

  private async saveAutomations(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, AUTOMATIONS_FILE);
      const automations = Array.from(this.automations.values());
      await fs.writeFile(filePath, JSON.stringify(automations, null, 2), 'utf-8');
    } catch (error) {
      log.error('Failed to save automations:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Stop all scheduled tasks
    for (const [id, task] of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks.clear();
  }

  async listAutomations(): Promise<Automation[]> {
    return Array.from(this.automations.values()).sort((a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async createAutomation(config: Partial<Automation>): Promise<Automation> {
    const automation: Automation = {
      id: uuidv4(),
      name: config.name || 'New Automation',
      description: config.description || '',
      enabled: config.enabled ?? false,
      trigger: config.trigger || { type: 'manual', config: {} },
      actions: config.actions || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0
    };

    this.automations.set(automation.id, automation);

    if (automation.enabled) {
      await this.scheduleAutomation(automation);
    }

    await this.saveAutomations();
    this.emit('automation:created', automation);
    log.info(`Created automation ${automation.id} (${automation.name})`);

    return automation;
  }

  async updateAutomation(automationId: string, updates: Partial<Automation>): Promise<Automation> {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    // Stop existing schedule if any
    await this.unscheduleAutomation(automationId);

    Object.assign(automation, updates, { updatedAt: new Date() });

    // Reschedule if enabled
    if (automation.enabled) {
      await this.scheduleAutomation(automation);
    }

    await this.saveAutomations();
    this.emit('automation:updated', automation);
    return automation;
  }

  async deleteAutomation(automationId: string): Promise<void> {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    await this.unscheduleAutomation(automationId);
    this.automations.delete(automationId);

    await this.saveAutomations();
    this.emit('automation:deleted', { automationId });
    log.info(`Deleted automation ${automationId}`);
  }

  async toggleAutomation(automationId: string, enabled: boolean): Promise<void> {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    automation.enabled = enabled;
    automation.updatedAt = new Date();

    if (enabled) {
      await this.scheduleAutomation(automation);
    } else {
      await this.unscheduleAutomation(automationId);
    }

    this.emit('automation:toggled', { automationId, enabled });
  }

  async runAutomation(automationId: string): Promise<void> {
    const automation = this.automations.get(automationId);
    if (!automation) {
      throw new Error(`Automation ${automationId} not found`);
    }

    log.info(`Running automation ${automationId} (${automation.name})`);
    
    automation.lastRunAt = new Date();
    automation.runCount++;
    automation.updatedAt = new Date();

    try {
      for (const action of automation.actions) {
        await this.executeAction(action);
      }

      this.emit('automation:completed', { automationId, success: true });
    } catch (error) {
      log.error(`Automation ${automationId} failed:`, error);
      this.emit('automation:completed', { automationId, success: false, error });
    }
  }

  private async scheduleAutomation(automation: Automation): Promise<void> {
    if (automation.trigger.type === 'schedule') {
      const cronExpression = automation.trigger.config.cron;
      
      if (!cronExpression || !cron.validate(cronExpression)) {
        log.error(`Invalid cron expression for automation ${automation.id}`);
        return;
      }

      const task = cron.schedule(cronExpression, () => {
        this.runAutomation(automation.id);
      });

      this.scheduledTasks.set(automation.id, task);
      log.info(`Scheduled automation ${automation.id} with cron: ${cronExpression}`);
    }
  }

  private async unscheduleAutomation(automationId: string): Promise<void> {
    const task = this.scheduledTasks.get(automationId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(automationId);
      log.info(`Unscheduled automation ${automationId}`);
    }
  }

  private async executeAction(action: AutomationAction): Promise<void> {
    log.info(`Executing action: ${action.type}`, action.config);

    switch (action.type) {
      case 'createAgent':
        this.emit('action:createAgent', action.config);
        log.info(`Emitted createAgent event with config:`, action.config);
        break;

      case 'sendMessage':
        this.emit('action:sendMessage', action.config);
        log.info(`Emitted sendMessage event with config:`, action.config);
        break;

      case 'executeCommand': {
        const { command, cwd = process.cwd() } = action.config;
        if (!command) {
          throw new Error('Command is required for executeCommand action');
        }
        try {
          const { stdout, stderr } = await execAsync(command, { cwd });
          log.info(`Command executed successfully: ${command}`, { stdout, stderr });
          this.emit('action:executeCommand:result', { success: true, stdout, stderr });
        } catch (error: any) {
          log.error(`Command execution failed: ${command}`, error.message);
          this.emit('action:executeCommand:result', { success: false, error: error.message });
        }
        break;
      }

      case 'runSkill':
        this.emit('action:runSkill', action.config);
        log.info(`Emitted runSkill event with config:`, action.config);
        break;

      case 'notify': {
        const { title, body } = action.config;
        if (!title || !body) {
          throw new Error('Title and body are required for notify action');
        }
        if (this.notificationManager) {
          this.notificationManager.show({ title, body });
        } else {
          this.emit('action:notify', { title, body });
        }
        log.info(`Notification shown: ${title}`);
        break;
      }

      default:
        log.warn(`Unknown action type: ${action.type}`);
    }
  }
}