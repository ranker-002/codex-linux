import React, { useState } from 'react';
import {
  Plus,
  MoreHorizontal,
  Cloud,
  CloudOff,
  Terminal,
  Filter,
  Archive,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  GitBranch,
  Circle
} from 'lucide-react';

export type SessionStatus = 'active' | 'archived' | 'running';
export type SessionEnvironment = 'local' | 'cloud' | 'ssh';

export interface Session {
  id: string;
  name: string;
  projectPath: string;
  environment: SessionEnvironment;
  status: SessionStatus;
  model?: string;
  lastActivity: Date;
  createdAt: Date;
  branch?: string;
  prMonitored?: number;
  isLoading?: boolean;
  ciStatus?: 'pending' | 'running' | 'success' | 'failure';
}

interface SessionSidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionNew: () => void;
  onSessionArchive?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionNew,
  onSessionArchive,
  onSessionDelete
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [envFilter, setEnvFilter] = useState<'all' | 'local' | 'cloud' | 'ssh'>('all');
  const [contextMenu, setContextMenu] = useState<string | null>(null);

  const filteredSessions = sessions.filter(session => {
    if (filter === 'active' && session.status !== 'active') return false;
    if (filter === 'archived' && session.status !== 'archived') return false;
    if (envFilter !== 'all' && session.environment !== envFilter) return false;
    return true;
  });

  const getStatusIcon = (session: Session) => {
    if (session.isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    switch (session.status) {
      case 'active':
        return <Circle className="w-4 h-4 fill-green-500 text-green-500" />;
      case 'archived':
        return <Archive className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getEnvIcon = (env: SessionEnvironment) => {
    switch (env) {
      case 'cloud':
        return <Cloud className="w-3.5 h-3.5 text-blue-500" />;
      case 'ssh':
        return <Terminal className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const getCIStatusIcon = (status?: Session['ciStatus']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'failure':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'running':
        return <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />;
      case 'pending':
        return <AlertCircle className="w-3 h-3 text-yellow-500" />;
      default:
        return null;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border w-72">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Sessions</h3>
          <button
            onClick={onSessionNew}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="New session"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-2 py-1 text-xs rounded',
                filter === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={cn(
                'px-2 py-1 text-xs rounded',
                filter === 'active' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={cn(
                'px-2 py-1 text-xs rounded',
                filter === 'archived' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              Archived
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 mt-2">
          <Filter className="w-3 h-3 text-muted-foreground" />
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value as typeof envFilter)}
            className="text-xs bg-muted border-0 rounded px-2 py-1"
          >
            <option value="all">All environments</option>
            <option value="local">Local</option>
            <option value="cloud">Cloud</option>
            <option value="ssh">SSH</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <p className="text-sm">No sessions found</p>
            <button
              onClick={onSessionNew}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Create a new session
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={cn(
                  'group relative p-3 rounded-lg cursor-pointer transition-all',
                  activeSessionId === session.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted border border-transparent'
                )}
              >
                {session.ciStatus && (
                  <div className="absolute top-2 right-2">
                    {getCIStatusIcon(session.ciStatus)}
                  </div>
                )}

                <div className="flex items-start gap-2">
                  {getStatusIcon(session)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {session.name}
                      </span>
                      {getEnvIcon(session.environment)}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {session.branch && (
                        <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                          <GitBranch className="w-3 h-3" />
                          {session.branch}
                        </span>
                      )}
                      {session.prMonitored !== undefined && session.prMonitored > 0 && (
                        <span className="text-blue-500">
                          #{session.prMonitored}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatTimeAgo(session.lastActivity)}</span>
                      {session.model && (
                        <>
                          <span>•</span>
                          <span>{session.model}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu(contextMenu === session.id ? null : session.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-muted rounded transition-all"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {contextMenu === session.id && (
                  <div className="absolute right-2 top-10 z-10 bg-background border border-border rounded-md shadow-lg py-1 min-w-[140px]">
                    {session.status !== 'archived' && onSessionArchive && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSessionArchive(session.id);
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        <Archive className="w-4 h-4" />
                        Archive
                      </button>
                    )}
                    {onSessionDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSessionDelete(session.id);
                          setContextMenu(null);
                        }}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-red-500"
                      >
                        <XCircle className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        {filteredSessions.length} session{filteredSessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default SessionSidebar;
