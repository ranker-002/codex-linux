import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch from 'node-fetch';

export interface RemoteSessionConfig {
  id: string;
  name: string;
  provider: 'anthropic';
  model: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  createdAt: Date;
  lastActivity: Date;
  environment?: {
    networkAccess?: 'full' | 'no-internet' | 'custom';
    variables?: Record<string, string>;
    preinstalledTools?: string[];
  };
  repositories?: {
    owner: string;
    repo: string;
    branch?: string;
  }[];
}

export interface RemoteSessionCreateOptions {
  name?: string;
  model?: string;
  environment?: RemoteSessionConfig['environment'];
  repositories?: RemoteSessionConfig['repositories'];
}

export class RemoteSessionManager extends EventEmitter {
  private sessions: Map<string, RemoteSessionConfig> = new Map();
  private apiKey: string;
  private baseUrl: string;
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = process.env.REMOTE_SESSION_URL || 'https://api.anthropic.com/v1';
  }

  async createSession(options: RemoteSessionCreateOptions = {}): Promise<RemoteSessionConfig> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session: RemoteSessionConfig = {
      id: sessionId,
      name: options.name || `Remote Session ${sessionId.slice(-4)}`,
      provider: 'anthropic',
      model: options.model || 'sonnet-4-20250514',
      status: 'creating',
      createdAt: new Date(),
      lastActivity: new Date(),
      environment: options.environment,
      repositories: options.repositories
    };

    this.sessions.set(sessionId, session);
    this.emit('session:creating', session);

    try {
      const response = await fetch(`${this.baseUrl}/remote_sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: session.model,
          environment: session.environment,
          repositories: session.repositories
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create remote session: ${response.status}`);
      }

      const data = await response.json() as { session_id: string };
      session.id = data.session_id;
      session.status = 'running';

      log.info(`Remote session created: ${session.id}`);
      this.emit('session:created', session);
      
      this.startPolling(session.id);
      
      return session;
    } catch (error) {
      session.status = 'error';
      log.error(`Failed to create remote session:`, error);
      this.emit('session:error', { session, error });
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<RemoteSessionConfig | undefined> {
    return this.sessions.get(sessionId);
  }

  async listSessions(): Promise<RemoteSessionConfig[]> {
    return Array.from(this.sessions.values());
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    try {
      await fetch(`${this.baseUrl}/remote_sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
    } catch (error) {
      log.warn(`Failed to delete remote session ${sessionId}:`, error);
    }

    this.stopPolling(sessionId);
    this.sessions.delete(sessionId);
    
    this.emit('session:deleted', sessionId);
    log.info(`Remote session deleted: ${sessionId}`);
  }

  async sendMessage(sessionId: string, message: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'running') {
      throw new Error(`Session ${sessionId} is not running`);
    }

    const response = await fetch(`${this.baseUrl}/remote_sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }

    const data = await response.json() as { content: string };
    session.lastActivity = new Date();
    
    return data.content;
  }

  async executeCommand(sessionId: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const response = await fetch(`${this.baseUrl}/remote_sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        command
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to execute command: ${response.status}`);
    }

    const data = await response.json() as { stdout: string; stderr: string; exit_code: number };
    session.lastActivity = new Date();

    return {
      stdout: data.stdout,
      stderr: data.stderr,
      exitCode: data.exit_code
    };
  }

  private startPolling(sessionId: string): void {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/remote_sessions/${sessionId}/status`, {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to get session status: ${response.status}`);
        }

        const data = await response.json() as { status: RemoteSessionConfig['status']; last_activity: string };
        
        const session = this.sessions.get(sessionId);
        if (session) {
          const oldStatus = session.status;
          session.status = data.status;
          session.lastActivity = new Date(data.last_activity);

          if (oldStatus !== data.status) {
            this.emit('session:status', session);
          }
        }
      } catch (error) {
        log.error(`Failed to poll session ${sessionId}:`, error);
      }
    }, 30000);

    this.pollIntervals.set(sessionId, interval);
  }

  private stopPolling(sessionId: string): void {
    const interval = this.pollIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.pollIntervals.delete(sessionId);
    }
  }

  cleanup(): void {
    for (const sessionId of this.pollIntervals.keys()) {
      this.stopPolling(sessionId);
    }
    this.sessions.clear();
  }
}

export default RemoteSessionManager;
