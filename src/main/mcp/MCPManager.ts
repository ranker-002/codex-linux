import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import log from 'electron-log';

interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
}

export class MCPManager extends EventEmitter {
  private servers: Map<string, {
    config: MCPServerConfig;
    process: ChildProcess | null;
    tools: MCPTool[];
    resources: MCPResource[];
    status: 'stopped' | 'starting' | 'running' | 'error';
  }> = new Map();

  async initialize(): Promise<void> {
    // Load default MCP servers
    await this.loadDefaultServers();
    log.info('MCP Manager initialized');
  }

  private async loadDefaultServers(): Promise<void> {
    // File system server
    this.registerServer({
      id: 'filesystem',
      name: 'File System',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', process.env.HOME || '/home/user'],
    });

    // Git server
    this.registerServer({
      id: 'git',
      name: 'Git',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-git'],
    });

    // GitHub server
    this.registerServer({
      id: 'github',
      name: 'GitHub',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '',
      },
    });

    // PostgreSQL server
    this.registerServer({
      id: 'postgres',
      name: 'PostgreSQL',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
      disabled: true, // Disabled by default
    });

    // Brave Search server
    this.registerServer({
      id: 'brave-search',
      name: 'Brave Search',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
      },
      disabled: true,
    });
  }

  registerServer(config: MCPServerConfig): void {
    this.servers.set(config.id, {
      config,
      process: null,
      tools: [],
      resources: [],
      status: 'stopped',
    });

    log.info(`Registered MCP server: ${config.name}`);
  }

  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);
    if (server.config.disabled) throw new Error(`Server ${serverId} is disabled`);
    if (server.status === 'running') return;

    server.status = 'starting';
    this.emit('server:starting', serverId);

    try {
      server.process = spawn(server.config.command, server.config.args, {
        env: { ...process.env, ...server.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle stdout
      server.process.stdout?.on('data', (data) => {
        try {
          const messages = data.toString().trim().split('\n');
          for (const message of messages) {
            if (message) {
              this.handleServerMessage(serverId, JSON.parse(message));
            }
          }
        } catch (error) {
          log.debug(`MCP server ${serverId} output:`, data.toString());
        }
      });

      // Handle stderr
      server.process.stderr?.on('data', (data) => {
        log.error(`MCP server ${serverId} error:`, data.toString());
      });

      // Handle process exit
      server.process.on('exit', (code) => {
        server.status = code === 0 ? 'stopped' : 'error';
        this.emit('server:stopped', { serverId, code });
      });

      // Initialize connection
      await this.sendMessage(serverId, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'codex-linux',
            version: '1.0.0',
          },
        },
      });

      server.status = 'running';
      this.emit('server:started', serverId);
      log.info(`MCP server started: ${server.config.name}`);

    } catch (error) {
      server.status = 'error';
      this.emit('server:error', { serverId, error });
      throw error;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.process) return;

    server.process.kill();
    server.process = null;
    server.status = 'stopped';
    server.tools = [];
    server.resources = [];

    this.emit('server:stopped', serverId);
    log.info(`MCP server stopped: ${server.config.name}`);
  }

  private async sendMessage(serverId: string, message: any): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server?.process?.stdin) {
      throw new Error(`Server ${serverId} not running`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP request timeout'));
      }, 30000);

      const handler = (data: any) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === message.id) {
            clearTimeout(timeout);
            server.process?.stdout?.off('data', handler);
            resolve(response);
          }
        } catch {
          // Not JSON or not our response
        }
      };

      server.process?.stdout?.on('data', handler);
      server.process?.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  private handleServerMessage(serverId: string, message: any): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    if (message.method === 'tools/list') {
      server.tools = message.result?.tools || [];
      this.emit('server:tools', { serverId, tools: server.tools });
    } else if (message.method === 'resources/list') {
      server.resources = message.result?.resources || [];
      this.emit('server:resources', { serverId, resources: server.resources });
    }
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });

    return response.result;
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'resources/read',
      params: { uri },
    });

    return response.result;
  }

  getAllTools(): Array<{ serverId: string; tool: MCPTool }> {
    const tools: Array<{ serverId: string; tool: MCPTool }> = [];
    
    for (const [serverId, server] of this.servers) {
      if (server.status === 'running') {
        for (const tool of server.tools) {
          tools.push({ serverId, tool });
        }
      }
    }

    return tools;
  }

  getServerStatus(serverId: string) {
    return this.servers.get(serverId)?.status || 'stopped';
  }

  getServers() {
    return Array.from(this.servers.values()).map(s => ({
      id: s.config.id,
      name: s.config.name,
      status: s.status,
      disabled: s.config.disabled,
      tools: s.tools,
      resources: s.resources,
    }));
  }

  async cleanup(): Promise<void> {
    for (const [serverId] of this.servers) {
      await this.stopServer(serverId);
    }
  }
}