import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import crypto from 'crypto';

export type SessionStatus = 'active' | 'idle' | 'expired' | 'terminated';
export type SessionActivity = 'chat' | 'task' | 'file_edit' | 'terminal' | 'browse';

export interface SessionData {
  [key: string]: unknown;
}

export interface SessionActivityLog {
  id: string;
  sessionId: string;
  activity: SessionActivity;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface Session {
  id: string;
  userId?: string;
  deviceId?: string;
  status: SessionStatus;
  token: string;
  refreshToken?: string;
  data: SessionData;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  idleSince?: Date;
  metadata: Record<string, unknown>;
}

export interface SessionConfig {
  ttl: number;
  idleTimeout: number;
  maxSessionsPerUser: number;
  enableRefreshToken: boolean;
  secureToken: boolean;
  tokenLength: number;
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  idleSessions: number;
  expiredSessions: number;
  averageSessionDuration: number;
  totalActivities: number;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private tokens: Map<string, string> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private activities: Map<string, SessionActivityLog[]> = new Map();
  private config: SessionConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SessionConfig>) {
    super();
    this.config = {
      ttl: config?.ttl || 24 * 60 * 60 * 1000,
      idleTimeout: config?.idleTimeout || 30 * 60 * 1000,
      maxSessionsPerUser: config?.maxSessionsPerUser || 5,
      enableRefreshToken: config?.enableRefreshToken ?? true,
      secureToken: config?.secureToken ?? true,
      tokenLength: config?.tokenLength || 32,
    };
  }

  configure(config: Partial<SessionConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('SessionManager configured', {
      ttl: this.config.ttl,
      idleTimeout: this.config.idleTimeout,
      maxSessions: this.config.maxSessionsPerUser,
    });
  }

  getConfig(): SessionConfig {
    return { ...this.config };
  }

  private generateToken(): string {
    const bytes = this.config.secureToken
      ? crypto.randomBytes(this.config.tokenLength)
      : crypto.randomBytes(this.config.tokenLength / 2);
    return bytes.toString('hex');
  }

  create(
    userId?: string,
    deviceId?: string,
    data: SessionData = {},
    metadata: Record<string, unknown> = {}
  ): Session {
    if (userId) {
      const existingUserSessions = this.userSessions.get(userId) || new Set();
      if (existingUserSessions.size >= this.config.maxSessionsPerUser) {
        const oldestSession = Array.from(existingUserSessions)
          .map((id) => this.sessions.get(id))
          .filter((s): s is Session => s !== undefined)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

        if (oldestSession) {
          this.terminate(oldestSession.id, 'max_sessions_reached');
        }
      }
    }

    const id = uuidv4();
    const token = this.generateToken();
    const refreshToken = this.config.enableRefreshToken ? this.generateToken() : undefined;
    const now = new Date();

    const session: Session = {
      id,
      userId,
      deviceId,
      status: 'active',
      token,
      refreshToken,
      data,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.ttl),
      lastActivityAt: now,
      metadata,
    };

    this.sessions.set(id, session);
    this.tokens.set(token, id);

