import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RecoveryStrategy = 'retry' | 'fallback' | 'graceful_degradation' | 'ignore' | 'escalate';
export type ErrorCategory = 'network' | 'timeout' | 'authentication' | 'rate_limit' | 'validation' | 'system' | 'unknown';

export interface ErrorContext {
  timestamp: Date;
  service: string;
  operation: string;
  metadata?: Record<string, unknown>;
}

export interface TrackedError {
  id: string;
  name: string;
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  recoveryStrategy: RecoveryStrategy;
  retryCount: number;
  maxRetries: number;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface RecoveryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBackoff: boolean;
  enableAutoRecovery: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  resolved: number;
  unresolved: number;
  recoverySuccessRate: number;
}

export class ErrorRecoveryManager extends EventEmitter {
  private errors: Map<string, TrackedError> = new Map();
  private config: RecoveryConfig;
  private recoveryQueue: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<RecoveryConfig>) {
    super();
    this.config = {
      maxRetries: config?.maxRetries || 3,
      baseDelay: config?.baseDelay || 1000,
      maxDelay: config?.maxDelay || 30000,
      exponentialBackoff: config?.exponentialBackoff ?? true,
      enableAutoRecovery: config?.enableAutoRecovery ?? true,
    };
  }

  configure(config: Partial<RecoveryConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('ErrorRecoveryManager configured', this.config);
  }

  getConfig(): RecoveryConfig {
    return { ...this.config };
  }

  private categorizeError(error: Error | string): ErrorCategory {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('enosys')) {
      return 'network';
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('etimedout')) {
      return 'timeout';
    }
    if (lowerMessage.includes('auth') || lowerMessage.includes('token') || lowerMessage.includes('unauthorized')) {
      return 'authentication';
    }
    if (lowerMessage.includes('rate') || lowerMessage.includes('429') || lowerMessage.includes('too many')) {
      return 'rate_limit';
    }
    if (lowerMessage.includes('validation') || lowerMessage.includes('invalid') || lowerMessage.includes('schema')) {
      return 'validation';
    }
    if (lowerMessage.includes('enoent') || lowerMessage.includes('permission') || lowerMessage.includes('eacces')) {
      return 'system';
    }

    return 'unknown';
  }

  private determineSeverity(error: Error | string): ErrorSeverity {
    const message = typeof error === 'string' ? error : error.message;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('fatal') || lowerMessage.includes('critical') || lowerMessage.includes('crash')) {
      return 'critical';
    }
    if (lowerMessage.includes('error') || lowerMessage.includes('failed')) {
      return 'high';
    }
    if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) {
      return 'medium';
    }

    return 'low';
  }

  private determineStrategy(category: ErrorCategory): RecoveryStrategy {
    switch (category) {
      case 'network':
        return 'retry';
      case 'timeout':
        return 'retry';
      case 'authentication':
        return 'fallback';
      case 'rate_limit':
        return 'graceful_degradation';
      case 'validation':
        return 'ignore';
      case 'system':
        return 'escalate';
      default:
        return 'retry';
    }
  }

  trackError(
    error: Error | string,
    context: ErrorContext,
    options: {
      severity?: ErrorSeverity;
      recoveryStrategy?: RecoveryStrategy;
      maxRetries?: number;
    } = {}
  ): TrackedError {
    const trackedError: TrackedError = {
      id: uuidv4(),
      name: error instanceof Error ? error.name : 'UnknownError',
      message: typeof error === 'string' ? error : error.message,
      stack: error instanceof Error ? error.stack : undefined,
      category: this.categorizeError(error),
      severity: options.severity || this.determineSeverity(error),
      context,
      recoveryStrategy: options.recoveryStrategy || this.determineStrategy(this.categorizeError(error)),
      retryCount: 0,
      maxRetries: options.maxRetries || this.config.maxRetries,
      resolved: false,
    };

    this.errors.set(trackedError.id, trackedError);
    this.emit('error:tracked', trackedError);
    log.error(`Error tracked: ${trackedError.name} in ${context.service}`, {
      category: trackedError.category,
      severity: trackedError.severity,
    });

    if (this.config.enableAutoRecovery) {
      this.attemptRecovery(trackedError.id);
    }

    return trackedError;
  }

  private calculateDelay(error: TrackedError): number {
    const { baseDelay, maxDelay, exponentialBackoff } = this.config;
    
    if (exponentialBackoff) {
      const delay = Math.min(baseDelay * Math.pow(2, error.retryCount), maxDelay);
      const jitter = Math.random() * 0.3 * delay;
      return Math.floor(delay + jitter);
    }

    return Math.min(baseDelay * (error.retryCount + 1), maxDelay);
  }

  private attemptRecovery(errorId: string): void {
    const error = this.errors.get(errorId);
    if (!error || error.resolved || error.retryCount >= error.maxRetries) {
      return;
    }

    const delay = this.calculateDelay(error);

    const timeout = setTimeout(() => {
      this.recoveryQueue.delete(errorId);
      this.executeRecovery(errorId);
    }, delay);

    this.recoveryQueue.set(errorId, timeout);
    this.emit('recovery:scheduled', { error, delay });
  }

  private async executeRecovery(errorId: string): Promise<void> {
    const error = this.errors.get(errorId);
    if (!error || error.resolved) return;

    error.retryCount++;
    this.emit('recovery:attempted', { error, attempt: error.retryCount });

    switch (error.recoveryStrategy) {
      case 'retry':
        this.emit('recovery:retry', {
          error,
          attempt: error.retryCount,
          maxRetries: error.maxRetries,
        });
        break;

      case 'fallback':
        this.emit('recovery:fallback', { error });
        break;

      case 'graceful_degradation':
        this.emit('recovery:degraded', { error });
        break;

      case 'ignore':
        this.resolveError(errorId);
        break;

      case 'escalate':
        this.emit('recovery:escalated', { error });
        break;
    }

    if (error.retryCount < error.maxRetries && !error.resolved) {
      this.attemptRecovery(errorId);
    } else if (!error.resolved) {
      this.emit('recovery:failed', { error });
    }
  }

  resolveError(errorId: string, resolved: boolean = true): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.resolved = resolved;
    error.resolvedAt = new Date();

    const timeout = this.recoveryQueue.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      this.recoveryQueue.delete(errorId);
    }

    this.emit('error:resolved', error);
    log.info(`Error resolved: ${errorId}`);

    return true;
  }

  retryNow(errorId: string): boolean {
    const error = this.errors.get(errorId);
    if (!error) return false;

    error.retryCount = 0;
    this.attemptRecovery(errorId);

    return true;
  }

  getError(id: string): TrackedError | undefined {
    return this.errors.get(id);
  }

  getActiveErrors(): TrackedError[] {
    return Array.from(this.errors.values()).filter((e) => !e.resolved);
  }

  getErrorsByCategory(category: ErrorCategory): TrackedError[] {
    return Array.from(this.errors.values()).filter((e) => e.category === category);
  }

  getErrorsBySeverity(severity: ErrorSeverity): TrackedError[] {
    return Array.from(this.errors.values()).filter((e) => e.severity === severity);
  }

  getErrorHistory(limit?: number): TrackedError[] {
    const all = Array.from(this.errors.values()).sort(
      (a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime()
    );
    return limit ? all.slice(0, limit) : all;
  }

  clearResolved(): number {
    const resolved = Array.from(this.errors.values()).filter((e) => e.resolved);
    resolved.forEach((e) => this.errors.delete(e.id));
    
    const count = resolved.length;
    if (count > 0) {
      log.info(`Cleared ${count} resolved errors`);
    }
    return count;
  }

  clearAll(): void {
    this.recoveryQueue.forEach((timeout) => clearTimeout(timeout));
    this.recoveryQueue.clear();
    this.errors.clear();
    this.emit('errors:cleared');
    log.info('All errors cleared');
  }

  getStats(): ErrorStats {
    const errors = Array.from(this.errors.values());
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      timeout: 0,
      authentication: 0,
      rate_limit: 0,
      validation: 0,
      system: 0,
      unknown: 0,
    };
    const bySeverity: Record<ErrorSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    let resolved = 0;
    let recoverySuccess = 0;

    errors.forEach((e) => {
      byCategory[e.category]++;
      bySeverity[e.severity]++;
      if (e.resolved) resolved++;
      if (e.resolved && e.retryCount > 0) recoverySuccess++;
    });

    return {
      totalErrors: errors.length,
      byCategory,
      bySeverity,
      resolved,
      unresolved: errors.length - resolved,
      recoverySuccessRate: resolved > 0 ? recoverySuccess / resolved : 0,
    };
  }

  cleanup(): void {
    this.recoveryQueue.forEach((timeout) => clearTimeout(timeout));
    this.recoveryQueue.clear();
    this.errors.clear();
    this.removeAllListeners();
    log.info('ErrorRecoveryManager cleaned up');
  }
}

export default ErrorRecoveryManager;
