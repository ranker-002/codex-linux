import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import crypto from 'crypto';

export interface CachedPrompt {
  id: string;
  name: string;
  content: string;
  contentHash: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  model: string;
  useCount: number;
  hitRate: number;
  totalTokens: number;
  cachedTokens: number;
  lastUsed: Date;
  createdAt: Date;
  expiresAt?: Date;
  metadata: Record<string, unknown>;
}

export interface PromptCacheConfig {
  maxCacheSize: number;
  maxCacheAge: number;
  autoPrune: boolean;
  enableHitRateTracking: boolean;
}

export interface CacheStats {
  totalPrompts: number;
  totalHits: number;
  totalTokens: number;
  cachedTokens: number;
  averageHitRate: number;
  cacheSize: number;
}

export class PromptCacheManager extends EventEmitter {
  private cache: Map<string, CachedPrompt> = new Map();
  private config: PromptCacheConfig;
  private stats = {
    totalHits: 0,
    totalMisses: 0,
    totalTokensSaved: 0,
  };

  constructor(config?: Partial<PromptCacheConfig>) {
    super();
    this.config = {
      maxCacheSize: config?.maxCacheSize || 100,
      maxCacheAge: config?.maxCacheAge || 7 * 24 * 60 * 60 * 1000,
      autoPrune: config?.autoPrune ?? true,
      enableHitRateTracking: config?.enableHitRateTracking ?? true,
    };
  }

  configure(config: Partial<PromptCacheConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('PromptCacheManager configured', this.config);
  }

  getConfig(): PromptCacheConfig {
    return { ...this.config };
  }

  generateContentHash(content: string, systemPrompt?: string): string {
    const combined = `${systemPrompt || ''}:${content}`;
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  cachePrompt(
    name: string,
    content: string,
    options: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
      model?: string;
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    } = {}
  ): CachedPrompt {
    const contentHash = this.generateContentHash(content, options.systemPrompt);
    const existing = Array.from(this.cache.values()).find(
      (p) => p.contentHash === contentHash
    );

    if (existing) {
      existing.useCount++;
      existing.lastUsed = new Date();
      this.emit('cache:hit', existing);
      return existing;
    }

    if (this.cache.size >= this.config.maxCacheSize && this.config.autoPrune) {
      this.prune();
    }

    const prompt: CachedPrompt = {
      id: uuidv4(),
      name,
      content,
      contentHash,
      systemPrompt: options.systemPrompt,
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
      model: options.model || 'gpt-4o',
      useCount: 1,
      hitRate: 0,
      totalTokens: 0,
      cachedTokens: Math.ceil(content.split(' ').length / 0.75),
      lastUsed: new Date(),
      createdAt: new Date(),
      expiresAt: options.expiresAt,
      metadata: options.metadata || {},
    };

    this.cache.set(prompt.id, prompt);
    this.emit('cache:stored', prompt);
    log.info(`Prompt cached: ${name} (${contentHash})`);

    return prompt;
  }

  getCachedPrompt(
    content: string,
    systemPrompt?: string
  ): CachedPrompt | null {
    const contentHash = this.generateContentHash(content, systemPrompt);
    const prompt = Array.from(this.cache.values()).find(
      (p) => p.contentHash === contentHash
    );

    if (prompt) {
      if (prompt.expiresAt && prompt.expiresAt < new Date()) {
        this.cache.delete(prompt.id);
        this.emit('cache:expired', prompt);
        return null;
      }

      prompt.useCount++;
      prompt.lastUsed = new Date();
      this.stats.totalHits++;
      this.stats.totalTokensSaved += prompt.cachedTokens;
      this.updateHitRate(prompt);
      this.emit('cache:hit', prompt);
      log.debug(`Cache hit: ${prompt.name}`);
      return prompt;
    }

    this.stats.totalMisses++;
    this.emit('cache:miss', { contentHash });
    return null;
  }

  private updateHitRate(prompt: CachedPrompt): void {
    if (this.config.enableHitRateTracking) {
      const total = this.stats.totalHits + this.stats.totalMisses;
      prompt.hitRate = total > 0 ? this.stats.totalHits / total : 0;
    }
  }

  getPrompt(id: string): CachedPrompt | undefined {
    return this.cache.get(id);
  }

  listPrompts(): CachedPrompt[] {
    return Array.from(this.cache.values()).sort(
      (a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()
    );
  }

  searchPrompts(query: string): CachedPrompt[] {
    const lowerQuery = query.toLowerCase();
    return this.listPrompts().filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.content.toLowerCase().includes(lowerQuery) ||
        p.systemPrompt?.toLowerCase().includes(lowerQuery)
    );
  }

  updatePrompt(
    id: string,
    updates: Partial<Omit<CachedPrompt, 'id' | 'contentHash' | 'createdAt'>>
  ): CachedPrompt | null {
    const prompt = this.cache.get(id);
    if (!prompt) return null;

    Object.assign(prompt, updates, { lastUsed: new Date() });
    this.emit('cache:updated', prompt);
    return prompt;
  }

  deletePrompt(id: string): boolean {
    const prompt = this.cache.get(id);
    if (!prompt) return false;

    this.cache.delete(id);
    this.emit('cache:deleted', prompt);
    log.info(`Prompt deleted: ${prompt.name}`);
    return true;
  }

  prune(): number {
    const now = new Date();
    let pruned = 0;

    for (const [id, prompt] of this.cache) {
      const isExpired = prompt.expiresAt && prompt.expiresAt < now;
      const isOld = now.getTime() - prompt.lastUsed.getTime() > this.config.maxCacheAge;
      const isLowHitRate = prompt.hitRate < 0.1 && prompt.useCount > 10;

      if (isExpired || (this.config.autoPrune && (isOld || isLowHitRate))) {
        this.cache.delete(id);
        pruned++;
        this.emit('cache:pruned', prompt);
      }
    }

    if (pruned > 0) {
      log.info(`Pruned ${pruned} prompts from cache`);
    }

    return pruned;
  }

  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.emit('cache:cleared', { count });
    log.info(`Cleared ${count} cached prompts`);
  }

  getStats(): CacheStats {
    const prompts = this.listPrompts();
    const totalTokens = prompts.reduce((sum, p) => sum + p.totalTokens, 0);
    const cachedTokens = prompts.reduce((sum, p) => sum + p.cachedTokens, 0);
    const totalHits = prompts.reduce((sum, p) => sum + p.useCount, 0);

    return {
      totalPrompts: prompts.length,
      totalHits,
      totalTokens,
      cachedTokens,
      averageHitRate:
        prompts.length > 0
          ? prompts.reduce((sum, p) => sum + p.hitRate, 0) / prompts.length
          : 0,
      cacheSize: JSON.stringify(Array.from(this.cache.values())).length,
    };
  }

  exportCache(): CachedPrompt[] {
    return this.listPrompts();
  }

  importCache(prompts: CachedPrompt[]): number {
    let imported = 0;
    for (const prompt of prompts) {
      if (!this.cache.has(prompt.id)) {
        this.cache.set(prompt.id, prompt);
        imported++;
      }
    }
    log.info(`Imported ${imported} cached prompts`);
    return imported;
  }

  cleanup(): void {
    this.cache.clear();
    this.removeAllListeners();
    log.info('PromptCacheManager cleaned up');
  }
}

export default PromptCacheManager;
