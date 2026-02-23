import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export type ThemeMode = 'light' | 'dark' | 'system';
export type LayoutMode = 'default' | 'compact' | 'focus' | 'custom';
export type FontSize = 'small' | 'medium' | 'large';

export interface Theme {
  id: string;
  name: string;
  mode: 'light' | 'dark';
  colors: ThemeColors;
  isCustom: boolean;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
}

export interface Layout {
  id: string;
  name: string;
  sidebarPosition: 'left' | 'right' | 'hidden';
  sidebarWidth: number;
  showHeader: boolean;
  showStatusBar: boolean;
  showTabs: boolean;
  terminalPosition: 'bottom' | 'right' | 'hidden';
}

export interface KeyboardShortcut {
  id: string;
  action: string;
  keys: string;
  description: string;
  category: string;
}

export interface UserPreferences {
  theme: ThemeMode;
  customThemeId?: string;
  layout: LayoutMode;
  customLayout?: Partial<Layout>;
  fontSize: FontSize;
  fontFamily: string;
  lineHeight: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  cursorBlinking: boolean;
  cursorStyle: 'line' | 'block' | 'underline';
  smoothScrolling: boolean;
  mouseWheelZoom: boolean;
}

export interface CustomizationConfig {
  enableCustomThemes: boolean;
  enableCustomLayouts: boolean;
  enableKeyboardShortcuts: boolean;
}

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'light',
    name: 'Light',
    mode: 'light',
    isCustom: false,
    colors: {
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#8b5cf6',
      background: '#ffffff',
      foreground: '#0f172a',
      muted: '#f1f5f9',
      border: '#e2e8f0',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    isCustom: false,
    colors: {
      primary: '#3b82f6',
      secondary: '#94a3b8',
      accent: '#8b5cf6',
      background: '#0f172a',
      foreground: '#f8fafc',
      muted: '#1e293b',
      border: '#334155',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    isCustom: false,
    colors: {
      primary: '#6366f1',
      secondary: '#818cf8',
      accent: '#a78bfa',
      background: '#020617',
      foreground: '#e2e8f0',
      muted: '#0f172a',
      border: '#1e293b',
      success: '#10b981',
      warning: '#fbbf24',
      error: '#f43f5e',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    mode: 'dark',
    isCustom: false,
    colors: {
      primary: '#bd93f9',
      secondary: '#6272a4',
      accent: '#ff79c6',
      background: '#282a36',
      foreground: '#f8f8f2',
      muted: '#44475a',
      border: '#6272a4',
      success: '#50fa7b',
      warning: '#f1fa8c',
      error: '#ff5555',
    },
  },
];

const DEFAULT_LAYOUTS: Layout[] = [
  {
    id: 'default',
    name: 'Default',
    sidebarPosition: 'left',
    sidebarWidth: 280,
    showHeader: true,
    showStatusBar: true,
    showTabs: true,
    terminalPosition: 'bottom',
  },
  {
    id: 'compact',
    name: 'Compact',
    sidebarPosition: 'left',
    sidebarWidth: 220,
    showHeader: false,
    showStatusBar: true,
    showTabs: false,
    terminalPosition: 'bottom',
  },
  {
    id: 'focus',
    name: 'Focus',
    sidebarPosition: 'hidden',
    sidebarWidth: 0,
    showHeader: false,
    showStatusBar: false,
    showTabs: false,
    terminalPosition: 'hidden',
  },
];

const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { id: '1', action: 'files.new', keys: 'Ctrl+N', description: 'New file', category: 'File' },
  { id: '2', action: 'files.open', keys: 'Ctrl+O', description: 'Open file', category: 'File' },
  { id: '3', action: 'files.save', keys: 'Ctrl+S', description: 'Save file', category: 'File' },
  { id: '4', action: 'files.saveAll', keys: 'Ctrl+Shift+S', description: 'Save all files', category: 'File' },
  { id: '5', action: 'files.close', keys: 'Ctrl+W', description: 'Close file', category: 'File' },
  { id: '6', action: 'edit.undo', keys: 'Ctrl+Z', description: 'Undo', category: 'Edit' },
  { id: '7', action: 'edit.redo', keys: 'Ctrl+Y', description: 'Redo', category: 'Edit' },
  { id: '8', action: 'edit.cut', keys: 'Ctrl+X', description: 'Cut', category: 'Edit' },
  { id: '9', action: 'edit.copy', keys: 'Ctrl+C', description: 'Copy', category: 'Edit' },
  { id: '10', action: 'edit.paste', keys: 'Ctrl+V', description: 'Paste', category: 'Edit' },
  { id: '11', action: 'edit.find', keys: 'Ctrl+F', description: 'Find', category: 'Edit' },
  { id: '12', action: 'edit.replace', keys: 'Ctrl+H', description: 'Find and replace', category: 'Edit' },
  { id: '13', action: 'view.sidebar', keys: 'Ctrl+B', description: 'Toggle sidebar', category: 'View' },
  { id: '14', action: 'view.terminal', keys: 'Ctrl+`', description: 'Toggle terminal', category: 'View' },
  { id: '15', action: 'view.fullscreen', keys: 'F11', description: 'Toggle fullscreen', category: 'View' },
  { id: '16', action: 'view.zoomIn', keys: 'Ctrl++', description: 'Zoom in', category: 'View' },
  { id: '17', action: 'view.zoomOut', keys: 'Ctrl+-', description: 'Zoom out', category: 'View' },
  { id: '18', action: 'agent.new', keys: 'Ctrl+Shift+N', description: 'New agent', category: 'Agent' },
  { id: '19', action: 'agent.run', keys: 'Ctrl+Enter', description: 'Run agent', category: 'Agent' },
  { id: '20', action: 'agent.stop', keys: 'Ctrl+Shift+.', description: 'Stop agent', category: 'Agent' },
];

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  layout: 'default',
  fontSize: 'medium',
  fontFamily: 'JetBrains Mono, Consolas, monospace',
  lineHeight: 1.5,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  cursorBlinking: true,
  cursorStyle: 'line',
  smoothScrolling: true,
  mouseWheelZoom: true,
};

