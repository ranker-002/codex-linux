import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as url from 'url';
import log from 'electron-log';
import fetch from 'node-fetch';
import { 
  MCPServerDefinition, 
  MCPTool, 
  MCPResource, 
  MCPPrompt,
  MCPScope,
  MCPAuthToken,
  MCPSearchResult 
} from '../../shared/types';
import { MCPRegistry } from './MCPRegistry';
import { MCPConfigurationManager } from './MCPConfigurationManager';

interface ServerInstance {
  config: MCPServerDefinition;
  process: ChildProcess | null;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  authToken?: MCPAuthToken;
  toolsLoaded: boolean;
  toolsByCategory: Map<string, MCPTool[]>;
}

export class MCPManager extends EventEmitter {
  private servers: Map<string, ServerInstance> = new Map();
  private registry: MCPRegistry;
  private configManager: MCPConfigurationManager;
  private messageId = 0;
  private pendingRequests: Map<number, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private toolSearchCache: Map<string, { tools: MCPTool[]; timestamp: number }> = new Map();
  private toolSearchTTL = 5 * 60 * 1000;

  constructor() {
    super();
    this.registry = new MCPRegistry();
    this.configManager = new MCPConfigurationManager();
  }

  async initialize(projectPath?: string): Promise<void> {
    await this.registry.initialize();
    await this.configManager.initialize(projectPath);
    
    // Load configured servers
    await this.loadConfiguredServers();
    
    log.info('MCP Manager initialized with registry and config support');
  }

  private async loadConfiguredServers(): Promise<void> {
    const servers = this.configManager.getAllServers();
    
    for (const [id, config] of servers) {
      this.servers.set(id, {
        config,
        process: null,
        tools: [],
        resources: [],
        prompts: [],
        status: 'stopped',
        toolsLoaded: false,
        toolsByCategory: new Map(),
      });

      // Auto-start enabled servers
      if (!config.disabled) {
        try {
          await this.startServer(id);
        } catch (error) {
          log.warn(`Failed to auto-start MCP server ${id}:`, error);
        }
      }
    }
  }

  async addServer(config: MCPServerDefinition): Promise<void> {
    // Save to configuration
    await this.configManager.addServer(config);

    // Register in memory
    this.servers.set(config.id, {
      config,
      process: null,
      tools: [],
      resources: [],
      prompts: [],
      status: 'stopped',
      toolsLoaded: false,
      toolsByCategory: new Map(),
    });

    this.emit('server:added', config);
    log.info(`Registered MCP server: ${config.name} (${config.scope})`);
  }

  async removeServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Stop if running
    if (server.status === 'running') {
      await this.stopServer(serverId);
    }

    // Remove from config
    await this.configManager.removeServer(serverId, server.config.scope);

