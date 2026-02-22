import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as cron from 'node-cron';
import log from 'electron-log';
import { Automation, AutomationTrigger, AutomationAction, Agent } from '../shared/types';

export class AutomationScheduler extends EventEmitter {
  private automations: Map<string, Automation> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  async initialize(): Promise<void> {
    // Load automations from database
    // For now, start empty
    log.info('Automation scheduler initialized');
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
    switch (action.type) {
      case 'createAgent':
        // Would create agent through AgentOrchestrator
        this.emit('action:createAgent', action.config);
        break;
      
      case 'sendMessage':
        this.emit('action:sendMessage', action.config);
        break;
      
      case 'executeCommand':
        // Would execute shell command
        this.emit('action:executeCommand', action.config);
        break;
      
      case 'runSkill':
        this.emit('action:runSkill', action.config);
        break;
      
      case 'notify':
        // Would show notification
        this.emit('action:notify', action.config);
        break;
      
      default:
        log.warn(`Unknown action type: ${action.type}`);
    }
  }
}