    if (userId) {
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId)!.add(id);
    }

    this.logActivity(id, 'chat', 'Session created');
    this.emit('session:created', session);
    log.info(`Session created: ${id}`, { userId, deviceId });

    this.startCleanupInterval();

    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getByToken(token: string): Session | undefined {
    const sessionId = this.tokens.get(token);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  refresh(refreshToken: string): Session | null {
    const session = Array.from(this.sessions.values()).find(
      (s) => s.refreshToken === refreshToken
    );

    if (!session) {
      return null;
    }

    if (session.status === 'expired' || session.status === 'terminated') {
      return null;
    }

    session.token = this.generateToken();
    session.expiresAt = new Date(Date.now() + this.config.ttl);
    session.lastActivityAt = new Date();

    this.tokens.delete(session.token);
    this.tokens.set(session.token, session.id);

    this.emit('session:refreshed', session);
    log.info(`Session refreshed: ${session.id}`);

    return session;
  }

  updateActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivityAt = new Date();
    session.status = 'active';

    if (session.idleSince) {
      session.idleSince = undefined;
    }

    this.emit('session:activity', session);
    return true;
  }

  setIdle(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.idleSince) {
      session.idleSince = new Date();
      session.status = 'idle';
      this.emit('session:idle', session);
    }

    return true;
  }

  terminate(sessionId: string, reason: string = 'manual'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'terminated';
    this.tokens.delete(session.token);

    if (session.userId) {
      const userSessions = this.userSessions.get(session.userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }
    }

    this.emit('session:terminated', { session, reason });
    log.info(`Session terminated: ${sessionId}`, { reason });

    return true;
  }

  private logActivity(
    sessionId: string,
    activity: SessionActivity,
    description: string,
    metadata?: Record<string, unknown>
  ): void {
    const logEntry: SessionActivityLog = {
      id: uuidv4(),
      sessionId,
      activity,
      description,
      metadata,
      timestamp: new Date(),
    };

    if (!this.activities.has(sessionId)) {
      this.activities.set(sessionId, []);
    }

    const sessionLogs = this.activities.get(sessionId)!;
    sessionLogs.push(logEntry);

    if (sessionLogs.length > 1000) {
      sessionLogs.splice(0, sessionLogs.length - 1000);
    }
  }

  logSessionActivity(
    sessionId: string,
    activity: SessionActivity,
    description: string,
    metadata?: Record<string, unknown>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.updateActivity(sessionId);
    this.logActivity(sessionId, activity, description, metadata);
    this.emit('activity:logged', { sessionId, activity });
  }

  getActivityLog(sessionId: string, limit?: number): SessionActivityLog[] {
    const logs = this.activities.get(sessionId) || [];
    return limit ? logs.slice(-limit) : logs;
  }

  getSessionsByUser(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is Session => s !== undefined);
  }

  getActiveSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'active');
  }

  getIdleSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === 'idle');
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    const expired: Session[] = [];

    this.sessions.forEach((session) => {
      if (session.status === 'active' || session.status === 'idle') {
        if (session.expiresAt < now) {
          session.status = 'expired';
          expired.push(session);
        } else if (session.idleSince) {
          const idleTime = now.getTime() - session.idleSince.getTime();
          if (idleTime > this.config.idleTimeout) {
            session.status = 'expired';
            expired.push(session);
          }
        }
      }
    });

    expired.forEach((session) => {
      this.tokens.delete(session.token);
      if (session.userId) {
        const userSessions = this.userSessions.get(session.userId);
        if (userSessions) {
          userSessions.delete(session.id);
        }
      }
      this.emit('session:expired', session);
    });

    if (expired.length > 0) {
      log.info(`Cleaned up ${expired.length} expired sessions`);
    }
  }

  private startCleanupInterval(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000);
  }

  private stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  extendSession(sessionId: string, ttl?: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.expiresAt = new Date(Date.now() + (ttl || this.config.ttl));
    this.emit('session:extended', session);
    return true;
  }

  setSessionData(sessionId: string, key: string, value: unknown): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.data[key] = value;
    return true;
  }

  getSessionData<T = unknown>(sessionId: string, key: string): T | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    return session.data[key] as T | undefined;
  }

  getStats(): SessionStats {
    const sessions = Array.from(this.sessions.values());
    let totalDuration = 0;
    let activeCount = 0;

    sessions.forEach((s) => {
      if (s.status === 'active') {
        activeCount++;
        totalDuration += Date.now() - s.createdAt.getTime();
      }
    });

    const allActivities = Array.from(this.activities.values()).reduce(
      (sum, logs) => sum + logs.length,
      0
    );

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      idleSessions: sessions.filter((s) => s.status === 'idle').length,
      expiredSessions: sessions.filter((s) => s.status === 'expired' || s.status === 'terminated').length,
      averageSessionDuration: activeCount > 0 ? totalDuration / activeCount : 0,
      totalActivities: allActivities,
    };
  }

  cleanup(): void {
    this.stopCleanupInterval();
    this.sessions.clear();
    this.tokens.clear();
    this.userSessions.clear();
    this.activities.clear();
    this.removeAllListeners();
    log.info('SessionManager cleaned up');
  }
}

export default SessionManager;
