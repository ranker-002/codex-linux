import { EventEmitter } from 'events';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface WorktreeSettings {
  worktreeLocation: string;
  branchPrefix: string;
  autoCleanup: boolean;
  maxWorktrees: number;
}

export interface SessionSettings {
  contextCompactionThreshold: number;
  autoCompact: boolean;
  compactOnClose: boolean;
}

export interface ClaudeCodeSettings {
  worktree: WorktreeSettings;
  session: SessionSettings;
}

const DEFAULT_SETTINGS: ClaudeCodeSettings = {
  worktree: {
    worktreeLocation: '.claude/worktrees',
    branchPrefix: 'claude-',
    autoCleanup: true,
    maxWorktrees: 10,
  },
  session: {
    contextCompactionThreshold: 0.8,
    autoCompact: true,
    compactOnClose: true,
  },
};

export class SettingsManager extends EventEmitter {
  private settings: ClaudeCodeSettings;
  private settingsPath: string;

  constructor(configDir?: string) {
    super();
    this.settingsPath = path.join(configDir || app.getPath('userData'), 'codex-settings.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): ClaudeCodeSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data) as Partial<ClaudeCodeSettings>;
        
        return {
          worktree: { ...DEFAULT_SETTINGS.worktree, ...parsed.worktree },
          session: { ...DEFAULT_SETTINGS.session, ...parsed.session },
        };
      }
    } catch (error) {
      log.error('Failed to load settings:', error);
    }
    
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      log.info('Settings saved');
    } catch (error) {
      log.error('Failed to save settings:', error);
    }
  }

  getWorktreeSettings(): WorktreeSettings {
    return { ...this.settings.worktree };
  }

  async setWorktreeLocation(location: string): Promise<void> {
    this.settings.worktree.worktreeLocation = location;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Worktree location set to: ${location}`);
  }

  async setBranchPrefix(prefix: string): Promise<void> {
    this.settings.worktree.branchPrefix = prefix;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Branch prefix set to: ${prefix}`);
  }

  async setWorktreeAutoCleanup(enabled: boolean): Promise<void> {
    this.settings.worktree.autoCleanup = enabled;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Worktree auto-cleanup: ${enabled}`);
  }

  async setMaxWorktrees(max: number): Promise<void> {
    this.settings.worktree.maxWorktrees = max;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Max worktrees set to: ${max}`);
  }

  getSessionSettings(): SessionSettings {
    return { ...this.settings.session };
  }

  async setContextCompactionThreshold(threshold: number): Promise<void> {
    this.settings.session.contextCompactionThreshold = Math.max(0, Math.min(1, threshold));
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Context compaction threshold set to: ${threshold}`);
  }

  async setAutoCompact(enabled: boolean): Promise<void> {
    this.settings.session.autoCompact = enabled;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Auto-compact: ${enabled}`);
  }

  async setCompactOnClose(enabled: boolean): Promise<void> {
    this.settings.session.compactOnClose = enabled;
    this.saveSettings();
    this.emit('settings:updated', this.settings);
    log.info(`Compact on close: ${enabled}`);
  }

  getAllSettings(): ClaudeCodeSettings {
    return { ...this.settings };
  }

  async updateSettings(updates: Partial<ClaudeCodeSettings>): Promise<void> {
    this.settings = {
      worktree: { ...this.settings.worktree, ...updates.worktree },
      session: { ...this.settings.session, ...updates.session },
    };
    this.saveSettings();
    this.emit('settings:updated', this.settings);
  }

  async resetToDefaults(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
    this.emit('settings:reset');
    log.info('Settings reset to defaults');
  }

  cleanup(): void {
    this.removeAllListeners();
  }
}

export default SettingsManager;
