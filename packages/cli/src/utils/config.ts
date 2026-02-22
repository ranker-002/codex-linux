import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'codex');
const CONFIG_FILE = path.join(CONFIG_DIR, 'cli-config.json');

interface CLIConfig {
  host?: string;
  port?: number;
  apiKey?: string;
  defaultAgent?: string;
  defaultProject?: string;
}

export function getConfig(): CLIConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

export function saveConfig(config: CLIConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export const ConfigCommands = {
  set: new Command('set <key> <value>')
    .description('Set configuration value')
    .action((key, value) => {
      const config = getConfig();
      (config as any)[key] = value;
      saveConfig(config);
      console.log(`Set ${key} = ${value}`);
    }),

  get: new Command('get <key>')
    .description('Get configuration value')
    .action((key) => {
      const config = getConfig();
      const value = (config as any)[key];
      console.log(value || '(not set)');
    }),

  list: new Command('list')
    .description('List all configuration')
    .action(() => {
      const config = getConfig();
      console.log(JSON.stringify(config, null, 2));
    }),
};

import { Command } from 'commander';