    // Remove from memory
    this.servers.delete(serverId);
    this.emit('server:removed', serverId);
    log.info(`Removed MCP server: ${serverId}`);
  }

  async startServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);
    if (server.config.disabled) throw new Error(`Server ${serverId} is disabled`);
    if (server.status === 'running') return;

    server.status = 'starting';
    this.emit('server:starting', serverId);

    try {
      if (server.config.transport === 'stdio' && server.config.command) {
        await this.startStdioServer(server);
      } else if ((server.config.transport === 'http' || server.config.transport === 'streamable-http') && server.config.url) {
        await this.startHttpServer(server);
      } else if (server.config.transport === 'sse' && server.config.url) {
        await this.startSseServer(server);
      } else {
        throw new Error(`Unsupported transport type: ${server.config.transport}`);
      }

      // Initialize connection
      await this.initializeConnection(serverId);

      // Fetch tools, resources, and prompts
      await this.discoverCapabilities(serverId);

      server.status = 'running';
      this.emit('server:started', serverId);
      log.info(`MCP server started: ${server.config.name}`);

    } catch (error: any) {
      server.status = 'error';
      server.lastError = error.message;
      this.emit('server:error', { serverId, error });
      throw error;
    }
  }

  private async startStdioServer(server: ServerInstance): Promise<void> {
    const { command, args, env } = server.config;
    
    server.process = spawn(command!, args || [], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle stdout
    server.process.stdout?.on('data', (data) => {
      this.handleServerOutput(server.config.id, data);
    });

    // Handle stderr
    server.process.stderr?.on('data', (data) => {
      log.error(`MCP server ${server.config.id} stderr:`, data.toString());
    });

    // Handle exit
    server.process.on('exit', (code) => {
      server.status = code === 0 ? 'stopped' : 'error';
      this.emit('server:stopped', { serverId: server.config.id, code });
    });
  }

  private async startHttpServer(server: ServerInstance): Promise<void> {
    // For HTTP servers, we just verify connectivity
    const response = await fetch(`${server.config.url}/health`, {
      method: 'GET',
      headers: server.config.headers,
    }).catch(() => null);

    if (!response || !response.ok) {
      log.warn(`HTTP MCP server ${server.config.id} health check failed, will retry on use`);
    }
  }

  private async startSseServer(server: ServerInstance): Promise<void> {
    // SSE servers establish connection on first use
    log.info(`SSE MCP server ${server.config.id} registered, connection on first use`);
  }

  private async initializeConnection(serverId: string): Promise<void> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
        clientInfo: {
          name: 'codex-linux',
          version: '1.0.0',
        },
      },
    });

    if (response.error) {
      throw new Error(`Initialize failed: ${response.error.message}`);
    }

    // Send initialized notification
    await this.sendNotification(serverId, 'initialized', {});
  }

  private async discoverCapabilities(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    // Discover tools
    try {
      const toolsResponse = await this.sendMessage(serverId, {
        jsonrpc: '2.0',
        id: this.getNextMessageId(),
        method: 'tools/list',
        params: {},
      });

      if (toolsResponse.result?.tools) {
        server.tools = toolsResponse.result.tools.map((t: any) => ({
          ...t,
          serverId,
        }));
        
        // Build category index for lazy loading
        this.buildToolsCategoryIndex(server);
        server.toolsLoaded = true;
      }
    } catch (error) {
      log.warn(`Failed to discover tools for ${serverId}:`, error);
    }

    // Discover resources
    try {
      const resourcesResponse = await this.sendMessage(serverId, {
        jsonrpc: '2.0',
        id: this.getNextMessageId(),
        method: 'resources/list',
        params: {},
      });

      if (resourcesResponse.result?.resources) {
        server.resources = resourcesResponse.result.resources.map((r: any) => ({
          ...r,
          serverId,
        }));
      }
    } catch (error) {
      log.warn(`Failed to discover resources for ${serverId}:`, error);
    }

    // Discover prompts
    try {
      const promptsResponse = await this.sendMessage(serverId, {
        jsonrpc: '2.0',
        id: this.getNextMessageId(),
        method: 'prompts/list',
        params: {},
      });

      if (promptsResponse.result?.prompts) {
        server.prompts = promptsResponse.result.prompts.map((p: any) => ({
          ...p,
          serverId,
        }));
      }
    } catch (error) {
      log.warn(`Failed to discover prompts for ${serverId}:`, error);
    }

    this.emit('server:capabilities', { 
      serverId, 
      tools: server.tools,
      resources: server.resources,
      prompts: server.prompts,
    });
  }

  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) return;

    if (server.process) {
      server.process.kill();
      server.process = null;
    }

    server.status = 'stopped';
    server.tools = [];
    server.resources = [];
    server.prompts = [];

    this.emit('server:stopped', serverId);
    log.info(`MCP server stopped: ${server.config.name}`);
  }

  private async sendMessage(serverId: string, message: any): Promise<any> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`Server ${serverId} not found`);

    if (server.config.transport === 'stdio') {
      return this.sendStdioMessage(server, message);
    } else {
      return this.sendHttpMessage(server, message);
    }
  }

  private async sendStdioMessage(server: ServerInstance, message: any): Promise<any> {
    if (!server.process?.stdin) {
      throw new Error(`Server ${server.config.id} not running`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('MCP request timeout'));
      }, 30000);

      this.pendingRequests.set(message.id, { resolve, reject, timeout });
      server.process!.stdin!.write(JSON.stringify(message) + '\n');
    });
  }

  private async sendHttpMessage(server: ServerInstance, message: any): Promise<any> {
    const response = await fetch(`${server.config.url}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...server.config.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return response.json();
  }

  private async sendNotification(serverId: string, method: string, params: any): Promise<void> {
    await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  private handleServerOutput(serverId: string, data: Buffer): void {
    const messages = data.toString().trim().split('\n');
    
    for (const messageStr of messages) {
      if (!messageStr) continue;

      try {
        const message = JSON.parse(messageStr);
        
        // Handle responses
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const pending = this.pendingRequests.get(message.id)!;
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve(message);
          }
        }

        // Handle notifications
        if (message.method) {
          this.handleNotification(serverId, message);
        }
      } catch (error) {
        log.debug(`MCP server ${serverId} output:`, messageStr);
      }
    }
  }

  private handleNotification(serverId: string, message: any): void {
    const server = this.servers.get(serverId);
    if (!server) return;

    switch (message.method) {
      case 'notifications/tools/list_changed':
        this.discoverCapabilities(serverId);
        break;
      case 'notifications/resources/list_changed':
        this.discoverCapabilities(serverId);
        break;
      case 'notifications/prompts/list_changed':
        this.discoverCapabilities(serverId);
        break;
      case 'notifications/message':
        log.info(`MCP server ${serverId}:`, message.params);
        break;
    }
  }

  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'resources/read',
      params: { uri },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  async getPrompt(serverId: string, promptName: string, args?: Record<string, string>): Promise<any> {
    const response = await this.sendMessage(serverId, {
      jsonrpc: '2.0',
      id: this.getNextMessageId(),
      method: 'prompts/get',
      params: {
        name: promptName,
        arguments: args,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  // Tool Search Optimization
  async searchTools(query: string): Promise<MCPSearchResult> {
    const result: MCPSearchResult = {
      query,
      tools: [],
      resources: [],
      prompts: [],
    };

    const lowerQuery = query.toLowerCase();

    for (const server of this.servers.values()) {
      if (server.status !== 'running') continue;

      // Search tools
      for (const tool of server.tools) {
        if (
          tool.name.toLowerCase().includes(lowerQuery) ||
          tool.description?.toLowerCase().includes(lowerQuery)
        ) {
          result.tools.push(tool);
        }
      }

      // Search resources
      for (const resource of server.resources) {
        if (
          resource.name.toLowerCase().includes(lowerQuery) ||
          resource.uri.toLowerCase().includes(lowerQuery)
        ) {
          result.resources.push(resource);
        }
      }

      // Search prompts
      for (const prompt of server.prompts) {
        if (
          prompt.name.toLowerCase().includes(lowerQuery) ||
          prompt.description?.toLowerCase().includes(lowerQuery)
        ) {
          result.prompts.push(prompt);
        }
      }
    }

    return result;
  }

  // OAuth Authentication
  async authenticateServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server?.config.oauth) {
      return false;
    }

    const { clientId, callbackPort = 8080 } = server.config.oauth;
    
    // Start local HTTP server for OAuth callback
    const redirectUri = `http://localhost:${callbackPort}/callback`;
    
    return new Promise((resolve, reject) => {
      const httpServer = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url || '', true);
        
        if (parsedUrl.pathname === '/callback') {
          const code = parsedUrl.query.code as string;
          
          if (code) {
            try {
              // Exchange code for token (implementation depends on OAuth provider)
              // This is a simplified version
              const token: MCPAuthToken = {
                serverId,
                accessToken: code, // In real implementation, exchange code
                expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
              };

              server.authToken = token;
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication successful!</h1><p>You can close this window.</p>');
              httpServer.close();
              resolve(true);
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end('<h1>Authentication failed</h1>');
              httpServer.close();
              reject(error);
            }
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication failed</h1><p>No authorization code received.</p>');
            httpServer.close();
            resolve(false);
          }
        }
      });

      httpServer.listen(callbackPort, () => {
        log.info(`OAuth callback server started on port ${callbackPort}`);
        
        // Open browser for OAuth (would need electron shell.openExternal)
        const authUrl = `${server.config.url}/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
        log.info(`Please visit: ${authUrl}`);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        httpServer.close();
        reject(new Error('OAuth timeout'));
      }, 5 * 60 * 1000);
    });
  }

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        tools.push(...server.tools);
      }
    }
    return tools;
  }

  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        resources.push(...server.resources);
      }
    }
    return resources;
  }

  getAllPrompts(): MCPPrompt[] {
    const prompts: MCPPrompt[] = [];
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        prompts.push(...server.prompts);
      }
    }
    return prompts;
  }

  getServerStatus(serverId: string): string {
    return this.servers.get(serverId)?.status || 'stopped';
  }

  getServers(): Array<{ 
    id: string; 
    name: string; 
    status: string; 
    disabled?: boolean;
    scope: MCPScope;
    transport: string;
    tools: number;
    resources: number;
  }> {
    return Array.from(this.servers.values()).map(s => ({
      id: s.config.id,
      name: s.config.name,
      status: s.status,
      disabled: s.config.disabled,
      scope: s.config.scope,
      transport: s.config.transport,
      tools: s.tools.length,
      resources: s.resources.length,
    }));
  }

  getRegistry(): MCPRegistry {
    return this.registry;
  }

  getConfigManager(): MCPConfigurationManager {
    return this.configManager;
  }

  // Lazy Loading - Build category index for tools
  private buildToolsCategoryIndex(server: ServerInstance): void {
    server.toolsByCategory.clear();
    
    for (const tool of server.tools) {
      const category = this.categorizeTool(tool);
      const existing = server.toolsByCategory.get(category) || [];
      existing.push(tool);
      server.toolsByCategory.set(category, existing);
    }
  }

  private categorizeTool(tool: MCPTool): string {
    const name = tool.name.toLowerCase();
    const inputSchema = JSON.stringify(tool.inputSchema).toLowerCase();
    
    if (name.includes('file') || name.includes('read') || name.includes('write') || inputSchema.includes('path')) {
      return 'filesystem';
    }
    if (name.includes('git') || name.includes('branch') || name.includes('commit')) {
      return 'git';
    }
    if (name.includes('search') || name.includes('find') || name.includes('query')) {
      return 'search';
    }
    if (name.includes('db') || name.includes('database') || name.includes('sql')) {
      return 'database';
    }
    if (name.includes('api') || name.includes('http') || name.includes('fetch')) {
      return 'api';
    }
    if (name.includes('run') || name.includes('execute') || name.includes('command')) {
      return 'execution';
    }
    return 'other';
  }

  // Get tools by category (lazy loaded)
  async getToolsByCategory(serverId: string, category: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];
    
    if (!server.toolsLoaded) {
      await this.discoverCapabilities(serverId);
    }
    
    return server.toolsByCategory.get(category) || [];
  }

  // Smart tool retrieval - only loads tools when needed
  async getRelevantTools(serverId: string, context: string): Promise<MCPTool[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];
    
    if (!server.toolsLoaded) {
      await this.discoverCapabilities(serverId);
    }
    
    const contextLower = context.toLowerCase();
    const relevantTools: MCPTool[] = [];
    
    for (const tool of server.tools) {
      const name = tool.name.toLowerCase();
      const desc = (tool.description || '').toLowerCase();
      
      // Score tool relevance
      let score = 0;
      if (name.includes(contextLower) || desc.includes(contextLower)) {
        score = 3;
      } else if (this.categorizeTool(tool) === this.inferCategoryFromContext(contextLower)) {
        score = 2;
      }
      
      if (score > 0) {
        relevantTools.push(tool);
      }
    }
    
    // If no specific tools found, return all (for broader context)
    return relevantTools.length > 0 ? relevantTools : server.tools.slice(0, 10);
  }

  private inferCategoryFromContext(context: string): string {
    if (context.includes('file') || context.includes('folder') || context.includes('directory')) {
      return 'filesystem';
    }
    if (context.includes('git') || context.includes('commit') || context.includes('branch')) {
      return 'git';
    }
    if (context.includes('search') || context.includes('find')) {
      return 'search';
    }
    if (context.includes('database') || context.includes('query') || context.includes('sql')) {
      return 'database';
    }
    return 'other';
  }

  // Cached search with TTL
  async searchToolsCached(query: string): Promise<MCPSearchResult> {
    const cached = this.toolSearchCache.get(query);
    if (cached && Date.now() - cached.timestamp < this.toolSearchTTL) {
      return {
        query,
        tools: cached.tools,
        resources: [],
        prompts: [],
      };
    }

    const result = await this.searchTools(query);
    this.toolSearchCache.set(query, {
      tools: result.tools,
      timestamp: Date.now(),
    });

    return result;
  }

  // Clear tool cache
  clearToolCache(): void {
    this.toolSearchCache.clear();
  }

  // Get tools count for UI
  getToolsCount(): number {
    let count = 0;
    for (const server of this.servers.values()) {
      if (server.status === 'running') {
        count += server.tools.length;
      }
    }
    return count;
  }

  private getNextMessageId(): number {
    return ++this.messageId;
  }

  async cleanup(): Promise<void> {
    for (const [serverId] of this.servers) {
      await this.stopServer(serverId);
    }
    this.pendingRequests.clear();
  }
}

export const mcpManager = new MCPManager();
