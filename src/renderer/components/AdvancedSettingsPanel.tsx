import React, { useState } from 'react';
import { Folder, GitBranch, Zap, Save, RotateCcw } from 'lucide-react';

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

interface AdvancedSettingsPanelProps {
  worktreeSettings: WorktreeSettings;
  sessionSettings: SessionSettings;
  onWorktreeSettingsChange: (settings: Partial<WorktreeSettings>) => void;
  onSessionSettingsChange: (settings: Partial<SessionSettings>) => void;
  onSave: () => void;
  onReset: () => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export const AdvancedSettingsPanel: React.FC<AdvancedSettingsPanelProps> = ({
  worktreeSettings,
  sessionSettings,
  onWorktreeSettingsChange,
  onSessionSettingsChange,
  onSave,
  onReset,
}) => {
  const [activeTab, setActiveTab] = useState<'worktree' | 'session'>('worktree');

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Advanced Settings</h2>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('worktree')}
            className={cn(
              'px-4 py-2 text-sm rounded-lg transition-colors',
              activeTab === 'worktree'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <GitBranch className="w-4 h-4 inline mr-2" />
            Worktree
          </button>
          <button
            onClick={() => setActiveTab('session')}
            className={cn(
              'px-4 py-2 text-sm rounded-lg transition-colors',
              activeTab === 'session'
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            Session
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'worktree' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Folder className="w-4 h-4" />
                Worktree Location
              </label>
              <input
                type="text"
                value={worktreeSettings.worktreeLocation}
                onChange={(e) => onWorktreeSettingsChange({ worktreeLocation: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm"
                placeholder=".claude/worktrees"
              />
              <p className="text-xs text-muted-foreground">
                Directory where Git worktrees will be created
              </p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <GitBranch className="w-4 h-4" />
                Branch Prefix
              </label>
              <input
                type="text"
                value={worktreeSettings.branchPrefix}
                onChange={(e) => onWorktreeSettingsChange({ branchPrefix: e.target.value })}
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm"
                placeholder="claude-"
              />
              <p className="text-xs text-muted-foreground">
                Prefix added to all Claude-created branches
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Worktrees</label>
              <input
                type="number"
                min="1"
                max="50"
                value={worktreeSettings.maxWorktrees}
                onChange={(e) => onWorktreeSettingsChange({ maxWorktrees: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 bg-muted border border-input rounded-lg text-sm"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto Cleanup</label>
                <p className="text-xs text-muted-foreground">
                  Automatically remove worktrees when session ends
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={worktreeSettings.autoCleanup}
                  onChange={(e) => onWorktreeSettingsChange({ autoCleanup: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
          </div>
        )}

        {activeTab === 'session' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Context Compaction Threshold: {Math.round(sessionSettings.contextCompactionThreshold * 100)}%
              </label>
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={sessionSettings.contextCompactionThreshold}
                onChange={(e) => onSessionSettingsChange({ contextCompactionThreshold: parseFloat(e.target.value) })}
                className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Auto Compact</label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessionSettings.autoCompact}
                  onChange={(e) => onSessionSettingsChange({ autoCompact: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">Compact on Close</label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sessionSettings.compactOnClose}
                  onChange={(e) => onSessionSettingsChange({ compactOnClose: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>

            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Manual Compaction</p>
              <p className="text-xs text-muted-foreground">
                Type <code className="px-1 py-0.5 bg-background rounded">/compact</code> to manually trigger context compaction.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
        
        <button
          onClick={onSave}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
};

export default AdvancedSettingsPanel;
