import { EventEmitter } from 'events';
import log from 'electron-log';

interface MetricValue {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: MetricValue[];
  labels?: string[];
}

export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, Metric> = new Map();
  private retentionMs = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout | undefined;

  constructor() {
    super();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000); // Every hour
  }

  // Counter - cumulative metric
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'counter');
    metric.values.push({
      timestamp: Date.now(),
      value,
      tags,
    });
    
    this.emit('metric', { name, type: 'counter', value, tags });
  }

  // Gauge - current value
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'gauge');
    metric.values.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only last value for gauges (or last N values)
    if (metric.values.length > 100) {
      metric.values = metric.values.slice(-100);
    }

    this.emit('metric', { name, type: 'gauge', value, tags });
  }

  // Histogram - distribution of values
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    const metric = this.getOrCreateMetric(name, 'histogram');
    metric.values.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Limit histogram size
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    this.emit('metric', { name, type: 'histogram', value, tags });
  }

  // Timer - measure duration
  timer(name: string, fn: () => void, tags?: Record<string, string>): void {
    const start = process.hrtime.bigint();
    
    try {
      fn();
    } finally {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.histogram(name, durationMs, tags);
    }
  }

  async timerAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = process.hrtime.bigint();
    
    try {
      return await fn();
    } finally {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      this.histogram(name, durationMs, tags);
    }
  }

  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  getStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalMetrics: this.metrics.size,
      byType: {},
    };

    for (const metric of this.metrics.values()) {
      stats.byType[metric.type] = (stats.byType[metric.type] || 0) + 1;
    }

    return stats;
  }

  exportMetrics(): string {
    // Prometheus format
    const lines: string[] = [];

    for (const metric of this.metrics.values()) {
      lines.push(`# HELP ${metric.name} ${metric.type} metric`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      for (const value of metric.values) {
        const tagStr = value.tags
          ? Object.entries(value.tags)
              .map(([k, v]) => `${k}="${v}"`)
              .join(',')
          : '';
        lines.push(`${metric.name}${tagStr ? `{${tagStr}}` : ''} ${value.value}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private getOrCreateMetric(name: string, type: Metric['type']): Metric {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        values: [],
      });
    }

    return this.metrics.get(name)!;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.retentionMs;

    for (const metric of this.metrics.values()) {
      metric.values = metric.values.filter(v => v.timestamp > cutoff);
    }

    log.debug('Metrics cleanup completed');
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

// Global instance
export const metrics = new MetricsCollector();

// Track system metrics
export function startSystemMetrics(): void {
  setInterval(() => {
    const usage = process.memoryUsage();
    
    metrics.gauge('system.memory.heap_used', usage.heapUsed / 1024 / 1024, {
      unit: 'MB',
    });
    
    metrics.gauge('system.memory.heap_total', usage.heapTotal / 1024 / 1024, {
      unit: 'MB',
    });

    metrics.gauge('system.cpu.usage', process.cpuUsage().user / 1000, {
      unit: 'ms',
    });
  }, 30000); // Every 30 seconds
}