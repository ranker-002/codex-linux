import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { WebSocketManager } from '../api/WebSocketManager';

export type StreamEventType = 
  | 'agent:message'
  | 'agent:chunk'
  | 'agent:complete'
  | 'agent:error'
  | 'task:progress'
  | 'task:complete'
  | 'task:error'
  | 'system:status'
  | 'file:changed'
  | 'terminal:output';

export interface StreamEvent {
  id: string;
  type: StreamEventType;
  sourceId: string;
  data: unknown;
  timestamp: Date;
}

export interface StreamProgress {
  sourceId: string;
  progress: number;
  total?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamingSubscription {
  id: string;
  subscriberId: string;
  events: StreamEventType[];
  filters?: {
    agentId?: string;
    taskId?: string;
  };
  createdAt: Date;
}

export class StreamingManager extends EventEmitter {
  private wsManager: WebSocketManager | null = null;
  private subscriptions: Map<string, StreamingSubscription> = new Map();
  private activeStreams: Map<string, { startTime: Date; eventCount: number }> = new Map();
  private config: {
    enableWebSocket: boolean;
    port: number;
    enableIPC: boolean;
  };

  constructor(config?: { enableWebSocket?: boolean; port?: number; enableIPC?: boolean }) {
    super();
    this.config = {
      enableWebSocket: config?.enableWebSocket ?? true,
      port: config?.port || 3002,
      enableIPC: config?.enableIPC ?? true,
    };
  }

  configure(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
    log.info('StreamingManager configured', this.config);
  }

  getConfig() {
    return { ...this.config };
  }

  initialize(httpServer?: unknown): void {
    if (this.config.enableWebSocket) {
      this.wsManager = new WebSocketManager({ port: this.config.port });
      this.wsManager.initialize(httpServer as Parameters<typeof this.wsManager.initialize>[0]);
      this.setupWebSocketHandlers();
      log.info('StreamingManager WebSocket initialized', { port: this.config.port });
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsManager) return;

    this.wsManager.on('client:connected', (data: { clientId: string }) => {
      this.emit('client:connected', data);
      log.debug(`Streaming client connected: ${data.clientId}`);
    });

    this.wsManager.on('client:disconnected', (data: { clientId: string }) => {
      this.cleanupClientSubscriptions(data.clientId);
      this.emit('client:disconnected', data);
    });

    this.wsManager.on('message:received', (data: { clientId: string; data: unknown }) => {
      this.handleClientMessage(data.clientId, data.data);
    });
  }

  private handleClientMessage(clientId: string, data: unknown): void {
    const message = data as { action?: string; payload?: unknown };
    
    if (message.action === 'subscribe') {
      const payload = message.payload as { events: StreamEventType[]; filters?: Record<string, string> };
      this.createSubscription(clientId, payload.events, payload.filters);
    } else if (message.action === 'unsubscribe') {
      const subscriptionId = message.payload as string;
      this.removeSubscription(subscriptionId);
    }
  }

  private createSubscription(
    subscriberId: string,
    events: StreamEventType[],
    filters?: Record<string, string>
  ): StreamingSubscription {
    const subscription: StreamingSubscription = {
      id: uuidv4(),
      subscriberId,
      events,
      filters: filters as StreamingSubscription['filters'],
      createdAt: new Date(),
    };

    this.subscriptions.set(subscription.id, subscription);
    
    if (this.wsManager) {
      this.wsManager.sendToClient(subscriberId, 'subscribed', { 
        subscriptionId: subscription.id, 
        events 
      });
    }

    this.emit('subscription:created', subscription);
    return subscription;
  }

  private removeSubscription(subscriptionId: string): boolean {
    const deleted = this.subscriptions.delete(subscriptionId);
    if (deleted) {
      this.emit('subscription:removed', { subscriptionId });
    }
    return deleted;
  }

