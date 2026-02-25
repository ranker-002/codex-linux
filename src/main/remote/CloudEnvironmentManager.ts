import { EventEmitter } from 'events';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface CloudEnvironmentConfig {
  id: string;
  name: string;
  description?: string;
  networkAccess: 'full' | 'no-internet' | 'custom';
  allowedDomains?: string[];
  blockedDomains?: string[];
  environmentVariables?: Record<string, string>;
  preinstalledTools?: string[];
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CloudEnvironmentCreateOptions {
  name: string;
  description?: string;
  networkAccess?: 'full' | 'no-internet' | 'custom';
  allowedDomains?: string[];
  blockedDomains?: string[];
  environmentVariables?: Record<string, string>;
  preinstalledTools?: string[];
  isDefault?: boolean;
}

const DEFAULT_ENVIRONMENTS: CloudEnvironmentConfig[] = [
  {
    id: 'default-full',
    name: 'Full Internet',
    description: 'Full internet access for remote sessions',
    networkAccess: 'full',
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'default-offline',
    name: 'No Internet',
    description: 'Isolated environment without internet access',
    networkAccess: 'no-internet',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class CloudEnvironmentManager extends EventEmitter {
  private environments: Map<string, CloudEnvironmentConfig> = new Map();
  private configPath: string;

  constructor(configDir?: string) {
    super();
    this.configPath = path.join(configDir || app.getPath('userData'), 'cloud-environments.json');
    this.loadEnvironments();
  }

  private loadEnvironments(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data) as CloudEnvironmentConfig[];
        
        for (const env of parsed) {
          this.environments.set(env.id, env);
        }
        
        log.info(`Loaded ${this.environments.size} cloud environments`);
      } else {
        for (const env of DEFAULT_ENVIRONMENTS) {
          this.environments.set(env.id, env);
        }
        this.saveEnvironments();
      }
    } catch (error) {
      log.error('Failed to load cloud environments:', error);
      for (const env of DEFAULT_ENVIRONMENTS) {
        this.environments.set(env.id, env);
      }
    }
  }

  private saveEnvironments(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const environments = Array.from(this.environments.values());
      fs.writeFileSync(this.configPath, JSON.stringify(environments, null, 2));
      log.info('Saved cloud environments');
    } catch (error) {
      log.error('Failed to save cloud environments:', error);
    }
  }

  async createEnvironment(options: CloudEnvironmentCreateOptions): Promise<CloudEnvironmentConfig> {
    const id = `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const environment: CloudEnvironmentConfig = {
      id,
      name: options.name,
      description: options.description,
      networkAccess: options.networkAccess || 'full',
      allowedDomains: options.allowedDomains,
      blockedDomains: options.blockedDomains,
      environmentVariables: options.environmentVariables,
      preinstalledTools: options.preinstalledTools,
      isDefault: options.isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (options.isDefault) {
      for (const [envId, env] of this.environments) {
        if (env.isDefault) {
          env.isDefault = false;
          this.environments.set(envId, env);
        }
      }
    }

    this.environments.set(id, environment);
    this.saveEnvironments();
    
    this.emit('environment:created', environment);
    log.info(`Created cloud environment: ${id}`);
    
    return environment;
  }

  async updateEnvironment(
    id: string,
    updates: Partial<CloudEnvironmentCreateOptions>
  ): Promise<CloudEnvironmentConfig> {
    const environment = this.environments.get(id);
    if (!environment) {
      throw new Error(`Environment ${id} not found`);
    }

    if (updates.isDefault) {
      for (const [envId, env] of this.environments) {
        if (env.isDefault && envId !== id) {
          env.isDefault = false;
          this.environments.set(envId, env);
        }
      }
    }

    const updated: CloudEnvironmentConfig = {
      ...environment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.environments.set(id, updated);
    this.saveEnvironments();
    
    this.emit('environment:updated', updated);
    log.info(`Updated cloud environment: ${id}`);
    
    return updated;
  }

  async deleteEnvironment(id: string): Promise<void> {
    const environment = this.environments.get(id);
    if (!environment) {
      throw new Error(`Environment ${id} not found`);
    }

    if (environment.isDefault) {
      throw new Error('Cannot delete the default environment');
    }

    this.environments.delete(id);
    this.saveEnvironments();
    
    this.emit('environment:deleted', id);
    log.info(`Deleted cloud environment: ${id}`);
  }

  getEnvironment(id: string): CloudEnvironmentConfig | undefined {
    return this.environments.get(id);
  }

  getAllEnvironments(): CloudEnvironmentConfig[] {
    return Array.from(this.environments.values());
  }

  getDefaultEnvironment(): CloudEnvironmentConfig | undefined {
    for (const env of this.environments.values()) {
      if (env.isDefault) {
        return env;
      }
    }
    return this.environments.values().next().value;
  }

  async setDefaultEnvironment(id: string): Promise<void> {
    const environment = this.environments.get(id);
    if (!environment) {
      throw new Error(`Environment ${id} not found`);
    }

    for (const [envId, env] of this.environments) {
      env.isDefault = envId === id;
      this.environments.set(envId, env);
    }

    this.saveEnvironments();
    this.emit('environment:default-changed', id);
    log.info(`Set default environment to: ${id}`);
  }

  validateEnvironment(environment: CloudEnvironmentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!environment.name || environment.name.trim().length === 0) {
      errors.push('Environment name is required');
    }

    if (environment.networkAccess === 'custom') {
      if (!environment.allowedDomains || environment.allowedDomains.length === 0) {
        errors.push('Custom network access requires at least one allowed domain');
      }
    }

    if (environment.environmentVariables) {
      for (const [key, value] of Object.entries(environment.environmentVariables)) {
        if (key.startsWith('ANTHROPIC_') || key.startsWith('CLAUDE_')) {
          errors.push(`Cannot override reserved environment variable: ${key}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  cleanup(): void {
    this.environments.clear();
    this.removeAllListeners();
  }
}

export default CloudEnvironmentManager;
