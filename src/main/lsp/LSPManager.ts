import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import log from 'electron-log';

interface LSPServer {
  id: string;
  name: string;
  languageId: string;
  command: string;
  args: string[];
  options?: child_process.SpawnOptions;
}

interface LSPConnection {
  server: LSPServer;
  process: child_process.ChildProcess;
  status: 'starting' | 'running' | 'error' | 'stopped';
  messageBuffer: string;
}

interface LSPMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

export class LSPManager extends EventEmitter {
  private servers: Map<string, LSPServer> = new Map();
  private connections: Map<string, LSPConnection> = new Map();
  private requestId: number = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();

  constructor() {
    super();
    this.registerDefaultServers();
  }

  private registerDefaultServers(): void {
    // TypeScript/JavaScript
    this.registerServer({
      id: 'typescript',
      name: 'TypeScript Language Server',
      languageId: 'typescript',
      command: 'typescript-language-server',
      args: ['--stdio']
    });

    // Python
    this.registerServer({
      id: 'python',
      name: 'Python Language Server (pylsp)',
      languageId: 'python',
      command: 'pylsp',
      args: []
    });

    // Rust
    this.registerServer({
      id: 'rust',
      name: 'Rust Analyzer',
      languageId: 'rust',
      command: 'rust-analyzer',
      args: []
    });

    // Go
    this.registerServer({
      id: 'go',
      name: 'Go Language Server (gopls)',
      languageId: 'go',
      command: 'gopls',
      args: ['serve']
    });

    // C/C++
    this.registerServer({
      id: 'cpp',
      name: 'clangd',
      languageId: 'cpp',
      command: 'clangd',
      args: []
    });

    // Java
    this.registerServer({
      id: 'java',
      name: 'Java Language Server (jdtls)',
      languageId: 'java',
      command: 'jdtls',
      args: []
    });

    log.info('Default LSP servers registered');
  }

  registerServer(server: LSPServer): void {
    this.servers.set(server.id, server);
    this.emit('server:registered', server);
    log.info(`LSP server registered: ${server.name}`);
  }

