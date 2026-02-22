import { app } from 'electron';
import log from 'electron-log';

export class ErrorTracker {
  private isInitialized = false;
  private dsn?: string;

  initialize(dsn?: string): void {
    if (!dsn) {
      log.warn('Error tracking DSN not provided, error tracking disabled');
      return;
    }

    this.dsn = dsn;
    this.isInitialized = true;
    log.info('Error tracker initialized with DSN:', dsn ? 'configured' : 'none');
  }

  private shouldIgnoreError(event: any): boolean {
    if (!event || !event.exception) return false;
    
    const ignoredPatterns = [
      'ResizeObserver',
      'NetworkError',
      'chrome-extension'
    ];
    
    const message = JSON.stringify(event.exception);
    return ignoredPatterns.some(pattern => message.includes(pattern));
  }

  captureException(error: Error, context?: Record<string, any>): void {
    if (!this.isInitialized) return;
    
    log.error('Captured exception:', error.message, context);
    
    if (this.dsn) {
      // In production, would send to Sentry
      // For now, just log
    }
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isInitialized) return;
    
    log[level]('Captured message:', message);
  }

  setUser(user: { id: string; email?: string; username?: string }): void {
    if (!this.isInitialized) return;
    
    log.info('Setting user context:', user.id);
  }

  addBreadcrumb(breadcrumb: { category?: string; message?: string; level?: string }): void {
    if (!this.isInitialized) return;
    
    log.debug('Breadcrumb:', breadcrumb);
  }
}
