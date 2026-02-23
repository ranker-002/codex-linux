import React from 'react';
import { Agent } from '../../shared/types';
import { Bot, MoreVertical, Minus, Square, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceCommand } from './VoiceCommand';

interface HeaderProps {
  activeTab: string;
  agents: Agent[];
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, agents, onSettingsClick }) => {
  const runningAgents = agents.filter(a => a.status === 'running').length;

  const handleVoiceCommand = (transcript: string) => {
    console.log('Voice command:', transcript);
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'agents': return 'Agents';
      case 'worktrees': return 'Worktrees';
      case 'skills': return 'Skills';
      case 'automations': return 'Automations';
      case 'settings': return 'Settings';
      default: return 'Codex';
    }
  };

  const getDescription = () => {
    switch (activeTab) {
      case 'agents': return 'Manage your AI coding agents';
      case 'worktrees': return 'Isolated Git workspaces';
      case 'skills': return 'Reusable AI capabilities';
      case 'automations': return 'Scheduled tasks and workflows';
      case 'settings': return 'Configure your preferences';
      default: return '';
    }
  };

  const handleMinimize = () => {
    window.electronAPI.window.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI.window.maximize();
  };

  const handleClose = () => {
    window.electronAPI.window.close();
  };

  return (
    <header className="h-16 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] flex items-center justify-between px-6" data-testid="app-header">
      <div className="flex items-center gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]" data-testid="page-title">
            {getTitle()}
          </h1>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {getDescription()}
          </p>
        </div>
        
        {activeTab === 'agents' && runningAgents > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium" data-testid="running-agents-badge">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {runningAgents} running
          </div>
        )}

        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-4 py-2 bg-neutral-100 border-0 rounded-lg text-sm w-64 focus:ring-2 focus:ring-neutral-200 transition-all"
            data-testid="search-input"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
          data-testid="window-minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
          data-testid="window-maximize"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg text-neutral-500 transition-colors"
          data-testid="window-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};