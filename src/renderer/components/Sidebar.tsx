import React from 'react';
import { 
  Bot, 
  GitBranch, 
  Wrench, 
  Clock, 
  Settings,
  Code2,
  ScrollText,
  MessageSquare,
  Plus,
  Filter,
  Sparkles,
  PanelLeftClose
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const workspaceItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'code', label: 'Code', icon: Code2 },
];

const operationsItems = [
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'automations', label: 'Automations', icon: Clock },
  { id: 'audit', label: 'Audit', icon: ScrollText },
];

const mockSessions = [
  { id: 's1', title: 'Add retry logic', meta: 'acme/submissions-api' },
  { id: 's2', title: 'Fix race condition', meta: 'acme/order-service' },
  { id: 's3', title: 'Fix dark mode colors', meta: 'acme/mobile' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const renderItem = (item: { id: string; label: string; icon: React.ComponentType<any> }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        className={`sidebar-item ${isActive ? 'active' : ''}`}
        data-testid={`nav-${item.id}`}
      >
        <Icon className="sidebar-item-icon" style={{ width: 14, height: 14 }} />
        <span>{item.label}</span>
      </button>
    );
  };

  const renderToolIcon = (item: { id: string; label: string; icon: React.ComponentType<any> }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        className={`sidebar-tool-icon ${isActive ? 'active' : ''}`}
        title={item.label}
        data-testid={`tool-${item.id}`}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  };

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span className="sidebar-logo-glyph" />
          </div>
          <span className="sidebar-logo-text">Claude</span>
        </div>
        <button className="sidebar-header-toggle" title="Toggle sidebar">
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="sidebar-quick-tabs">
        <button
          onClick={() => onTabChange('chat')}
          className={`sidebar-quick-tab ${activeTab === 'chat' ? 'active' : ''}`}
          data-testid="quick-chat"
        >
          Chat
        </button>
        <button
          onClick={() => onTabChange('code')}
          className={`sidebar-quick-tab ${activeTab === 'code' ? 'active' : ''}`}
          data-testid="quick-code"
        >
          Code
        </button>
      </div>

      <nav className="sidebar-nav" data-testid="sidebar-nav">
        <div className="sidebar-section">
          {workspaceItems.map(renderItem)}
        </div>

        <div className="sidebar-section-divider" />

        <button
          onClick={() => onTabChange('chat')}
          className="sidebar-item"
          data-testid="new-session"
        >
          <Plus className="sidebar-item-icon" style={{ width: 14, height: 14 }} />
          <span>New session</span>
        </button>

        <div className="sidebar-session-header">
          <span>Sessions</span>
          <div className="sidebar-session-header-actions">
            <button
              className="sidebar-session-header-btn"
              onClick={() => onTabChange('chat')}
              title="Create session"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              className="sidebar-session-header-btn"
              onClick={() => onTabChange('chat')}
              title="Filter"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="sidebar-session-list">
          {mockSessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onTabChange('chat')}
              className="sidebar-session-item"
              data-testid={`session-${session.id}`}
            >
              <span className="sidebar-session-dot" />
              <span className="sidebar-session-content">
                <span className="sidebar-session-title">{session.title}</span>
                <span className="sidebar-session-meta">{session.meta}</span>
              </span>
              <Sparkles className="sidebar-session-star" />
            </button>
          ))}
        </div>

        <div className="sidebar-nav-filler">
          <span>Start coding</span>
        </div>

        <div className="sidebar-tool-row">
          {operationsItems.map(renderToolIcon)}
        </div>
      </nav>

      <div className="sidebar-footer">
        <button
          onClick={() => onTabChange('settings')}
          className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          data-testid="nav-settings"
        >
          <Settings className="sidebar-item-icon" style={{ width: 14, height: 14 }} />
          <span>Settings</span>
        </button>

        <div className="sidebar-user-chip">
          <div className="sidebar-user-avatar">J</div>
          <span className="sidebar-user-meta">
            <span className="sidebar-user-name">Claude Team</span>
            <span className="sidebar-user-role">Local</span>
          </span>
        </div>
      </div>
    </aside>
  );
};
