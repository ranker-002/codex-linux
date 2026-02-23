import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';
import { MCPConfiguration, MCPServerDefinition, MCPScope } from '../../shared/types';

const CONFIG_FILE_NAME = 'mcp.json';

export class MCPConfigurationManager {
  private userConfigPath: string;
  private projectConfigPath: string | null = null;
  private localConfig: MCPConfiguration = { mcpServers: {} };
  private userConfig: MCPConfiguration = { mcpServers: {} };
  private projectConfig: MCPConfiguration = { mcpServers: {} };

  constructor() {
    this.userConfigPath = path.join(os.homedir(), '.config', 'codex', CONFIG_FILE_NAME);
  }

  async initialize(projectPath?: string): Promise<void> {
    if (projectPath) {
      this.projectConfigPath = path.join(projectPath, CONFIG_FILE_NAME);
    }

    await this.loadAllConfigs();
    log.info('MCP Configuration Manager initialized');
  }

  private async loadAllConfigs(): Promise<void> {
    // Load user config (global)
    this.userConfig = await this.loadConfigFile(this.userConfigPath);

    // Load project config (if available)
    if (this.projectConfigPath) {
      this.projectConfig = await this.loadConfigFile(this.projectConfigPath);
    }

    // Load local config (project-specific, not committed)
    // Local config is stored in ~/.config/codex/mcp-local.json
    const localConfigPath = path.join(os.homedir(), '.config', 'codex', 'mcp-local.json');
    this.localConfig = await this.loadConfigFile(localConfigPath);
  }

  private async loadConfigFile(filePath: string): Promise<MCPConfiguration> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        mcpServers: parsed.mcpServers || {},
        settings: parsed.settings || {},
      };
    } catch (error) {
      // File doesn't exist or is invalid
      return { mcpServers: {} };
    }
  }

  private async saveConfigFile(filePath: string, config: MCPConfiguration): Promise<void> {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(config, null, 2));
    } catch (error) {
      log.error(`Failed to save MCP config to ${filePath}:`, error);
      throw error;
    }
  }

  async addServer(server: MCPServerDefinition): Promise<void> {
    let config: MCPConfiguration;
    let filePath: string;

    switch (server.scope) {
      case 'user':
        config = this.userConfig;
        filePath = this.userConfigPath;
        break;
      case 'project':
        if (!this.projectConfigPath) {
          throw new Error('Project config path not set');
        }
        config = this.projectConfig;
        filePath = this.projectConfigPath;
        break;
      case 'local':
      default:
        config = this.localConfig;
        filePath = path.join(os.homedir(), '.config', 'codex', 'mcp-local.json');
        break;
    }

    config.mcpServers[server.id] = server;
    await this.saveConfigFile(filePath, config);

    log.info(`Added MCP server ${server.id} to ${server.scope} config`);
  }

  async removeServer(serverId: string, scope?: MCPScope): Promise<void> {
    const scopes: MCPScope[] = scope ? [scope] : ['local', 'project', 'user'];
    
    for (const s of scopes) {
      let config: MCPConfiguration;
      let filePath: string;

      switch (s) {
        case 'user':
          config = this.userConfig;
          filePath = this.userConfigPath;
          break;
        case 'project':
          if (!this.projectConfigPath) continue;
          config = this.projectConfig;
          filePath = this.projectConfigPath;
          break;
        case 'local':
        default:
          config = this.localConfig;
          filePath = path.join(os.homedir(), '.config', 'codex', 'mcp-local.json');
          break;
      }

      if (config.mcpServers[serverId]) {
        delete config.mcpServers[serverId];
        await this.saveConfigFile(filePath, config);
        log.info(`Removed MCP server ${serverId} from ${s} config`);
        return;
      }
    }

    throw new Error(`Server ${serverId} not found in any config`);
  }

  getServer(serverId: string): MCPServerDefinition | null {
    // Check in priority order: local > project > user
    return this.localConfig.mcpServers[serverId] ||
           this.projectConfig.mcpServers[serverId] ||
           this.userConfig.mcpServers[serverId] ||
           null;
  }

  getAllServers(): Map<string, MCPServerDefinition> {
    const servers = new Map<string, MCPServerDefinition>();

    // Merge configs with priority: user < project < local
    for (const [id, server] of Object.entries(this.userConfig.mcpServers)) {
      servers.set(id, server);
    }

    for (const [id, server] of Object.entries(this.projectConfig.mcpServers)) {
      servers.set(id, server);
    }

    for (const [id, server] of Object.entries(this.localConfig.mcpServers)) {
      servers.set(id, server);
    }

    return servers;
  }

  getEnabledServers(): MCPServerDefinition[] {
    return Array.from(this.getAllServers().values())
      .filter(s => !s.disabled);
  }

  async setServerEnabled(serverId: string, enabled: boolean): Promise<void> {
    const server = this.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    server.disabled = !enabled;
    await this.addServer(server);
  }

  async updateServerEnvironment(serverId: string, env: Record<string, string>): Promise<void> {
    const server = this.getServer(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    server.env = { ...server.env, ...env };
    await this.addServer(server);
  }

  getConfig(scope: MCPScope): MCPConfiguration {
    switch (scope) {
      case 'user':
        return this.userConfig;
      case 'project':
        return this.projectConfig;
      case 'local':
      default:
        return this.localConfig;
    }
  }

  getSettings() {
    // Merge settings with priority
    return {
      ...this.userConfig.settings,
      ...this.projectConfig.settings,
      ...this.localConfig.settings,
    };
  }

  async setSetting(key: string, value: any, scope: MCPScope = 'local'): Promise<void> {
    let config: MCPConfiguration;
    let filePath: string;

    switch (scope) {
      case 'user':
        config = this.userConfig;
        filePath = this.userConfigPath;
        break;
      case 'project':
        if (!this.projectConfigPath) {
          throw new Error('Project config path not set');
        }
        config = this.projectConfig;
        filePath = this.projectConfigPath;
        break;
      case 'local':
      default:
        config = this.localConfig;
        filePath = path.join(os.homedir(), '.config', 'codex', 'mcp-local.json');
        break;
    }

    if (!config.settings) {
      config.settings = {};
    }

    (config.settings as any)[key] = value;
    await this.saveConfigFile(filePath, config);
  }

  async importFromClaudeDesktop(): Promise<number> {
    // Import MCP servers from Claude Desktop config
    const claudeDesktopConfigPath = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'settings.json');
    
    try {
      const content = await fs.readFile(claudeDesktopConfigPath, 'utf-8');
      const config = JSON.parse(content);
      
      if (!config.mcpServers) {
        return 0;
      }

      let imported = 0;
      for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
        const server: MCPServerDefinition = {
          id,
          name: id,
          transport: (serverConfig as any).type || 'stdio',
          command: (serverConfig as any).command,
          args: (serverConfig as any).args,
          env: (serverConfig as any).env,
          scope: 'user',
        };

        await this.addServer(server);
        imported++;
      }

      log.info(`Imported ${imported} MCP servers from Claude Desktop`);
      return imported;
    } catch (error) {
      log.warn('Failed to import from Claude Desktop:', error);
      return 0;
    }
  }

  getConfigPaths(): { user: string; project: string | null; local: string } {
    return {
      user: this.userConfigPath,
      project: this.projectConfigPath,
      local: path.join(os.homedir(), '.config', 'codex', 'mcp-local.json'),
    };
  }
}

export const mcpConfigManager = new MCPConfigurationManager();
