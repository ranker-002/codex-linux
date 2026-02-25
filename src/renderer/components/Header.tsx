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
      case 'audit': return 'Audit Trail';
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
    <header className="topbar" data-testid="app-header">
      <div className="flex items-center gap-4" style={{ flex: 1 }}>
        <h1 
          className="topbar-title"
          data-testid="page-title"
        >
          {getTitle()}
        </h1>
        
        {activeTab === 'agents' && runningAgents > 0 && (
          <div className="badge badge-success">
            <span className="badge-dot" />
            <span>{runningAgents} running</span>
          </div>
        )}

        <div className="topbar-search">
          <div style={{ position: 'relative' }}>
            <Search 
              style={{ 
                position: 'absolute', 
                left: 12, 
                top: '50%', 
                transform: 'translateY(-50%)',
                width: 14,
                height: 14,
                color: 'var(--text-muted)'
              }} 
            />
            <input
              type="text"
              placeholder="Search..."
              className="input"
              style={{ 
                paddingLeft: 32, 
                width: 200,
                height: 32,
                fontSize: 12
              }}
              data-testid="search-input"
            />
          </div>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          onClick={handleMinimize}
          className="topbar-btn"
          data-testid="window-minimize"
          aria-label="Minimize"
        >
          <Minus style={{ width: 14, height: 14 }} />
        </button>
        <button
          onClick={handleMaximize}
          className="topbar-btn"
          data-testid="window-maximize"
          aria-label="Maximize"
        >
          <Square style={{ width: 12, height: 12 }} />
        </button>
        <button
          onClick={handleClose}
          className="topbar-btn topbar-btn-close"
          data-testid="window-close"
          aria-label="Close"
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
    </header>
  );
};
