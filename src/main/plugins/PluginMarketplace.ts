import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs/promises';
import log from 'electron-log';
import fetch from 'node-fetch';

export type PluginPermission = 
  | 'file:read'
  | 'file:write'
  | 'file:delete'
  | 'command:execute'
  | 'network:request'
  | 'storage:read'
  | 'storage:write'
  | 'agent:create'
  | 'agent:control'
  | 'ui:render'
  | 'clipboard:read'
  | 'clipboard:write';

export interface PluginMarketplaceItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  authorUrl?: string;
  homepage?: string;
  repository?: string;
  license: string;
  keywords: string[];
  downloads: number;
  rating: number;
  createdAt: Date;
  updatedAt: Date;
  iconUrl?: string;
  manifest: Record<string, unknown>;
}

export interface PluginPermissionRequest {
  pluginId: string;
  permissions: PluginPermission[];
  reason: string;
}

export interface PluginInstallOptions {
  version?: string;
  force?: boolean;
  dependencies?: boolean;
}

export interface PluginSecurityPolicy {
  allowedHosts?: string[];
  allowedCommands?: string[];
  sandboxed?: boolean;
  maxMemory?: number;
  maxCpu?: number;
}

export class PluginMarketplace extends EventEmitter {
  private marketplaceUrl: string;
  private cache: Map<string, { data: PluginMarketplaceItem; expiresAt: Date }> = new Map();
  private cacheTimeout = 15 * 60 * 1000;

  constructor(marketplaceUrl: string = 'https://marketplace.codex-linux.dev/api') {
    super();
    this.marketplaceUrl = marketplaceUrl;
  }

  configure(marketplaceUrl: string): void {
    this.marketplaceUrl = marketplaceUrl;
    log.info('PluginMarketplace configured', { url: marketplaceUrl });
  }

  private getCache(key: string): PluginMarketplaceItem | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > new Date()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: PluginMarketplaceItem): void {
    this.cache.set(key, {
      data,
      expiresAt: new Date(Date.now() + this.cacheTimeout),
    });
  }

  async search(query: string, options?: {
    category?: string;
    sort?: 'popular' | 'recent' | 'rating';
    limit?: number;
  }): Promise<PluginMarketplaceItem[]> {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getCache(cacheKey);
    if (cached) return [cached];

    try {
      const params = new URLSearchParams({
        q: query,
        ...(options?.category && { category: options.category }),
        sort: options?.sort || 'popular',
        limit: String(options?.limit || 20),
      });

      const response = await fetch(`${this.marketplaceUrl}/plugins?${params}`, {
        headers: { 'User-Agent': 'CodexLinux/1.0' },
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.statusText}`);
      }

      const data = await response.json() as { plugins: PluginMarketplaceItem[] };
      
      data.plugins.forEach((plugin) => this.setCache(plugin.id, plugin));
      
      return data.plugins;
    } catch (error) {
      log.error('Failed to search marketplace:', error);
      return this.mockSearch(query);
    }
  }

  async getPlugin(pluginId: string): Promise<PluginMarketplaceItem | null> {
    const cached = this.getCache(pluginId);
    if (cached) return cached;

    try {
      const response = await fetch(`${this.marketplaceUrl}/plugins/${pluginId}`, {
        headers: { 'User-Agent': 'CodexLinux/1.0' },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Marketplace API error: ${response.statusText}`);
      }

      const data = await response.json() as PluginMarketplaceItem;
      this.setCache(pluginId, data);
      return data;
    } catch (error) {
      log.error('Failed to get plugin:', error);
      return null;
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const response = await fetch(`${this.marketplaceUrl}/categories`, {
        headers: { 'User-Agent': 'CodexLinux/1.0' },
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.statusText}`);
      }

      const data = await response.json() as { categories: string[] };
      return data.categories;
    } catch (error) {
      log.error('Failed to get categories:', error);
      return ['AI Agents', 'Productivity', 'Integrations', 'Themes', 'Utilities'];
    }
  }

  async getFeatured(): Promise<PluginMarketplaceItem[]> {
    try {
      const response = await fetch(`${this.marketplaceUrl}/featured`, {
        headers: { 'User-Agent': 'CodexLinux/1.0' },
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.statusText}`);
      }

      const data = await response.json() as { plugins: PluginMarketplaceItem[] };
      return data.plugins;
    } catch (error) {
      log.error('Failed to get featured plugins:', error);
      return [];
    }
  }

  private mockSearch(query: string): PluginMarketplaceItem[] {
    return [
      {
        id: 'github-integration',
        name: 'GitHub Integration',
        description: 'Seamless GitHub integration for PRs, issues, and workflows',
        version: '1.0.0',
        author: 'Codex Team',
        license: 'MIT',
        keywords: ['github', 'git', 'integration'],
        downloads: 15000,
        rating: 4.8,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-15'),
        manifest: {},
      },
      {
        id: 'slack-notifications',
        name: 'Slack Notifications',
        description: 'Get agent updates directly in Slack',
        version: '1.2.0',
        author: 'Codex Team',
        license: 'MIT',
        keywords: ['slack', 'notifications'],
        downloads: 8000,
        rating: 4.5,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-07-01'),
        manifest: {},
      },
    ];
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared');
  }

  cleanup(): void {
    this.cache.clear();
    this.removeAllListeners();
  }
}

