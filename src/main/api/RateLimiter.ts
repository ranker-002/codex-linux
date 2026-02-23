import { EventEmitter } from 'events';
import log from 'electron-log';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  enableBlock: boolean;
  blockDurationMs: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockExpiresAt?: number;
}

export class RateLimiter extends EventEmitter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<RateLimitConfig>) {
    super();
    this.config = {
      windowMs: config?.windowMs || 60000,
      maxRequests: config?.maxRequests || 100,
      enableBlock: config?.enableBlock ?? true,
      blockDurationMs: config?.blockDurationMs || 60000,
    };
  }

  configure(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('RateLimiter configured', this.config);
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.limits.get(identifier);

    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
        blocked: false,
      };
      this.limits.set(identifier, entry);
    }

    if (entry.blocked && entry.blockExpiresAt && now < entry.blockExpiresAt) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.blockExpiresAt,
      };
    }

    if (entry.blocked && (!entry.blockExpiresAt || now >= entry.blockExpiresAt)) {
      entry.blocked = false;
      entry.count = 0;
      entry.resetAt = now + this.config.windowMs;
    }

    entry.count++;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = remaining > 0;

    if (!allowed && this.config.enableBlock) {
      entry.blocked = true;
      entry.blockExpiresAt = now + this.config.blockDurationMs;
      this.emit('blocked', { identifier, expiresAt: entry.blockExpiresAt });
      log.warn(`Rate limit exceeded for ${identifier}`);
    }

    this.emit('check', { identifier, allowed, remaining });

    return {
      allowed,
      remaining,
      resetAt: entry.resetAt,
    };
  }

  reset(identifier: string): boolean {
    const deleted = this.limits.delete(identifier);
    if (deleted) {
      this.emit('reset', { identifier });
    }
    return deleted;
  }

  getRemaining(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (!entry) return this.config.maxRequests;
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  isBlocked(identifier: string): boolean {
    const entry = this.limits.get(identifier);
    if (!entry || !entry.blocked) return false;
    if (entry.blockExpiresAt && Date.now() >= entry.blockExpiresAt) {
      entry.blocked = false;
      return false;
    }
    return true;
  }

  private cleanupStale(): void {
    const now = Date.now();
    let cleaned = 0;

    this.limits.forEach((entry, identifier) => {
      if (now > entry.resetAt && (!entry.blockExpiresAt || now > entry.blockExpiresAt)) {
        this.limits.delete(identifier);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      log.debug(`Cleaned up ${cleaned} rate limit entries`);
    }
  }

  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanupStale(), intervalMs);
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getStats(): { totalIdentifiers: number; blockedCount: number; totalRequests: number } {
    let blockedCount = 0;
    let totalRequests = 0;

    this.limits.forEach((entry) => {
      if (entry.blocked) blockedCount++;
      totalRequests += entry.count;
    });

    return {
      totalIdentifiers: this.limits.size,
      blockedCount,
      totalRequests,
    };
  }

  shutdown(): void {
    this.limits.clear();
    this.stopCleanup();
    this.removeAllListeners();
    log.info('RateLimiter cleaned up');
  }
}

export default RateLimiter;
