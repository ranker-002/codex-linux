import { EventEmitter } from 'events';
import log from 'electron-log';
import { AgentMessage } from '../../shared/types';
import { ContextCompactionConfig, PromptCacheConfig, CompactionResult } from '../../shared/types';

export class ContextOptimizer extends EventEmitter {
  private compactionConfig: ContextCompactionConfig;
  private cacheConfig: PromptCacheConfig;
  private messageCache: Map<string, { timestamp: number; content: string; tokens: number }> = new Map();

  constructor() {
    super();
    this.compactionConfig = {
      enabled: true,
      threshold: 100000,
      strategy: 'summarize',
    };
    this.cacheConfig = {
      enabled: true,
      ttl: 3600, // 1 hour
      maxSize: 100,
    };
  }

  configure(config: { compaction?: Partial<ContextCompactionConfig>; cache?: Partial<PromptCacheConfig> }): void {
    if (config.compaction) {
      this.compactionConfig = { ...this.compactionConfig, ...config.compaction };
    }
    if (config.cache) {
      this.cacheConfig = { ...this.cacheConfig, ...config.cache };
    }
    log.info('ContextOptimizer configured', { compaction: this.compactionConfig, cache: this.cacheConfig });
  }

  // Estimate tokens (rough approximation)
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Check if compaction is needed
  needsCompaction(messages: AgentMessage[]): boolean {
    if (!this.compactionConfig.enabled) return false;

    const totalTokens = messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
    return totalTokens > this.compactionConfig.threshold;
  }

  // Compact messages based on strategy
  compactMessages(messages: AgentMessage[], strategy?: 'summarize' | 'prune' | 'hybrid'): CompactionResult {
    const useStrategy = strategy || this.compactionConfig.strategy;
    const originalTokens = messages.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);
    let compacted: AgentMessage[];

    switch (useStrategy) {
      case 'summarize':
        compacted = this.summarizeMessages(messages);
        break;
      case 'prune':
        compacted = this.pruneMessages(messages);
        break;
      case 'hybrid':
        compacted = this.hybridCompact(messages);
        break;
      default:
        compacted = messages;
    }

    const compactedTokens = compacted.reduce((sum, msg) => sum + this.estimateTokens(msg.content), 0);

    const result: CompactionResult = {
      originalTokens,
      compactedTokens,
      removedMessages: messages.length - compacted.length,
    };

    this.emit('compacted', result);
    return result;
  }

  private summarizeMessages(messages: AgentMessage[]): AgentMessage[] {
    // Keep system message and most recent messages
    const systemMsg = messages.find(m => m.role === 'system');
    const recentMsgs = messages
      .filter(m => m.role !== 'system')
      .slice(-10); // Keep last 10 messages

    if (!systemMsg) return recentMsgs;

    // Create summary of older messages
    const olderMsgs = messages.filter(m => m.role !== 'system').slice(0, -10);
    if (olderMsgs.length > 0) {
      const summaryMsg: AgentMessage = {
        id: `summary_${Date.now()}`,
        role: 'system',
        content: `[Previous ${olderMsgs.length} messages summarized]`,
        timestamp: new Date(),
        metadata: {
          summary: true,
          messageCount: olderMsgs.length,
          totalTokens: olderMsgs.reduce((s, m) => s + this.estimateTokens(m.content), 0),
        },
      };
      return [systemMsg, summaryMsg, ...recentMsgs];
    }

    return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
  }

  private pruneMessages(messages: AgentMessage[]): AgentMessage[] {
    // Keep only system message and last N messages
    const systemMsg = messages.find(m => m.role === 'system');
    const recentMsgs = messages
      .filter(m => m.role !== 'system')
      .slice(-20);

    return systemMsg ? [systemMsg, ...recentMsgs] : recentMsgs;
  }

  private hybridCompact(messages: AgentMessage[]): AgentMessage[] {
    // Combine both strategies
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    // Keep last 5 messages fully
    const recent = nonSystem.slice(-5);
    // Summarize middle messages
    const middle = nonSystem.slice(-20, -5);
    // Prune oldest messages
    const old = nonSystem.slice(0, -20);

    const compacted: AgentMessage[] = [];

    if (systemMsg) compacted.push(systemMsg);
    if (old.length > 0) {
      compacted.push({
        id: `compacted_${Date.now()}`,
        role: 'system',
        content: `[${old.length} older messages removed]`,
        timestamp: new Date(),
      });
    }
    if (middle.length > 0) {
      compacted.push({
        id: `summarized_${Date.now()}`,
        role: 'system',
        content: `[${middle.length} messages summarized]`,
        timestamp: new Date(),
      });
    }
    compacted.push(...recent);

    return compacted;
  }

  // Prompt caching
  cachePrompt(key: string, content: string): void {
    if (!this.cacheConfig.enabled) return;

    // Evict old entries if cache is full
    if (this.messageCache.size >= this.cacheConfig.maxSize) {
      const oldest = Array.from(this.messageCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.messageCache.delete(oldest[0]);
    }

    this.messageCache.set(key, {
      timestamp: Date.now(),
      content,
      tokens: this.estimateTokens(content),
    });

    this.emit('cached', { key, tokens: this.estimateTokens(content) });
  }

  getCachedPrompt(key: string): string | null {
    const cached = this.messageCache.get(key);
    if (!cached) return null;

    // Check TTL
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age > this.cacheConfig.ttl) {
      this.messageCache.delete(key);
      return null;
    }

    this.emit('cache:hit', key);
    return cached.content;
  }

  clearCache(): void {
    this.messageCache.clear();
    this.emit('cache:cleared');
  }

  getCacheStats(): { size: number; totalTokens: number; hitRate: number } {
    const totalTokens = Array.from(this.messageCache.values())
      .reduce((sum, v) => sum + v.tokens, 0);

    return {
      size: this.messageCache.size,
      totalTokens,
      hitRate: 0, // Would need to track hits separately
    };
  }

  getConfig(): { compaction: ContextCompactionConfig; cache: PromptCacheConfig } {
    return {
      compaction: { ...this.compactionConfig },
      cache: { ...this.cacheConfig },
    };
  }
}

export default ContextOptimizer;
