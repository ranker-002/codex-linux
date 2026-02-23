import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import log from 'electron-log';
import fetch from 'node-fetch';
import { MCPRegistryEntry, MCPServerDefinition, MCPTransportType, MCPScope } from '../../shared/types';

const ANTHROPIC_MCP_REGISTRY_URL = 'https://api.anthropic.com/mcp-registry/v0';
const MCP_CACHE_DIR = path.join(os.homedir(), '.cache', 'codex', 'mcp');

export class MCPRegistry extends EventEmitter {
  private registryCache: Map<string, MCPRegistryEntry> = new Map();
  private lastSync: Date | null = null;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

  async initialize(): Promise<void> {
    await this.ensureCacheDir();
    await this.loadCachedRegistry();
    log.info('MCP Registry initialized');
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.mkdir(MCP_CACHE_DIR, { recursive: true });
    } catch (error) {
      log.error('Failed to create MCP cache directory:', error);
    }
  }

  private async loadCachedRegistry(): Promise<void> {
    try {
      const cacheFile = path.join(MCP_CACHE_DIR, 'registry-cache.json');
      const data = await fs.readFile(cacheFile, 'utf-8');
      const cached = JSON.parse(data);
      
      if (cached.entries && Array.isArray(cached.entries)) {
        for (const entry of cached.entries) {
          this.registryCache.set(entry.id, entry);
        }
        this.lastSync = new Date(cached.timestamp);
        log.info(`Loaded ${this.registryCache.size} MCP servers from cache`);
      }
    } catch (error) {
      // Cache doesn't exist or is invalid
      log.debug('No MCP registry cache found');
    }
  }

  private async saveCache(): Promise<void> {
    try {
      const cacheFile = path.join(MCP_CACHE_DIR, 'registry-cache.json');
      const data = {
        timestamp: new Date().toISOString(),
        entries: Array.from(this.registryCache.values()),
      };
      await fs.writeFile(cacheFile, JSON.stringify(data, null, 2));
    } catch (error) {
      log.error('Failed to save MCP registry cache:', error);
    }
  }

  async syncWithRemote(): Promise<void> {
    try {
      log.info('Syncing MCP registry with Anthropic...');
      
      // Fetch from Anthropic's official registry
      const response = await fetch(`${ANTHROPIC_MCP_REGISTRY_URL}/servers?version=latest&visibility=commercial&limit=100`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Registry sync failed: ${response.status}`);
      }

      const data: any = await response.json();
      
      if (data.servers && Array.isArray(data.servers)) {
        for (const item of data.servers) {
          const server = item.server;
          const meta = item._meta?.['com.anthropic.api/mcp-registry'] || {};
          
          const entry: MCPRegistryEntry = {
            id: server.name || server.id,
            name: meta.displayName || server.title || server.name,
            description: meta.oneLiner || server.description,
            publisher: meta.publisher || 'Unknown',
            version: server.version || '1.0.0',
            transport: server.remotes?.map((r: any) => r.type) || ['stdio'],
            categories: meta.categories || [],
            tags: meta.tags || [],
            installs: meta.installs || 0,
            rating: meta.rating || 0,
            documentation: meta.documentation || server.documentation,
            repository: server.repository,
            packages: server.packages,
            remotes: server.remotes,
            environmentVariables: server.packages?.[0]?.environmentVariables,
          };

          this.registryCache.set(entry.id, entry);
        }

        this.lastSync = new Date();
        await this.saveCache();
        
        log.info(`Synced ${this.registryCache.size} MCP servers from registry`);
        this.emit('registry:synced', { count: this.registryCache.size });
      }
    } catch (error) {
      log.error('Failed to sync MCP registry:', error);
      this.emit('registry:syncError', error);
      
      // Use cached data if available
      if (this.registryCache.size > 0) {
        log.warn('Using cached MCP registry data');
      }
    }
  }

  async search(query: string, filters?: {
    category?: string;
    transport?: MCPTransportType;
    tags?: string[];
  }): Promise<MCPRegistryEntry[]> {
    const results: MCPRegistryEntry[] = [];
    const lowerQuery = query.toLowerCase();

    for (const entry of this.registryCache.values()) {
      // Text search
      const matchesQuery = 
        entry.name.toLowerCase().includes(lowerQuery) ||
        entry.description.toLowerCase().includes(lowerQuery) ||
        entry.tags.some(tag => tag.toLowerCase().includes(lowerQuery));

      if (!matchesQuery) continue;

      // Apply filters
      if (filters?.category && !entry.categories.includes(filters.category)) {
        continue;
      }

      if (filters?.transport && !entry.transport.includes(filters.transport)) {
        continue;
      }

      if (filters?.tags && !filters.tags.every(tag => entry.tags.includes(tag))) {
        continue;
      }

      results.push(entry);
    }

    // Sort by relevance (installs and rating)
    results.sort((a, b) => {
      const scoreA = (a.installs * 0.7) + (a.rating * 100 * 0.3);
      const scoreB = (b.installs * 0.7) + (b.rating * 100 * 0.3);
      return scoreB - scoreA;
    });

    return results;
  }

  getEntry(id: string): MCPRegistryEntry | undefined {
    return this.registryCache.get(id);
  }

  getAllCategories(): string[] {
    const categories = new Set<string>();
    for (const entry of this.registryCache.values()) {
      entry.categories.forEach(cat => categories.add(cat));
    }
    return Array.from(categories).sort();
  }

  getPopularEntries(limit: number = 10): MCPRegistryEntry[] {
    return Array.from(this.registryCache.values())
      .sort((a, b) => b.installs - a.installs)
      .slice(0, limit);
  }

  getTopRated(limit: number = 10): MCPRegistryEntry[] {
    return Array.from(this.registryCache.values())
      .filter(e => e.rating > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  async generateServerConfig(
    entryId: string,
    options: {
      scope?: MCPScope;
      envVars?: Record<string, string>;
      customUrl?: string;
    } = {}
  ): Promise<MCPServerDefinition | null> {
    const entry = this.registryCache.get(entryId);
    if (!entry) return null;

    const config: MCPServerDefinition = {
      id: entryId,
      name: entry.name,
      description: entry.description,
      transport: this.determineTransport(entry),
      scope: options.scope || 'local',
    };

    // Determine transport and configuration
    if (config.transport === 'http' && entry.remotes) {
      const httpRemote = entry.remotes.find(r => r.type === 'streamable-http');
      if (httpRemote) {
        config.url = options.customUrl || httpRemote.url;
      }
    } else if (config.transport === 'sse' && entry.remotes) {
      const sseRemote = entry.remotes.find(r => r.type === 'sse');
      if (sseRemote) {
        config.url = options.customUrl || sseRemote.url;
      }
    } else if (entry.packages) {
      // Stdio transport via npm package
      const npmPackage = entry.packages.find(p => p.registryType === 'npm');
      if (npmPackage) {
        config.command = 'npx';
        config.args = ['-y', npmPackage.identifier];
      }
    }

    // Add environment variables
    if (entry.environmentVariables) {
      config.env = {};
      for (const envVar of entry.environmentVariables) {
        if (options.envVars?.[envVar.name]) {
          config.env[envVar.name] = options.envVars[envVar.name];
        }
      }
    }

    // Add metadata
    config.metadata = {
      category: entry.categories[0],
      tags: entry.tags,
      author: entry.publisher,
      version: entry.version,
      homepage: entry.documentation,
    };

    return config;
  }

  private determineTransport(entry: MCPRegistryEntry): MCPTransportType {
    if (entry.transport.includes('streamable-http')) return 'http';
    if (entry.transport.includes('sse')) return 'sse';
    if (entry.transport.includes('websocket')) return 'websocket';
    return 'stdio';
  }

  async needsSync(): Promise<boolean> {
    if (!this.lastSync) return true;
    return (new Date().getTime() - this.lastSync.getTime()) > this.CACHE_TTL;
  }

  getLastSyncTime(): Date | null {
    return this.lastSync;
  }

  getCacheSize(): number {
    return this.registryCache.size;
  }
}

export const mcpRegistry = new MCPRegistry();
