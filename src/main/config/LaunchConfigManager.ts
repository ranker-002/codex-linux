import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import log from 'electron-log';

export interface PreviewServerConfig {
  name: string;
  runtimeExecutable: string;
  runtimeArgs: string[];
  port: number;
  cwd?: string;
  env?: Record<string, string>;
  autoPort: boolean;
  program?: string;
  args?: string[];
}

export interface LaunchConfig {
  version: string;
  autoVerify?: boolean;
  configurations: PreviewServerConfig[];
}

export class LaunchConfigManager extends EventEmitter {
  private configPath: string;
  private config: LaunchConfig | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
    this.configPath = path.join(projectRoot, '.claude', 'launch.json');
  }

  async load(): Promise<LaunchConfig | null> {
    try {
      if (!fs.existsSync(this.configPath)) {
        log.info('No launch.json found, will auto-detect');
        return null;
      }

      const content = fs.readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(content) as LaunchConfig;
      
      log.info(`Loaded launch config with ${this.config.configurations.length} server(s)`);
      this.emit('config:loaded', this.config);
      
      return this.config;
    } catch (error) {
      log.error('Failed to load launch.json:', error);
      return null;
    }
  }

  async save(config: LaunchConfig): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      this.config = config;
      
      log.info('Saved launch.json');
      this.emit('config:saved', config);
    } catch (error) {
      log.error('Failed to save launch.json:', error);
      throw error;
    }
  }

  async autoDetect(projectRoot: string): Promise<PreviewServerConfig[]> {
    const servers: PreviewServerConfig[] = [];

    try {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      
      if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (pkg.scripts?.dev) {
          servers.push({
            name: 'dev',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'dev'],
            port: 3000,
            autoPort: true
          });
        }
        
        if (pkg.scripts?.start && pkg.scripts.start !== pkg.scripts?.dev) {
          servers.push({
            name: 'start',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'start'],
            port: 3000,
            autoPort: true
          });
        }

        if (pkg.scripts?.serve) {
          servers.push({
            name: 'serve',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'serve'],
            port: 3000,
            autoPort: true
          });
        }

        if (pkg.scripts?.next && pkg.scripts.next.startsWith('next')) {
          servers.push({
            name: 'next',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'next', 'dev'],
            port: 3000,
            autoPort: true
          });
        }
      }

      const nextConfigPath = path.join(projectRoot, 'next.config.js');
      if (fs.existsSync(nextConfigPath)) {
        const existing = servers.find(s => s.name === 'next');
        if (existing) {
          existing.port = 3000;
        }
      }

      const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
      if (fs.existsSync(viteConfigPath)) {
        const existing = servers.find(s => s.name === 'dev');
        if (existing) {
          existing.port = 5173;
        } else {
          servers.push({
            name: 'vite',
            runtimeExecutable: 'npm',
            runtimeArgs: ['run', 'dev'],
            port: 5173,
            autoPort: true
          });
        }
      }

      const webpackConfigPath = path.join(projectRoot, 'webpack.config.js');
      if (fs.existsSync(webpackConfigPath)) {
        servers.push({
          name: 'webpack',
          runtimeExecutable: 'npm',
          runtimeArgs: ['run', 'dev'],
          port: 8080,
          autoPort: true
        });
      }

      const expressPath = path.join(projectRoot, 'server.js');
      const expressIndexPath = path.join(projectRoot, 'index.js');
      if (fs.existsSync(expressPath) || fs.existsSync(expressIndexPath)) {
        servers.push({
          name: 'server',
          runtimeExecutable: 'node',
          runtimeArgs: [fs.existsSync(expressPath) ? 'server.js' : 'index.js'],
          port: 3000,
          autoPort: true
        });
      }

    } catch (error) {
      log.error('Failed to auto-detect servers:', error);
    }

    return servers;
  }

  getConfig(): LaunchConfig | null {
    return this.config;
  }

  getServer(name: string): PreviewServerConfig | undefined {
    return this.config?.configurations.find(c => c.name === name);
  }

  getAllServers(): PreviewServerConfig[] {
    return this.config?.configurations || [];
  }

  addServer(server: PreviewServerConfig): void {
    if (!this.config) {
      this.config = {
        version: '0.0.1',
        configurations: []
      };
    }
    
    const existing = this.config.configurations.findIndex(c => c.name === server.name);
    if (existing >= 0) {
      this.config.configurations[existing] = server;
    } else {
      this.config.configurations.push(server);
    }
  }

  removeServer(name: string): void {
    if (this.config) {
      this.config.configurations = this.config.configurations.filter(c => c.name !== name);
    }
  }
}

export default LaunchConfigManager;
