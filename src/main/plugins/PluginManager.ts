import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import log from 'electron-log';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
    menus?: Record<string, Array<{
      command: string;
      when?: string;
      group?: string;
    }>>;
    themes?: Array<{
      label: string;
      uiTheme: 'vs' | 'vs-dark' | 'hc-black';
      path: string;
    }>;
    skills?: Array<{
      id: string;
      name: string;
      path: string;
    }>;
  };
  activationEvents?: string[];
  engines?: {
    codex?: string;
  };
}

export interface PluginContext {
  registerCommand: (command: string, callback: (...args: any[]) => any) => void;
  registerMenu: (location: string, items: any[]) => void;
  registerTheme: (theme: any) => void;
  registerSkill: (skill: any) => void;
  subscribe: (event: string, callback: (...args: any[]) => void) => void;
  emit: (event: string, ...args: any[]) => void;
  getConfig: (key: string) => any;
  setConfig: (key: string, value: any) => void;
  log: ReturnType<typeof log.scope>;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  instance: any;
  isActive: boolean;
}

const PLUGIN_DIR = path.join(process.env.HOME || '~', '.config', 'codex', 'plugins');

export class PluginManager extends EventEmitter {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private contexts: Map<string, PluginContext> = new Map();

  async initialize(): Promise<void> {
    await fs.mkdir(PLUGIN_DIR, { recursive: true });
    await this.loadPlugins();
    log.info(`Plugin manager initialized. Loaded ${this.plugins.size} plugins.`);
  }

  async loadPlugins(): Promise<void> {
    try {
      const entries = await fs.readdir(PLUGIN_DIR, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPlugin(path.join(PLUGIN_DIR, entry.name));
        }
      }
    } catch (error) {
      log.error('Failed to load plugins:', error);
    }
  }

  async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const manifestPath = path.join(pluginPath, 'package.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Check compatibility
      if (manifest.engines?.codex) {
        const appVersion = '1.0.0'; // Get from package.json
        if (!this.checkCompatibility(manifest.engines.codex, appVersion)) {
          log.warn(`Plugin ${manifest.id} requires Codex ${manifest.engines.codex}, but running ${appVersion}`);
          return;
        }
      }

      const plugin: LoadedPlugin = {
        manifest,
        path: pluginPath,
        instance: null,
        isActive: false,
      };

      this.plugins.set(manifest.id, plugin);
      log.info(`Loaded plugin: ${manifest.name} (${manifest.id})`);

      // Auto-activate if no activation events specified
      if (!manifest.activationEvents || manifest.activationEvents.includes('*')) {
        await this.activatePlugin(manifest.id);
      }
    } catch (error) {
      log.error(`Failed to load plugin from ${pluginPath}:`, error);
    }
  }

  async activatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || plugin.isActive) return;

    try {
      const mainPath = path.join(plugin.path, plugin.manifest.main);
      const PluginClass = require(mainPath).default || require(mainPath);
      
      const context = this.createContext(pluginId);
      plugin.instance = new PluginClass(context);
      
      if (typeof plugin.instance.activate === 'function') {
        await plugin.instance.activate();
      }

      plugin.isActive = true;
      this.emit('plugin:activated', pluginId);
      log.info(`Activated plugin: ${plugin.manifest.name}`);
    } catch (error) {
      log.error(`Failed to activate plugin ${pluginId}:`, error);
    }
  }

  async deactivatePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.isActive) return;

    try {
      if (typeof plugin.instance.deactivate === 'function') {
        await plugin.instance.deactivate();
      }

      plugin.instance = null;
      plugin.isActive = false;
      this.contexts.delete(pluginId);
      
      this.emit('plugin:deactivated', pluginId);
      log.info(`Deactivated plugin: ${plugin.manifest.name}`);
    } catch (error) {
      log.error(`Failed to deactivate plugin ${pluginId}:`, error);
    }
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    await this.deactivatePlugin(pluginId);
    
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      try {
        await fs.rmdir(plugin.path, { recursive: true });
        this.plugins.delete(pluginId);
        this.emit('plugin:uninstalled', pluginId);
        log.info(`Uninstalled plugin: ${plugin.manifest.name}`);
      } catch (error) {
        log.error(`Failed to uninstall plugin ${pluginId}:`, error);
      }
    }
  }

  getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  getActivePlugins(): LoadedPlugin[] {
    return this.getPlugins().filter(p => p.isActive);
  }

  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  isPluginActive(pluginId: string): boolean {
    return this.plugins.get(pluginId)?.isActive || false;
  }

  private createContext(pluginId: string): PluginContext {
    const context: PluginContext = {
      registerCommand: (command: string, callback: (...args: any[]) => any) => {
        this.emit('command:registered', { pluginId, command, callback });
      },

      registerMenu: (location: string, items: any[]) => {
        this.emit('menu:registered', { pluginId, location, items });
      },

      registerTheme: (theme: any) => {
        this.emit('theme:registered', { pluginId, theme });
      },

      registerSkill: (skill: any) => {
        this.emit('skill:registered', { pluginId, skill });
      },

      subscribe: (event: string, callback: (...args: any[]) => void) => {
        this.on(event, callback);
      },

      emit: (event: string, ...args: any[]) => {
        this.emit(event, ...args);
      },

      getConfig: (key: string) => {
        // Get from plugin-specific config
        return null;
      },

      setConfig: (key: string, value: any) => {
        // Set in plugin-specific config
      },

      log: log.scope(pluginId),
    };

    this.contexts.set(pluginId, context);
    return context;
  }

  private checkCompatibility(required: string, current: string): boolean {
    // Simple semver check
    const [reqMajor, reqMinor] = required.split('.').map(Number);
    const [curMajor, curMinor] = current.split('.').map(Number);

    return curMajor >= reqMajor && (curMajor > reqMajor || curMinor >= reqMinor);
  }

  // Execute command from plugin
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    this.emit('command:execute', { command, args });
  }

  // Cleanup all plugins
  async cleanup(): Promise<void> {
    for (const [pluginId, context] of this.contexts) {
      try {
        const plugin = this.plugins.get(pluginId);
        if (plugin && typeof (plugin as any).cleanup === 'function') {
          await (plugin as any).cleanup();
        }
      } catch (error) {
        log.error(`Failed to cleanup plugin ${pluginId}:`, error);
      }
    }
    this.contexts.clear();
    this.plugins.clear();
    log.info('Plugin manager cleanup completed');
  }
}