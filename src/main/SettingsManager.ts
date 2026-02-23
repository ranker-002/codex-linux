import Store from 'electron-store';
import { Settings } from '../shared/types';

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 14,
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  autoSave: true,
  autoSaveInterval: 30000,
  defaultProvider: 'openai',
  defaultModel: 'gpt-4o',
  maxParallelAgents: 5,
  showNotifications: true,
  confirmDestructiveActions: true,
  gitAuthorName: '',
  gitAuthorEmail: '',
  customSkillsPath: '',
  shortcuts: {
    'agent:new': 'Ctrl+Shift+N',
    'agent:send': 'Ctrl+Enter',
    'worktree:new': 'Ctrl+Shift+W',
    'skills:open': 'Ctrl+Shift+S',
    'automation:open': 'Ctrl+Shift+A',
    'settings:open': 'Ctrl+,',
    'command:palette': 'Ctrl+Shift+P'
  }
};

export class SettingsManager {
  constructor(private store: Store) {}

  get<K extends keyof Settings>(key: K): Settings[K] {
    return this.store.get(key as string, DEFAULT_SETTINGS[key]) as Settings[K];
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.store.set(key as string, value);
  }

  getAny(key: string): any {
    return this.store.get(key);
  }

  setAny(key: string, value: any): void {
    this.store.set(key, value);
  }

  getAll(): Settings {
    const settings = { ...DEFAULT_SETTINGS };
    const keys = Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>;
    for (const key of keys) {
      const value = this.store.get(key as string);
      if (value !== undefined) {
        (settings as any)[key] = value;
      }
    }
    return settings;
  }

  reset(): void {
    this.store.clear();
  }
}