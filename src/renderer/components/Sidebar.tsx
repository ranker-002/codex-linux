import React, { useRef, useEffect } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Agent } from '../../shared/types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  agents: Agent[];
  selectedAgentId?: string;
  onSelectAgent: (agent: Agent) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  width: number;
  onResize: (width: number) => void;
}

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

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

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  agents,
  selectedAgentId,
  onSelectAgent,
  collapsed,
  onToggleCollapse,
  width,
  onResize
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onResize]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
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
    <aside 
      ref={sidebarRef}
      className={`sidebar ${collapsed ? 'collapsed' : ''}`}
      data-testid="sidebar"
      style={{ width: collapsed ? 60 : width }}
    >
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <span className="sidebar-logo-glyph" />
          </div>
          {!collapsed && <span className="sidebar-logo-text">Codlux</span>}
        </div>
        <button className="sidebar-header-toggle" onClick={onToggleCollapse} title="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <>
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
              {agents.length === 0 ? (
                <div className="sidebar-empty-state">
                  <p>No active sessions</p>
                  <p className="sidebar-empty-hint">Start a new chat to begin</p>
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className={`sidebar-session-item ${selectedAgentId === agent.id ? 'selected' : ''}`}
                data-testid={`session-${agent.id}`}
              >
                <span className="sidebar-session-dot" />
                <span className="sidebar-session-content">
                  <span className="sidebar-session-title">{agent.name}</span>
                  <span className="sidebar-session-meta">{agent.projectPath || 'No project'}</span>
                </span>
                {agent.status === 'running' && <Sparkles className="sidebar-session-star" />}
              </button>
            ))
          )}
        </div>

        <div className="sidebar-nav-filler">
          <span>Start coding</span>
        </div>

        <div className="sidebar-tool-row">
          {operationsItems.map(renderToolIcon)}
        </div>
      </nav>
      </>
      )}

      <div className="sidebar-footer">
        <button
          onClick={() => onTabChange('settings')}
          className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`}
          data-testid="nav-settings"
        >
          <Settings className="sidebar-item-icon" style={{ width: 14, height: 14 }} />
          {!collapsed && <span>Settings</span>}
        </button>

        <div className="sidebar-user-chip">
          <div className="sidebar-user-avatar">J</div>
          {!collapsed && (
            <span className="sidebar-user-meta">
              <span className="sidebar-user-name">Codlux Team</span>
              <span className="sidebar-user-role">Local</span>
            </span>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="sidebar-resize-handle" onMouseDown={handleResizeStart}>
          <div className="sidebar-resize-indicator" />
        </div>
      )}
    </aside>
  );
};