  async startServer(serverId: string, workspacePath?: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`LSP server ${serverId} not found`);
    }

    if (this.connections.has(serverId)) {
      throw new Error(`LSP server ${serverId} is already running`);
    }

    try {
      const process = child_process.spawn(server.command, server.args, {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        ...server.options
      });

      const connection: LSPConnection = {
        server,
        process,
        status: 'starting',
        messageBuffer: ''
      };

      this.connections.set(serverId, connection);

      // Handle process events
      process.on('error', (error) => {
        connection.status = 'error';
        this.emit('server:error', { serverId, error });
        log.error(`LSP server ${server.name} error:`, error);
      });

      process.on('exit', (code) => {
        connection.status = 'stopped';
        this.connections.delete(serverId);
        this.emit('server:stopped', { serverId, code });
        log.info(`LSP server ${server.name} stopped with code ${code}`);
      });

      // Handle stdout
      process.stdout?.on('data', (data: Buffer) => {
        this.handleMessage(serverId, data.toString());
      });

      // Handle stderr
      process.stderr?.on('data', (data: Buffer) => {
        log.debug(`LSP server ${server.name} stderr:`, data.toString());
      });

      // Initialize connection
      await this.initialize(serverId, workspacePath);

      connection.status = 'running';
      this.emit('server:started', server);
      log.info(`LSP server ${server.name} started`);

    } catch (error) {
      log.error(`Failed to start LSP server ${server.name}:`, error);
      throw error;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return;
    }

    // Send shutdown request
    await this.sendRequest(serverId, 'shutdown');

    // Send exit notification
    this.sendNotification(serverId, 'exit');

    // Kill process if still running
    if (!connection.process.killed) {
      connection.process.kill();
    }

    this.connections.delete(serverId);
  }

  async initialize(serverId: string, workspacePath?: string): Promise<void> {
    const params = {
      processId: process.pid,
      rootPath: workspacePath,
      rootUri: workspacePath ? `file://${workspacePath}` : null,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: false,
            willSave: true,
            willSaveWaitUntil: true,
            didSave: true
          },
          completion: {
            dynamicRegistration: false,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
              deprecatedSupport: true,
              preselectSupport: true
            }
          },
          hover: {
            dynamicRegistration: false,
            contentFormat: ['markdown', 'plaintext']
          },
          definition: {
            dynamicRegistration: false,
            linkSupport: true
          },
          documentSymbol: {
            dynamicRegistration: false,
            hierarchicalDocumentSymbolSupport: true
          },
          codeAction: {
            dynamicRegistration: false,
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: ['', 'quickfix', 'refactor', 'source']
              }
            }
          },
          formatting: {
            dynamicRegistration: false
          },
          rename: {
            dynamicRegistration: false,
            prepareSupport: true
          }
        },
        workspace: {
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true
          },
          didChangeConfiguration: {
            dynamicRegistration: false
          },
          didChangeWatchedFiles: {
            dynamicRegistration: false
          },
          workspaceFolders: true,
          configuration: true
        }
      },
      workspaceFolders: workspacePath ? [{
        uri: `file://${workspacePath}`,
        name: workspacePath.split('/').pop() || 'workspace'
      }] : null
    };

    await this.sendRequest(serverId, 'initialize', params);
    this.sendNotification(serverId, 'initialized', {});
  }

  async sendRequest(serverId: string, method: string, params?: any): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection || connection.status !== 'running') {
      throw new Error(`LSP server ${serverId} is not running`);
    }

    const id = ++this.requestId;
    const message: LSPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }
      }, 30000);

      this.sendMessage(serverId, message);
    });
  }

  sendNotification(serverId: string, method: string, params?: any): void {
    const connection = this.connections.get(serverId);
    if (!connection || connection.status !== 'running') {
      return;
    }

    const message: LSPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };

    this.sendMessage(serverId, message);
  }

  private sendMessage(serverId: string, message: LSPMessage): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    const content = JSON.stringify(message);
    const headers = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;

    connection.process.stdin?.write(headers + content);
  }

  private handleMessage(serverId: string, data: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    connection.messageBuffer += data;

    // Parse LSP messages
    while (true) {
      const headerMatch = connection.messageBuffer.match(/Content-Length: (\d+)\r\n/);
      if (!headerMatch) break;

      const contentLength = parseInt(headerMatch[1]);
      const headerEnd = connection.messageBuffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (connection.messageBuffer.length < messageEnd) break;

      const content = connection.messageBuffer.substring(messageStart, messageEnd);
      connection.messageBuffer = connection.messageBuffer.substring(messageEnd);

      try {
        const message: LSPMessage = JSON.parse(content);
        this.handleParsedMessage(serverId, message);
      } catch (error) {
        log.error('Failed to parse LSP message:', error);
      }
    }
  }

  private handleParsedMessage(serverId: string, message: LSPMessage): void {
    // Handle responses
    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message || 'LSP error'));
        } else {
          pending.resolve(message.result);
        }
      }
    }

    // Handle server requests/notifications
    if (message.method) {
      this.emit('server:message', { serverId, message });
    }
  }

  // Convenience methods for common LSP features
  async getCompletion(
    serverId: string,
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return this.sendRequest(serverId, 'textDocument/completion', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async getDefinition(
    serverId: string,
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return this.sendRequest(serverId, 'textDocument/definition', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async getHover(
    serverId: string,
    uri: string,
    line: number,
    character: number
  ): Promise<any> {
    return this.sendRequest(serverId, 'textDocument/hover', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  async formatDocument(serverId: string, uri: string): Promise<any> {
    return this.sendRequest(serverId, 'textDocument/formatting', {
      textDocument: { uri },
      options: {
        tabSize: 2,
        insertSpaces: true
      }
    });
  }

  getRunningServers(): LSPServer[] {
    return Array.from(this.connections.values())
      .filter(c => c.status === 'running')
      .map(c => c.server);
  }

  getAvailableServers(): LSPServer[] {
    return Array.from(this.servers.values());
  }

  isRunning(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    return connection?.status === 'running';
  }

  cleanup(): void {
    // Stop all servers
    for (const [serverId] of this.connections) {
      this.stopServer(serverId).catch(err => {
        log.error(`Failed to stop LSP server ${serverId}:`, err);
      });
    }

    this.pendingRequests.clear();
    this.removeAllListeners();
  }
}

export default LSPManager;
