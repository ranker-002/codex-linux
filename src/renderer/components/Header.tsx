import React from 'react';
import { Agent } from '../../shared/types';
import { Minus, Square, X, Search } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  agents: Agent[];
  onSettingsClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, agents }) => {
  const runningAgents = agents.filter(a => a.status === 'running').length;

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
    <header 
      className="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between px-5"
      data-testid="app-header"
    >
      <div className="flex items-center gap-4">
        <div>
          <h1 
            className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight"
            data-testid="page-title"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
          >
            {getTitle()}
          </h1>
        </div>
        
        {activeTab === 'agents' && runningAgents > 0 && (
          <div className="flex items-center gap-2 px-3 py-1 bg-[rgba(60,200,120,0.1)] border border-[rgba(60,200,120,0.2)] rounded-full text-[11px] font-medium text-[var(--success)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]"></span>
            </span>
            {runningAgents} running
          </div>
        )}

        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-8 pr-3 py-1.5 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] w-56 focus:outline-none focus:border-[var(--teal-500)] transition-colors"
            data-testid="search-input"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleMinimize}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          data-testid="window-minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          data-testid="window-maximize"
        >
          <Square className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-[rgba(232,90,106,0.1)] hover:text-[var(--error)] rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors"
          data-testid="window-close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
