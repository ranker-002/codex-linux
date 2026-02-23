import { EventEmitter } from 'events';
import log from 'electron-log';

interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyPath?: string;
  password?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

export class SSHManager extends EventEmitter {
  private connections: Map<string, SSHConnection> = new Map();

  constructor() {
    super();
    log.warn('SSH support requires "ssh2" package. Run: npm install ssh2');
  }

  async addConnection(config: Omit<SSHConnection, 'id' | 'status'>): Promise<SSHConnection> {
    const connection: SSHConnection = {
      ...config,
      id: `ssh-${Date.now()}`,
      status: 'disconnected'
    };

    this.connections.set(connection.id, connection);
    this.emit('connection:added', connection);
    log.info(`SSH connection added: ${connection.name} (${connection.host})`);
    
    return connection;
  }

  async removeConnection(connectionId: string): Promise<void> {
    this.connections.delete(connectionId);
    this.emit('connection:removed', { connectionId });
    log.info(`SSH connection removed: ${connectionId}`);
  }

  async connect(_connectionId: string): Promise<void> {
    throw new Error('SSH support not available. Install ssh2 package.');
  }

  async disconnect(_connectionId: string): Promise<void> {
    // No-op
  }

  async executeCommand(_connectionId: string, _command: string): Promise<string> {
    throw new Error('SSH support not available. Install ssh2 package.');
  }

  async readFile(_connectionId: string, _remotePath: string): Promise<string> {
    throw new Error('SSH support not available. Install ssh2 package.');
  }

  async writeFile(_connectionId: string, _remotePath: string, _content: string): Promise<void> {
    throw new Error('SSH support not available. Install ssh2 package.');
  }

  async listDirectory(_connectionId: string, _remotePath: string): Promise<any[]> {
    throw new Error('SSH support not available. Install ssh2 package.');
  }

  getConnections(): SSHConnection[] {
    return Array.from(this.connections.values());
  }

  getConnection(connectionId: string): SSHConnection | undefined {
    return this.connections.get(connectionId);
  }

  isConnected(_connectionId: string): boolean {
    return false;
  }

  cleanup(): void {
    this.connections.clear();
    this.removeAllListeners();
  }
}

export default SSHManager;
