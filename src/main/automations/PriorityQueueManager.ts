import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export type PriorityLevel = 'critical' | 'high' | 'normal' | 'low' | 'background';

export type PriorityEntityType = 'task' | 'agent' | 'message' | 'request';

export interface PriorityItem {
  id: string;
  type: PriorityEntityType;
  priority: PriorityLevel;
  score: number;
  data: unknown;
  createdAt: Date;
  scheduledAt?: Date;
  deadline?: Date;
  metadata: Record<string, unknown>;
}

export interface PriorityConfig {
  defaultPriority: PriorityLevel;
  maxQueueSize: number;
  enableDeadline: boolean;
  priorityBoost: number;
}

export interface QueueStats {
  totalItems: number;
  byPriority: Record<PriorityLevel, number>;
  averageWaitTime: number;
  processedCount: number;
}

export class PriorityQueueManager extends EventEmitter {
  private queue: PriorityItem[] = [];
  private config: PriorityConfig;
  private processedCount = 0;
  private startTimes: Map<string, number> = new Map();

  constructor(config?: Partial<PriorityConfig>) {
    super();
    this.config = {
      defaultPriority: config?.defaultPriority || 'normal',
      maxQueueSize: config?.maxQueueSize || 1000,
      enableDeadline: config?.enableDeadline ?? true,
      priorityBoost: config?.priorityBoost || 10,
    };
  }

  configure(config: Partial<PriorityConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('PriorityQueueManager configured', this.config);
  }

  getConfig(): PriorityConfig {
    return { ...this.config };
  }

  private calculateScore(item: PriorityItem): number {
    const priorityScores: Record<PriorityLevel, number> = {
      critical: 100,
      high: 75,
      normal: 50,
      low: 25,
      background: 10,
    };

    let score = priorityScores[item.priority] || 50;

    if (item.deadline && this.config.enableDeadline) {
      const timeUntilDeadline = item.deadline.getTime() - Date.now();
      if (timeUntilDeadline < 0) {
        score += 50;
      } else if (timeUntilDeadline < 3600000) {
        score += Math.floor(1000000 / timeUntilDeadline);
      }
    }

    if (item.scheduledAt) {
      const waitTime = item.scheduledAt.getTime() - Date.now();
      if (waitTime < 0) {
        score += Math.min(20, Math.floor(-waitTime / 60000));
      }
    }

    const age = Date.now() - item.createdAt.getTime();
    score += Math.min(10, Math.floor(age / 300000));

    return score;
  }

  private reindex(): void {
    this.queue.forEach((item) => {
      item.score = this.calculateScore(item);
    });
    this.queue.sort((a, b) => b.score - a.score);
  }

  enqueue(
    type: PriorityEntityType,
    data: unknown,
    options: {
      priority?: PriorityLevel;
      deadline?: Date;
      scheduledAt?: Date;
      metadata?: Record<string, unknown>;
    } = {}
  ): PriorityItem {
    if (this.queue.length >= this.config.maxQueueSize) {
      this.evictLowest();
    }

    const item: PriorityItem = {
      id: uuidv4(),
      type,
      priority: options.priority || this.config.defaultPriority,
      score: 0,
      data,
      createdAt: new Date(),
      deadline: options.deadline,
      scheduledAt: options.scheduledAt,
      metadata: options.metadata || {},
    };

    item.score = this.calculateScore(item);
    this.queue.push(item);
    this.startTimes.set(item.id, Date.now());
    this.reindex();

    this.emit('item:enqueued', item);
    log.debug(`Item enqueued: ${type} with priority ${item.priority}`);

    return item;
  }

  dequeue(): PriorityItem | null {
    const now = new Date();
    
    const readyItems = this.queue.filter(
      (item) => !item.scheduledAt || item.scheduledAt <= now
    );

    if (readyItems.length === 0) return null;

    const item = readyItems[0];
    this.queue = this.queue.filter((i) => i.id !== item.id);
    this.startTimes.delete(item.id);
    this.processedCount++;

    this.emit('item:dequeued', item);
    log.debug(`Item dequeued: ${item.type} with score ${item.score}`);

    return item;
  }

