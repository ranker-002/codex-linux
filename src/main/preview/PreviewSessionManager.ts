import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';

export interface PersistedSession {
  id: string;
  serverName: string;
  port: number;
  cookies: string[];
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  lastAccessed: string;
  createdAt: string;
}

export interface PreviewSessionConfig {
  persistSessions: boolean;
  maxPersistedSessions: number;
  sessionStorageDir: string;
}

const DEFAULT_CONFIG: PreviewSessionConfig = {
  persistSessions: true,
  maxPersistedSessions: 10,
  sessionStorageDir: '.codex/preview-sessions',
};

export class PreviewSessionManager {
  private config: PreviewSessionConfig;
  private sessionsDir: string;
  private sessions: Map<string, PersistedSession> = new Map();

  constructor(config: Partial<PreviewSessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionsDir = path.join(app.getPath('userData'), this.config.sessionStorageDir);
    this.ensureDirectory();
    this.loadSessions();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
      log.info(`Created preview sessions directory: ${this.sessionsDir}`);
    }
  }

  private loadSessions(): void {
    try {
      const files = fs.readdirSync(this.sessionsDir).filter(f => f.endsWith('.json'));
      
      for (const file of files) {
        const filePath = path.join(this.sessionsDir, file);
        const data = fs.readFileSync(filePath, 'utf-8');
        const session = JSON.parse(data) as PersistedSession;
        this.sessions.set(session.id, session);
      }
      
      log.info(`Loaded ${this.sessions.size} persisted preview sessions`);
    } catch (error) {
      log.error('Failed to load persisted sessions:', error);
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return path.join(this.sessionsDir, `${sessionId}.json`);
  }

  async persistSession(
    sessionId: string,
    serverName: string,
    port: number,
    cookies: string[] = [],
    localStorage: Record<string, string> = {},
    sessionStorage: Record<string, string> = {}
  ): Promise<void> {
    if (!this.config.persistSessions) {
      return;
    }

    const session: PersistedSession = {
      id: sessionId,
      serverName,
      port,
      cookies,
      localStorage,
      sessionStorage,
      lastAccessed: new Date().toISOString(),
      createdAt: this.sessions.get(sessionId)?.createdAt || new Date().toISOString(),
    };

    this.sessions.set(sessionId, session);

    try {
      const filePath = this.getSessionFilePath(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      log.info(`Persisted preview session: ${sessionId}`);
    } catch (error) {
      log.error(`Failed to persist session ${sessionId}:`, error);
    }

    this.cleanupOldSessions();
  }

  getSession(sessionId: string): PersistedSession | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      session.lastAccessed = new Date().toISOString();
      const filePath = this.getSessionFilePath(sessionId);
      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
    }
    
    return session;
  }

  getAllSessions(): PersistedSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    
    const filePath = this.getSessionFilePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.info(`Deleted preview session: ${sessionId}`);
    }
  }

  async clearAllSessions(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.deleteSession(sessionId);
    }
    log.info('Cleared all persisted preview sessions');
  }

  private cleanupOldSessions(): void {
    if (this.sessions.size <= this.config.maxPersistedSessions) {
      return;
    }

    const sortedSessions = this.getAllSessions();
    const toDelete = sortedSessions.slice(this.config.maxPersistedSessions);

    for (const session of toDelete) {
      this.deleteSession(session.id);
    }
    
    log.info(`Cleaned up ${toDelete.length} old preview sessions`);
  }

  setConfig(config: Partial<PreviewSessionConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (!this.config.persistSessions) {
      this.clearAllSessions();
    }
  }

  getConfig(): PreviewSessionConfig {
    return { ...this.config };
  }

  isPersistEnabled(): boolean {
    return this.config.persistSessions;
  }

  getStorageSize(): number {
    let size = 0;
    
    for (const session of this.sessions.values()) {
      size += JSON.stringify(session).length;
    }
    
    return size;
  }

  cleanup(): void {
    this.sessions.clear();
  }
}

export default PreviewSessionManager;
