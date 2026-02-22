import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { format } from 'date-fns';

interface AuditEvent {
  id: string;
  timestamp: Date;
  action: string;
  userId: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
}

export class AuditLogger {
  private logDir: string;
  private currentLogFile: string;
  private writeStream: ReturnType<typeof createWriteStream> | null = null;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), 'audit-logs');
    this.currentLogFile = '';
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    await this.rotateLogFile();
    
    // Rotate logs every hour
    setInterval(() => this.rotateLogFile(), 60 * 60 * 1000);
  }

  private async rotateLogFile(): Promise<void> {
    if (this.writeStream) {
      this.writeStream.end();
    }

    const timestamp = format(new Date(), 'yyyy-MM-dd-HH');
    this.currentLogFile = path.join(this.logDir, `audit-${timestamp}.log`);
    
    this.writeStream = createWriteStream(this.currentLogFile, { flags: 'a' });
  }

  async log(
    action: string,
    details: Record<string, any>,
    metadata?: { ip?: string; userAgent?: string }
  ): Promise<void> {
    const event: AuditEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      action,
      userId: 'current-user', // In real app, get from auth context
      details,
      ...metadata,
    };

    const logLine = JSON.stringify(event) + '\n';
    
    if (this.writeStream) {
      this.writeStream.write(logLine);
    }

    // Also keep recent events in memory for quick access
    this.recentEvents.unshift(event);
    if (this.recentEvents.length > 1000) {
      this.recentEvents.pop();
    }
  }

  private recentEvents: AuditEvent[] = [];

  async getRecentEvents(limit: number = 100): Promise<AuditEvent[]> {
    return this.recentEvents.slice(0, limit);
  }

  async getEventsByAction(action: string, limit: number = 100): Promise<AuditEvent[]> {
    return this.recentEvents
      .filter(e => e.action === action)
      .slice(0, limit);
  }

  async getEventsByDateRange(startDate: Date, endDate: Date): Promise<AuditEvent[]> {
    // Read from log files
    const files = await fs.readdir(this.logDir);
    const events: AuditEvent[] = [];

    for (const file of files) {
      if (!file.endsWith('.log')) continue;
      
      const filePath = path.join(this.logDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const event: AuditEvent = JSON.parse(line);
          const eventDate = new Date(event.timestamp);
          
          if (eventDate >= startDate && eventDate <= endDate) {
            events.push(event);
          }
        } catch {
          // Skip invalid lines
        }
      }
    }

    return events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async exportLogs(exportPath: string): Promise<void> {
    const events = await this.getEventsByDateRange(
      new Date(0),
      new Date()
    );
    
    await fs.writeFile(
      exportPath,
      JSON.stringify(events, null, 2),
      'utf-8'
    );
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}