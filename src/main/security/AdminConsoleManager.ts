import { EventEmitter } from 'events';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';

export interface AdminSettings {
  disableCodeTab: boolean;
  disableBypassPermissionsMode: boolean;
  disableWebAccess: boolean;
  allowedModels: string[];
  blockedTools: string[];
  networkConfig?: {
    proxyUrl?: string;
    allowedDomains?: string[];
    blockedDomains?: string[];
  };
  sessionConfig?: {
    maxConcurrentSessions: number;
    sessionTimeoutMinutes: number;
    idleTimeoutMinutes: number;
  };
  mcpConfig?: {
    requireApprovalForNewServers: boolean;
    allowedServerPatterns: string[];
    blockedServerPatterns: string[];
  };
}

export interface ManagedSettings {
  settings: AdminSettings;
  version: string;
  updatedAt: string;
  updatedBy: string;
}

export class AdminConsoleManager extends EventEmitter {
  private settings: AdminSettings;
  private settingsPath: string;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(configDir: string) {
    super();
    this.settingsPath = path.join(configDir, 'admin-settings.json');
    this.settings = this.getDefaultSettings();
    this.loadSettings();
  }

  private getDefaultSettings(): AdminSettings {
    return {
      disableCodeTab: false,
      disableBypassPermissionsMode: false,
      disableWebAccess: false,
      allowedModels: [],
      blockedTools: [],
      networkConfig: {
        allowedDomains: [],
        blockedDomains: [],
      },
      sessionConfig: {
        maxConcurrentSessions: 10,
        sessionTimeoutMinutes: 120,
        idleTimeoutMinutes: 30,
      },
      mcpConfig: {
        requireApprovalForNewServers: true,
        allowedServerPatterns: [],
        blockedServerPatterns: [],
      },
    };
  }

  private loadSettings(): void {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data) as ManagedSettings;
        this.settings = { ...this.getDefaultSettings(), ...parsed.settings };
        log.info('Admin settings loaded');
        this.emit('settings:loaded', this.settings);
      }
    } catch (error) {
      log.error('Failed to load admin settings:', error);
      this.settings = this.getDefaultSettings();
    }
  }

  async saveSettings(settings: Partial<AdminSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    
    const managedSettings: ManagedSettings = {
      settings: this.settings,
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };

    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.settingsPath, JSON.stringify(managedSettings, null, 2));
      log.info('Admin settings saved');
      this.emit('settings:saved', this.settings);
    } catch (error) {
      log.error('Failed to save admin settings:', error);
      throw error;
    }
  }

  getSettings(): AdminSettings {
    return { ...this.settings };
  }

  // Permission checks
  isCodeTabEnabled(): boolean {
    return !this.settings.disableCodeTab;
  }

  isBypassPermissionsAllowed(): boolean {
    return !this.settings.disableBypassPermissionsMode;
  }

  isWebAccessAllowed(): boolean {
    return !this.settings.disableWebAccess;
  }

  isModelAllowed(model: string): boolean {
    if (this.settings.allowedModels.length === 0) {
      return true;
    }
    return this.settings.allowedModels.includes(model);
  }

  isToolAllowed(toolName: string): boolean {
    return !this.settings.blockedTools.includes(toolName);
  }

  isDomainAllowed(domain: string): boolean {
    const { allowedDomains = [], blockedDomains = [] } = this.settings.networkConfig || {};
    
    if (blockedDomains.some(d => domain.includes(d))) {
      return false;
    }
    
    if (allowedDomains.length === 0) {
      return true;
    }
    
    return allowedDomains.some(d => domain.includes(d));
  }

  // Session config
  getMaxConcurrentSessions(): number {
    return this.settings.sessionConfig?.maxConcurrentSessions || 10;
  }

  getSessionTimeoutMinutes(): number {
    return this.settings.sessionConfig?.sessionTimeoutMinutes || 120;
  }

  getIdleTimeoutMinutes(): number {
    return this.settings.sessionConfig?.idleTimeoutMinutes || 30;
  }

  // MCP config
  isMCPApprovalRequired(): boolean {
    return this.settings.mcpConfig?.requireApprovalForNewServers ?? true;
  }

  isMCPServerAllowed(serverName: string): boolean {
    const { allowedServerPatterns = [], blockedServerPatterns = [] } = this.settings.mcpConfig || {};
    
    if (blockedServerPatterns.some(p => new RegExp(p).test(serverName))) {
      return false;
    }
    
    if (allowedServerPatterns.length === 0) {
      return true;
    }
    
    return allowedServerPatterns.some(p => new RegExp(p).test(serverName));
  }

  // Watch for external changes
  startWatching(): void {
    if (this.watchInterval) return;
    
    this.watchInterval = setInterval(() => {
      const currentMtime = fs.statSync(this.settingsPath).mtime;
      if (this.lastMtime && currentMtime.getTime() > this.lastMtime.getTime()) {
        this.loadSettings();
        this.emit('settings:changed', this.settings);
      }
      this.lastMtime = currentMtime;
    }, 5000);
  }

  private lastMtime: Date | null = null;

  stopWatching(): void {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
      this.watchInterval = null;
    }
  }

  // Export settings for deployment
  exportSettings(): ManagedSettings {
    return {
      settings: this.settings,
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      updatedBy: 'admin',
    };
  }

  // Import settings from file
  async importSettings(filePath: string): Promise<void> {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const imported = JSON.parse(data) as ManagedSettings;
      
      if (!imported.settings) {
        throw new Error('Invalid settings file format');
      }
      
      await this.saveSettings(imported.settings);
      log.info('Admin settings imported from', filePath);
      this.emit('settings:imported', imported.settings);
    } catch (error) {
      log.error('Failed to import admin settings:', error);
      throw error;
    }
  }

  cleanup(): void {
    this.stopWatching();
    this.removeAllListeners();
  }
}

export default AdminConsoleManager;