export class PluginPermissionManager extends EventEmitter {
  private permissions: Map<string, Set<PluginPermission>> = new Map();
  private pendingRequests: Map<string, PluginPermissionRequest> = new Map();
  private defaultPermissions: PluginPermission[] = [
    'storage:read',
    'storage:write',
    'ui:render',
  ];

  constructor() {
    super();
  }

  requestPermissions(pluginId: string, permissions: PluginPermission[], reason: string): string {
    const requestId = uuidv4();
    this.pendingRequests.set(requestId, {
      pluginId,
      permissions,
      reason,
    });
    this.emit('permission:requested', { requestId, pluginId, permissions });
    return requestId;
  }

  async approvePermissions(requestId: string): Promise<boolean> {
    const request = this.pendingRequests.get(requestId);
    if (!request) return false;

    if (!this.permissions.has(request.pluginId)) {
      this.permissions.set(request.pluginId, new Set(this.defaultPermissions));
    }

    const pluginPerms = this.permissions.get(request.pluginId)!;
    request.permissions.forEach((p) => pluginPerms.add(p));

    this.pendingRequests.delete(requestId);
    this.emit('permission:approved', { requestId, pluginId: request.pluginId });
    log.info(`Permissions approved for plugin ${request.pluginId}`);
    return true;
  }

  rejectPermissions(requestId: string): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) return false;

    this.pendingRequests.delete(requestId);
    this.emit('permission:rejected', { requestId, pluginId: request.pluginId });
    return true;
  }

  getPermissions(pluginId: string): PluginPermission[] {
    return Array.from(this.permissions.get(pluginId) || new Set(this.defaultPermissions));
  }

  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const pluginPerms = this.permissions.get(pluginId);
    if (!pluginPerms) return this.defaultPermissions.includes(permission);
    return pluginPerms.has(permission);
  }

  revokePermission(pluginId: string, permission: PluginPermission): boolean {
    const pluginPerms = this.permissions.get(pluginId);
    if (!pluginPerms) return false;
    
    const removed = pluginPerms.delete(permission);
    if (removed) {
      this.emit('permission:revoked', { pluginId, permission });
    }
    return removed;
  }

  revokeAllPermissions(pluginId: string): void {
    this.permissions.delete(pluginId);
    this.emit('permissions:revoked', { pluginId });
  }

  getPendingRequests(): PluginPermissionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  cleanup(): void {
    this.permissions.clear();
    this.pendingRequests.clear();
    this.removeAllListeners();
  }
}

export default PluginMarketplace;