export class CustomizationManager extends EventEmitter {
  private themes: Map<string, Theme> = new Map();
  private layouts: Map<string, Layout> = new Map();
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private preferences: UserPreferences;
  private config: CustomizationConfig;

  constructor(config?: Partial<CustomizationConfig>) {
    super();
    this.config = {
      enableCustomThemes: config?.enableCustomThemes ?? true,
      enableCustomLayouts: config?.enableCustomLayouts ?? true,
      enableKeyboardShortcuts: config?.enableKeyboardShortcuts ?? true,
    };
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    DEFAULT_THEMES.forEach((theme) => this.themes.set(theme.id, theme));
    DEFAULT_LAYOUTS.forEach((layout) => this.layouts.set(layout.id, layout));
    DEFAULT_SHORTCUTS.forEach((shortcut) => this.shortcuts.set(shortcut.action, shortcut));
    log.info('CustomizationManager initialized with defaults');
  }

  configure(config: Partial<CustomizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CustomizationConfig {
    return { ...this.config };
  }

  getPreferences(): UserPreferences {
    return { ...this.preferences };
  }

  updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
    this.preferences = { ...this.preferences, ...updates };
    this.emit('preferences:updated', this.preferences);
    log.info('Preferences updated', updates);
    return this.preferences;
  }

  setPreferences(preferences: UserPreferences): void {
    this.preferences = preferences;
    this.emit('preferences:updated', this.preferences);
  }

  resetPreferences(): UserPreferences {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.emit('preferences:reset', this.preferences);
    return this.preferences;
  }

  getThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  getTheme(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  getCurrentTheme(): Theme {
    const { theme, customThemeId } = this.preferences;
    
    if (theme === 'system') {
      return this.themes.get('dark')!;
    }
    
    if (customThemeId) {
      return this.themes.get(customThemeId) || this.themes.get('dark')!;
    }
    
    return this.themes.get(theme) || this.themes.get('dark')!;
  }

  createTheme(name: string, colors: ThemeColors, mode: 'light' | 'dark'): Theme {
    if (!this.config.enableCustomThemes) {
      throw new Error('Custom themes are disabled');
    }

    const theme: Theme = {
      id: uuidv4(),
      name,
      mode,
      colors,
      isCustom: true,
    };

    this.themes.set(theme.id, theme);
    this.emit('theme:created', theme);
    log.info(`Custom theme created: ${name}`);
    return theme;
  }

  updateTheme(id: string, updates: Partial<ThemeColors>): Theme | null {
    const theme = this.themes.get(id);
    if (!theme || !theme.isCustom) return null;

    theme.colors = { ...theme.colors, ...updates };
    this.emit('theme:updated', theme);
    return theme;
  }

  deleteTheme(id: string): boolean {
    const theme = this.themes.get(id);
    if (!theme || !theme.isCustom) return false;

    this.themes.delete(id);
    this.emit('theme:deleted', { id });
    return true;
  }

  getLayouts(): Layout[] {
    return Array.from(this.layouts.values());
  }

  getLayout(id: string): Layout | undefined {
    return this.layouts.get(id);
  }

  getCurrentLayout(): Layout {
    const { layout, customLayout } = this.preferences;
    const defaultLayout = this.layouts.get(layout);
    
    if (customLayout && layout === 'custom') {
      return { ...defaultLayout!, ...customLayout };
    }
    
    return defaultLayout || this.layouts.get('default')!;
  }

  createLayout(name: string, config: Omit<Layout, 'id' | 'name'>): Layout {
    if (!this.config.enableCustomLayouts) {
      throw new Error('Custom layouts are disabled');
    }

    const layout: Layout = {
      id: uuidv4(),
      name,
      ...config,
    };

    this.layouts.set(layout.id, layout);
    this.emit('layout:created', layout);
    return layout;
  }

  updateLayout(id: string, updates: Partial<Layout>): Layout | null {
    const layout = this.layouts.get(id);
    if (!layout) return null;

    Object.assign(layout, updates);
    this.emit('layout:updated', layout);
    return layout;
  }

  deleteLayout(id: string): boolean {
    const layout = this.layouts.get(id);
    if (!layout || layout.id === 'default') return false;

    this.layouts.delete(id);
    this.emit('layout:deleted', { id });
    return true;
  }

  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  getShortcut(action: string): KeyboardShortcut | undefined {
    return this.shortcuts.get(action);
  }

  getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
    const byCategory: Record<string, KeyboardShortcut[]> = {};
    
    this.shortcuts.forEach((shortcut) => {
      if (!byCategory[shortcut.category]) {
        byCategory[shortcut.category] = [];
      }
      byCategory[shortcut.category].push(shortcut);
    });
    
    return byCategory;
  }

  createShortcut(shortcut: Omit<KeyboardShortcut, 'id'>): KeyboardShortcut {
    if (!this.config.enableKeyboardShortcuts) {
      throw new Error('Keyboard shortcuts are disabled');
    }

    const newShortcut: KeyboardShortcut = {
      id: uuidv4(),
      ...shortcut,
    };

    this.shortcuts.set(newShortcut.action, newShortcut);
    this.emit('shortcut:created', newShortcut);
    return newShortcut;
  }

  updateShortcut(action: string, updates: Partial<KeyboardShortcut>): KeyboardShortcut | null {
    const shortcut = this.shortcuts.get(action);
    if (!shortcut) return null;

    Object.assign(shortcut, updates);
    this.emit('shortcut:updated', shortcut);
    return shortcut;
  }

  deleteShortcut(action: string): boolean {
    const shortcut = this.shortcuts.get(action);
    if (!shortcut) return false;

    this.shortcuts.delete(action);
    this.emit('shortcut:deleted', { action });
    return true;
  }

  resetShortcuts(): void {
    this.shortcuts.clear();
    DEFAULT_SHORTCUTS.forEach((shortcut) => this.shortcuts.set(shortcut.action, shortcut));
    this.emit('shortcuts:reset');
  }

  exportPreferences(): string {
    return JSON.stringify({
      preferences: this.preferences,
      customThemes: Array.from(this.themes.values()).filter((t) => t.isCustom),
      customLayouts: Array.from(this.layouts.values()).filter((l) => l.id !== 'default' && l.id !== 'compact' && l.id !== 'focus'),
      customShortcuts: Array.from(this.shortcuts.values()),
    }, null, 2);
  }

  importPreferences(json: string): boolean {
    try {
      const data = JSON.parse(json);
      
      if (data.preferences) {
        this.preferences = { ...DEFAULT_PREFERENCES, ...data.preferences };
      }
      
      if (data.customThemes) {
        data.customThemes.forEach((theme: Theme) => {
          this.themes.set(theme.id, theme);
        });
      }
      
      if (data.customLayouts) {
        data.customLayouts.forEach((layout: Layout) => {
          this.layouts.set(layout.id, layout);
        });
      }

      this.emit('preferences:imported');
      return true;
    } catch (error) {
      log.error('Failed to import preferences:', error);
      return false;
    }
  }

  cleanup(): void {
    this.themes.clear();
    this.layouts.clear();
    this.shortcuts.clear();
    this.removeAllListeners();
    log.info('CustomizationManager cleaned up');
  }
}

export default CustomizationManager;