  private cleanupClientSubscriptions(clientId: string): void {
    const toRemove: string[] = [];
    this.subscriptions.forEach((sub, id) => {
      if (sub.subscriberId === clientId) {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => this.subscriptions.delete(id));
  }

  private shouldSendEvent(eventType: StreamEventType, sourceId: string): StreamingSubscription[] {
    const matching: StreamingSubscription[] = [];
    
    this.subscriptions.forEach((sub) => {
      if (sub.events.includes(eventType)) {
        if (sub.filters) {
          if (sub.filters.agentId && sub.filters.agentId !== sourceId) return;
          if (sub.filters.taskId && sub.filters.taskId !== sourceId) return;
        }
        matching.push(sub);
      }
    });

    return matching;
  }

  private emitEvent(type: StreamEventType, sourceId: string, data: unknown): void {
    const event: StreamEvent = {
      id: uuidv4(),
      type,
      sourceId,
      data,
      timestamp: new Date(),
    };

    if (this.wsManager) {
      const subscribers = this.shouldSendEvent(type, sourceId);
      subscribers.forEach((sub) => {
        this.wsManager?.sendToClient(sub.subscriberId, type, event);
      });
    }

    this.emit(type, event);
  }

  streamAgentMessage(agentId: string, chunk: string): void {
    this.emitEvent('agent:chunk', agentId, { chunk, agentId });
  }

  streamAgentComplete(agentId: string, message: string): void {
    this.emitEvent('agent:complete', agentId, { message, agentId });
  }

  streamAgentError(agentId: string, error: string): void {
    this.emitEvent('agent:error', agentId, { error, agentId });
  }

  streamTaskProgress(taskId: string, progress: StreamProgress): void {
    this.emitEvent('task:progress', taskId, progress);
  }

  streamTaskComplete(taskId: string, result: unknown): void {
    this.emitEvent('task:complete', taskId, { result, taskId });
  }

  streamTaskError(taskId: string, error: string): void {
    this.emitEvent('task:error', taskId, { error, taskId });
  }

  broadcastSystemStatus(status: unknown): void {
    this.emitEvent('system:status', 'system', status);
  }

  streamFileChanged(filePath: string, change: unknown): void {
    this.emitEvent('file:changed', filePath, { change, filePath });
  }

  streamTerminalOutput(terminalId: string, output: string): void {
    this.emitEvent('terminal:output', terminalId, { output, terminalId });
  }

  startStream(streamId: string): void {
    this.activeStreams.set(streamId, {
      startTime: new Date(),
      eventCount: 0,
    });
    log.debug(`Stream started: ${streamId}`);
  }

  endStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      const duration = Date.now() - stream.startTime.getTime();
      log.debug(`Stream ended: ${streamId}`, { 
        duration, 
        events: stream.eventCount 
      });
      this.activeStreams.delete(streamId);
    }
  }

  subscribeToAgent(subscriberId: string, agentId: string): StreamingSubscription {
    return this.createSubscription(subscriberId, [
      'agent:message',
      'agent:chunk',
      'agent:complete',
      'agent:error',
    ], { agentId });
  }

  subscribeToTask(subscriberId: string, taskId: string): StreamingSubscription {
    return this.createSubscription(subscriberId, [
      'task:progress',
      'task:complete',
      'task:error',
    ], { taskId });
  }

  getSubscriptions(subscriberId?: string): StreamingSubscription[] {
    if (subscriberId) {
      return Array.from(this.subscriptions.values())
        .filter((s) => s.subscriberId === subscriberId);
    }
    return Array.from(this.subscriptions.values());
  }

  getActiveStreams(): Map<string, { startTime: Date; eventCount: number }> {
    return new Map(this.activeStreams);
  }

  getStats(): {
    activeStreams: number;
    totalSubscriptions: number;
    wsClients: number;
  } {
    return {
      activeStreams: this.activeStreams.size,
      totalSubscriptions: this.subscriptions.size,
      wsClients: this.wsManager?.getClientCount() || 0,
    };
  }

  shutdown(): void {
    if (this.wsManager) {
      this.wsManager.shutdown();
      this.wsManager = null;
    }
    this.subscriptions.clear();
    this.activeStreams.clear();
    this.emit('shutdown');
    log.info('StreamingManager shutdown');
  }

  cleanup(): void {
    this.shutdown();
    this.removeAllListeners();
    log.info('StreamingManager cleaned up');
  }
}

export default StreamingManager;
