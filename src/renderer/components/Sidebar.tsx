import React from 'react';
import { 
  Bot, 
  GitBranch, 
  Wrench, 
  Clock, 
  Settings,
  ChevronRight,
  Code2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const menuItems = [
  { id: 'agents', label: 'Agents', icon: Bot, description: 'Manage AI agents' },
  { id: 'code', label: 'Code', icon: Code2, description: 'Code editor' },
  { id: 'worktrees', label: 'Worktrees', icon: GitBranch, description: 'Git workspaces' },
  { id: 'skills', label: 'Skills', icon: Wrench, description: 'Reusable prompts' },
  { id: 'automations', label: 'Automations', icon: Clock, description: 'Scheduled tasks' },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  return (
    <aside className="w-64 bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] flex flex-col" data-testid="sidebar">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-lg tracking-tight">Codex</span>
            <span className="text-xs text-neutral-400 block">Linux</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                isActive 
                  ? 'bg-neutral-900 text-white shadow-sm' 
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              )}
              data-testid={`nav-${item.id}`}
            >
              <Icon className={cn(
                'w-4 h-4 transition-transform duration-200',
                isActive ? '' : 'group-hover:scale-110'
              )} />
              <div className="flex-1 text-left">
                <span className="block">{item.label}</span>
                {!isActive && (
                  <span className="text-xs text-neutral-400 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.description}
                  </span>
                )}
              </div>
              {isActive && (
                <ChevronRight className="w-4 h-4 opacity-50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === 'settings'
              ? 'bg-neutral-900 text-white' 
              : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
          )}
          data-testid="nav-settings"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};