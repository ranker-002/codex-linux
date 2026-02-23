import { EventEmitter } from 'events';
import { WebClient, WebClientOptions } from '@slack/web-api';
import log from 'electron-log';

export interface SlackBotConfig {
  token: string;
  appToken?: string;
  signingSecret?: string;
  botId?: string;
  defaultChannel?: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  threadTs?: string;
  attachments?: Array<{
    color?: string;
    title?: string;
    text?: string;
    fields?: Array<{ title: string; value: string; short?: boolean }>;
  }>;
  blocks?: any[];
}

export interface SlackMention {
  userId: string;
  text: string;
  channel: string;
  timestamp: string;
}

export class SlackBotManager extends EventEmitter {
  private config: SlackBotConfig | null = null;
  private client: WebClient | null = null;
  private isConnected = false;

  constructor() {
    super();
  }

  async configure(config: SlackBotConfig): Promise<void> {
    this.config = config;
    this.client = new WebClient(config.token);
    this.isConnected = true;
    
    log.info('Slack Bot configured', { botId: config.botId, defaultChannel: config.defaultChannel });
    this.emit('connected');
  }

  async sendMessage(message: SlackMessage): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    try {
      const result = await this.client.chat.postMessage({
        channel: message.channel,
        text: message.text,
        thread_ts: message.threadTs,
        attachments: message.attachments,
        blocks: message.blocks,
      });

      this.emit('message:sent', { channel: message.channel, ts: result.ts });
      return result;
    } catch (error) {
      log.error('Slack: Failed to send message:', error);
      throw error;
    }
  }

  async sendDirectMessage(userId: string, text: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    try {
      // Open a conversation with the user
      const conversation = await this.client.conversations.open({
        users: userId,
      });

      return this.sendMessage({
        channel: conversation.channel!.id!,
        text,
      });
    } catch (error) {
      log.error('Slack: Failed to send DM:', error);
      throw error;
    }
  }

  async replyToThread(channel: string, threadTs: string, text: string): Promise<any> {
    return this.sendMessage({
      channel,
      text,
      threadTs,
    });
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.chat.update({
      channel,
      ts,
      text,
    });
  }

  async deleteMessage(channel: string, ts: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.chat.delete({
      channel,
      ts,
    });
  }

  async addReaction(channel: string, ts: string, emoji: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.reactions.add({
      channel,
      timestamp: ts,
      name: emoji,
    });
  }

  async getUserInfo(userId: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.users.info({
      user: userId,
    });
  }

  async getChannelInfo(channelId: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.conversations.info({
      channel: channelId,
    });
  }

  async listChannels(): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.conversations.list({
      types: 'public_channel,private_channel',
    });
  }

  async uploadFile(channel: string, file: Buffer | string, title?: string): Promise<any> {
    if (!this.client) throw new Error('Slack Bot not configured');

    return this.client.files.upload({
      channels: channel,
      file,
      title: title,
    });
  }

  async startMentionListener(callback: (mention: SlackMention) => void): Promise<void> {
    if (!this.client) throw new Error('Slack Bot not configured');

    // Note: This would require a real socket connection for real-time events
    // For now, we'll emit the event structure
    this.on('mention', callback);
    log.info('Slack: Mention listener registered');
  }

  async sendCodeReview(channel: string, review: {
    title: string;
    file: string;
    changes: number;
    status: 'approved' | 'changes_requested' | 'commented';
    url: string;
    author: string;
  }): Promise<any> {
    const statusEmoji = {
      approved: '✅',
      changes_requested: '🔄',
      commented: '💬',
    };

    return this.sendMessage({
      channel,
      text: `Code Review: ${review.title}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${statusEmoji[review.status]} *Code Review: ${review.title}*`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*File:*\n${review.file}`,
            },
            {
              type: 'mrkdwn',
              text: `*Changes:*\n${review.changes} lines`,
            },
            {
              type: 'mrkdwn',
              text: `*Author:*\n${review.author}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${review.status}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Review',
              },
              url: review.url,
              style: 'primary',
            },
          ],
        },
      ],
    });
  }

  async sendBuildStatus(channel: string, build: {
    pipeline: string;
    branch: string;
    status: 'success' | 'failed' | 'running' | 'pending';
    duration?: string;
    url?: string;
  }): Promise<any> {
    const statusConfig = {
      success: { emoji: '✅', color: '#2eb67d' },
      failed: { emoji: '❌', color: '#e01e5a' },
      running: { emoji: '🔄', color: '#36c5f0' },
      pending: { emoji: '⏳', color: '#ECB22E' },
    };

    const config = statusConfig[build.status];

    return this.sendMessage({
      channel,
      text: `Build ${build.status}: ${build.pipeline}`,
      attachments: [
        {
          color: config.color,
          title: `${config.emoji} Build ${build.pipeline}`,
          fields: [
            { title: 'Branch', value: build.branch, short: true },
            { title: 'Status', value: build.status, short: true },
            ...(build.duration ? [{ title: 'Duration', value: build.duration, short: true }] : []),
          ],
        },
      ],
    });
  }

  async sendAlert(channel: string, alert: {
    severity: 'critical' | 'warning' | 'info';
    title: string;
    message: string;
    source?: string;
  }): Promise<any> {
    const severityConfig = {
      critical: { emoji: '🔴', color: '#e01e5a' },
      warning: { emoji: '⚠️', color: '#ECB22E' },
      info: { emoji: 'ℹ️', color: '#36c5f0' },
    };

    const config = severityConfig[alert.severity];

    return this.sendMessage({
      channel,
      text: `Alert: ${alert.title}`,
      attachments: [
        {
          color: config.color,
          title: `${config.emoji} ${alert.severity.toUpperCase()}: ${alert.title}`,
          text: alert.message,
          fields: alert.source ? [{ title: 'Source', value: alert.source, short: true }] : undefined,
        },
      ],
    });
  }

  isActive(): boolean {
    return this.isConnected && this.client !== null;
  }

  getConfig(): SlackBotConfig | null {
    return this.config ? { ...this.config, token: '***' } : null;
  }

  cleanup(): void {
    this.isConnected = false;
    this.client = null;
    this.config = null;
    this.removeAllListeners();
    log.info('Slack Bot cleaned up');
  }
}

export default SlackBotManager;