  peek(): PriorityItem | null {
    const now = new Date();
    const readyItems = this.queue.filter(
      (item) => !item.scheduledAt || item.scheduledAt <= now
    );
    return readyItems.length > 0 ? readyItems[0] : null;
  }

  get(id: string): PriorityItem | undefined {
    return this.queue.find((item) => item.id === id);
  }

  updatePriority(id: string, priority: PriorityLevel): boolean {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return false;

    item.priority = priority;
    item.score = this.calculateScore(item);
    this.reindex();

    this.emit('priority:updated', item);
    log.debug(`Priority updated for ${id}: ${priority}`);
    return true;
  }

  boostPriority(id: string, boost: number = 1): boolean {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return false;

    const priorityScores: Record<PriorityLevel, number> = {
      critical: 100,
      high: 75,
      normal: 50,
      low: 25,
      background: 10,
    };

    const currentIndex = Object.keys(priorityScores).indexOf(item.priority);
    const newIndex = Math.max(0, currentIndex - boost);
    const newPriority = Object.keys(priorityScores)[newIndex] as PriorityLevel;
    
    item.priority = newPriority;
    item.score = this.calculateScore(item);
    this.reindex();

    this.emit('priority:boosted', item);
    return true;
  }

  reschedule(id: string, scheduledAt: Date): boolean {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return false;

    item.scheduledAt = scheduledAt;
    item.score = this.calculateScore(item);
    this.reindex();

    this.emit('item:rescheduled', item);
    return true;
  }

  setDeadline(id: string, deadline: Date): boolean {
    const item = this.queue.find((i) => i.id === id);
    if (!item) return false;

    item.deadline = deadline;
    item.score = this.calculateScore(item);
    this.reindex();

    this.emit('deadline:set', item);
    return true;
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex((i) => i.id === id);
    if (index === -1) return false;

    const item = this.queue[index];
    this.queue.splice(index, 1);
    this.startTimes.delete(id);

    this.emit('item:removed', item);
    return true;
  }

  cancel(predicate: (item: PriorityItem) => boolean): number {
    const toRemove = this.queue.filter(predicate);
    toRemove.forEach((item) => {
      this.queue = this.queue.filter((i) => i.id !== item.id);
      this.startTimes.delete(item.id);
      this.emit('item:cancelled', item);
    });
    return toRemove.length;
  }

  private evictLowest(): void {
    if (this.queue.length === 0) return;

    const lowest = this.queue[this.queue.length - 1];
    this.queue.pop();
    this.startTimes.delete(lowest.id);
    this.emit('item:evicted', lowest);
    log.debug(`Evicted lowest priority item: ${lowest.id}`);
  }

  getQueue(filter?: {
    type?: PriorityEntityType;
    priority?: PriorityLevel;
    scheduled?: boolean;
  }): PriorityItem[] {
    let items = [...this.queue];

    if (filter?.type) {
      items = items.filter((i) => i.type === filter.type);
    }
    if (filter?.priority) {
      items = items.filter((i) => i.priority === filter.priority);
    }
    if (filter?.scheduled !== undefined) {
      items = items.filter((i) =>
        filter.scheduled ? !!i.scheduledAt : !i.scheduledAt
      );
    }

    return items;
  }

  getStats(): QueueStats {
    const byPriority: Record<PriorityLevel, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0,
    };

    let totalWaitTime = 0;

    this.queue.forEach((item) => {
      byPriority[item.priority]++;
      const startTime = this.startTimes.get(item.id);
      if (startTime) {
        totalWaitTime += Date.now() - startTime;
      }
    });

    return {
      totalItems: this.queue.length,
      byPriority,
      averageWaitTime:
        this.queue.length > 0 ? totalWaitTime / this.queue.length : 0,
      processedCount: this.processedCount,
    };
  }

  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    this.startTimes.clear();
    this.emit('queue:cleared', { count });
    log.info(`Cleared ${count} items from priority queue`);
  }

  cleanup(): void {
    this.queue = [];
    this.startTimes.clear();
    this.removeAllListeners();
    log.info('PriorityQueueManager cleaned up');
  }
}

export default PriorityQueueManager;
