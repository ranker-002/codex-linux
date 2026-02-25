import React from 'react';
import { 
  Bot, 
  GitBranch, 
  Wrench, 
  Clock, 
  Settings,
  Code2,
  ScrollText,
  MessageSquare
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'automations', label: 'Automations', icon: Clock },
  { id: 'audit', label: 'Audit', icon: ScrollText },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside 
      className="w-[200px] bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col"
      data-testid="sidebar"
    >
      <div className="p-4 border-b border-[var(--border-faint)]">
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] bg-[var(--teal-500)] rounded-[6px] flex items-center justify-center">
            <span className="text-[12px] font-bold text-[var(--bg-void)] font-[var(--font-body)]">C</span>
          </div>
          <span className="font-medium text-[14px] text-[var(--text-primary)]">Codex</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-[12px] transition-all duration-[150ms] ${
                isActive
                  ? 'bg-[rgba(0,200,168,0.08)] text-[var(--teal-300)] border-l-[2px] border-[var(--teal-500)] pl-[9px]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <Icon className="w-3.5 h-3.5 opacity-50" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[var(--border-faint)]">
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-sm)] text-[12px] transition-all duration-[150ms] ${
            activeTab === 'settings'
              ? 'bg-[rgba(0,200,168,0.08)] text-[var(--teal-300)] border-l-[2px] border-[var(--teal-500)] pl-[9px]'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]'
          }`}
          data-testid="nav-settings"
        >
          <Settings className="w-3.5 h-3.5 opacity-50" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
