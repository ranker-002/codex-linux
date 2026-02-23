import { EventEmitter } from 'events';
import log from 'electron-log';

interface TraceEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  action: string;
  details: Record<string, any>;
  duration?: number;
}

interface ExecutionTrace {
  id: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  entries: TraceEntry[];
  metadata: {
    model: string;
    provider: string;
    totalTokens?: number;
    cost?: number;
  };
}

export class TraceGradingSystem extends EventEmitter {
  private traces: Map<string, ExecutionTrace> = new Map();
  private activeTraces: Map<string, ExecutionTrace> = new Map();

  startTrace(agentId: string, metadata: ExecutionTrace['metadata']): string {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const trace: ExecutionTrace = {
      id: traceId,
      agentId,
      startTime: Date.now(),
      entries: [],
      metadata
    };

    this.activeTraces.set(traceId, trace);
    log.debug(`Trace started: ${traceId}`);
    
    return traceId;
  }

  addEntry(
    traceId: string,
    level: TraceEntry['level'],
    component: string,
    action: string,
    details: Record<string, any> = {},
    duration?: number
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return;

    trace.entries.push({
      timestamp: Date.now(),
      level,
      component,
      action,
      details,
      duration
    });
  }

  endTrace(traceId: string, metadata?: Partial<ExecutionTrace['metadata']>): ExecutionTrace {
    const trace = this.activeTraces.get(traceId);
    if (!trace) throw new Error(`Trace ${traceId} not found`);

    trace.endTime = Date.now();
    if (metadata) {
      trace.metadata = { ...trace.metadata, ...metadata };
    }

    this.activeTraces.delete(traceId);
    this.traces.set(traceId, trace);

    // Grade the trace
    const grade = this.gradeTrace(trace);
    this.emit('trace:graded', { traceId, grade, trace });

    log.debug(`Trace ended: ${traceId}, Grade: ${grade.score}`);
    return trace;
  }

  private gradeTrace(trace: ExecutionTrace): { score: number; issues: string[]; highlights: string[] } {
    const issues: string[] = [];
    const highlights: string[] = [];
    let score = 100;

    // Check for errors
    const errors = trace.entries.filter(e => e.level === 'error');
    if (errors.length > 0) {
      score -= errors.length * 10;
      issues.push(`${errors.length} error(s) occurred during execution`);
    }

    // Check for warnings
    const warnings = trace.entries.filter(e => e.level === 'warn');
    if (warnings.length > 0) {
      score -= warnings.length * 5;
      issues.push(`${warnings.length} warning(s) during execution`);
    }

    // Check execution time
    const duration = trace.endTime! - trace.startTime;
    if (duration > 60000) {
      score -= 5;
      issues.push('Execution took longer than 60 seconds');
    } else if (duration < 5000) {
      highlights.push('Fast execution time');
    }

    // Check for retries
    const retries = trace.entries.filter(e => e.action === 'retry');
    if (retries.length > 0) {
      score -= retries.length * 3;
      issues.push(`${retries.length} retry(ies) needed`);
    }

    // Check for successful tool usage
    const toolCalls = trace.entries.filter(e => e.component === 'tool');
    const successfulTools = toolCalls.filter(e => e.level !== 'error');
    if (toolCalls.length > 0 && successfulTools.length === toolCalls.length) {
      highlights.push('All tool calls successful');
    }

    return {
      score: Math.max(0, score),
      issues,
      highlights
    };
  }

  getTrace(traceId: string): ExecutionTrace | undefined {
    return this.traces.get(traceId) || this.activeTraces.get(traceId);
  }

  getTracesForAgent(agentId: string): ExecutionTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.agentId === agentId)
      .sort((a, b) => b.startTime - a.startTime);
  }

  generateReport(traceId: string): string {
    const trace = this.getTrace(traceId);
    if (!trace) throw new Error(`Trace ${traceId} not found`);

    const grade = this.gradeTrace(trace);
    const duration = trace.endTime ? trace.endTime - trace.startTime : 0;

    let report = `# Execution Trace Report\n\n`;
    report += `**Trace ID:** ${trace.id}\n`;
    report += `**Agent ID:** ${trace.agentId}\n`;
    report += `**Duration:** ${(duration / 1000).toFixed(2)}s\n`;
    report += `**Score:** ${grade.score}/100\n\n`;

    if (grade.issues.length > 0) {
      report += `## Issues\n`;
      grade.issues.forEach(issue => report += `- ${issue}\n`);
      report += '\n';
    }

    if (grade.highlights.length > 0) {
      report += `## Highlights\n`;
      grade.highlights.forEach(h => report += `- ${h}\n`);
      report += '\n';
    }

    report += `## Execution Log\n\n`;
    trace.entries.forEach(entry => {
      const time = new Date(entry.timestamp).toISOString();
      report += `[${time}] [${entry.level.toUpperCase()}] ${entry.component}: ${entry.action}\n`;
      if (entry.duration) {
        report += `  Duration: ${entry.duration}ms\n`;
      }
      if (Object.keys(entry.details).length > 0) {
        report += `  Details: ${JSON.stringify(entry.details)}\n`;
      }
      report += '\n';
    });

    return report;
  }

  cleanup(): void {
    this.activeTraces.clear();
    this.traces.clear();
    this.removeAllListeners();
  }
}

export default TraceGradingSystem;
