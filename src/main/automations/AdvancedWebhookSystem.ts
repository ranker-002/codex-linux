import { EventEmitter } from 'events';
import axios from 'axios';
import log from 'electron-log';

interface WebhookTemplate {
  id: string;
  name: string;
  description: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  payloadTemplate: string;
}

interface OutgoingWebhook {
  id: string;
  name: string;
  url: string;
  templateId: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  retryCount: number;
}

interface WebhookPayload {
  event: string;
  timestamp: number;
  data: any;
  signature?: string;
}

export class AdvancedWebhookSystem extends EventEmitter {
  private templates: Map<string, WebhookTemplate> = new Map();
  private webhooks: Map<string, OutgoingWebhook> = new Map();
  private retryAttempts: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    // Agent Event Template
    this.templates.set('agent-event', {
      id: 'agent-event',
      name: 'Agent Event',
      description: 'Standard template for agent events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Codex-Linux/1.0'
      },
      payloadTemplate: JSON.stringify({
        event: '{{event}}',
        timestamp: '{{timestamp}}',
        agentId: '{{agentId}}',
        data: '{{data}}'
      }, null, 2)
    });

    // Task Completion Template
    this.templates.set('task-completed', {
      id: 'task-completed',
      name: 'Task Completed',
      description: 'Notifies when a task is completed',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payloadTemplate: JSON.stringify({
        event: 'task.completed',
        timestamp: '{{timestamp}}',
        agentId: '{{agentId}}',
        taskId: '{{taskId}}',
        result: '{{result}}',
        duration: '{{duration}}'
      }, null, 2)
    });

    // Error Notification Template
    this.templates.set('error-alert', {
      id: 'error-alert',
      name: 'Error Alert',
      description: 'Critical error notifications',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Priority': 'high'
      },
      payloadTemplate: JSON.stringify({
        event: 'error',
        timestamp: '{{timestamp}}',
        severity: '{{severity}}',
        component: '{{component}}',
        message: '{{message}}',
        stack: '{{stack}}'
      }, null, 2)
    });

    // Automation Trigger Template
    this.templates.set('automation-trigger', {
      id: 'automation-trigger',
      name: 'Automation Trigger',
      description: 'Triggered when automation runs',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payloadTemplate: JSON.stringify({
        event: 'automation.executed',
        timestamp: '{{timestamp}}',
        automationId: '{{automationId}}',
        automationName: '{{automationName}}',
        trigger: '{{trigger}}',
        status: '{{status}}'
      }, null, 2)
    });
  }

  createWebhook(
    name: string,
    url: string,
    templateId: string,
    events: string[],
    options: {
      secret?: string;
      enabled?: boolean;
    } = {}
  ): string {
    const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const webhook: OutgoingWebhook = {
      id: webhookId,
      name,
      url,
      templateId,
      events,
      enabled: options.enabled !== false,
      secret: options.secret,
      retryCount: 3
    };

    this.webhooks.set(webhookId, webhook);
    log.info(`Created webhook: ${webhookId}`);
    
    this.emit('webhook:created', webhook);
    return webhookId;
  }

  async triggerEvent(event: string, data: any): Promise<void> {
    const webhooks = Array.from(this.webhooks.values()).filter(
      w => w.enabled && w.events.includes(event)
    );

    await Promise.all(
      webhooks.map(webhook => this.sendWebhook(webhook, event, data))
    );
  }

  private async sendWebhook(
    webhook: OutgoingWebhook,
    event: string,
    data: any
  ): Promise<void> {
    const template = this.templates.get(webhook.templateId);
    if (!template) {
      log.error(`Webhook template not found: ${webhook.templateId}`);
      return;
    }

    const payload = this.buildPayload(template, event, data, webhook.secret);

    try {
      const response = await axios({
        method: template.method,
        url: webhook.url,
        headers: template.headers,
        data: payload,
        timeout: 30000
      });

      log.debug(`Webhook sent: ${webhook.id}, Status: ${response.status}`);
      this.emit('webhook:sent', { webhookId: webhook.id, event, status: response.status });
      
      // Clear retry count on success
      this.retryAttempts.delete(webhook.id);
    } catch (error) {
      log.error(`Webhook failed: ${webhook.id}`, error);
      
      // Retry logic
      const attempts = this.retryAttempts.get(webhook.id) || 0;
      if (attempts < webhook.retryCount) {
        this.retryAttempts.set(webhook.id, attempts + 1);
        setTimeout(() => this.sendWebhook(webhook, event, data), 1000 * (attempts + 1));
      } else {
        this.emit('webhook:failed', { webhookId: webhook.id, event, error });
        this.retryAttempts.delete(webhook.id);
      }
    }
  }

  private buildPayload(
    template: WebhookTemplate,
    event: string,
    data: any,
    secret?: string
  ): any {
    let payloadStr = template.payloadTemplate;

    // Replace template variables
    payloadStr = payloadStr.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key === 'event') return event;
      if (key === 'timestamp') return Date.now().toString();
      if (data[key] !== undefined) return JSON.stringify(data[key]);
      return match;
    });

    const payload = JSON.parse(payloadStr);

    // Add signature if secret is provided
    if (secret) {
      payload.signature = this.generateSignature(payload, secret);
    }

    return payload;
  }

  private generateSignature(payload: any, secret: string): string {
    // Simple HMAC-like signature (in production, use crypto library)
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  getTemplates(): WebhookTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplate(templateId: string): WebhookTemplate | undefined {
    return this.templates.get(templateId);
  }

  getWebhooks(): OutgoingWebhook[] {
    return Array.from(this.webhooks.values());
  }

  getWebhook(webhookId: string): OutgoingWebhook | undefined {
    return this.webhooks.get(webhookId);
  }

  updateWebhook(webhookId: string, updates: Partial<OutgoingWebhook>): void {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) throw new Error(`Webhook ${webhookId} not found`);

    Object.assign(webhook, updates);
    this.emit('webhook:updated', webhook);
  }

  deleteWebhook(webhookId: string): void {
    this.webhooks.delete(webhookId);
    this.emit('webhook:deleted', { webhookId });
  }

  createCustomTemplate(template: Omit<WebhookTemplate, 'id'>): string {
    const id = `custom-${Date.now()}`;
    this.templates.set(id, { ...template, id });
    return id;
  }

  cleanup(): void {
    this.webhooks.clear();
    this.templates.clear();
    this.retryAttempts.clear();
    this.removeAllListeners();
  }
}

export default AdvancedWebhookSystem;
