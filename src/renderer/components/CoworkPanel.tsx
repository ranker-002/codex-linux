import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  ChevronRight
} from 'lucide-react';

interface CoworkSession {
  id: string;
  name: string;
  objective: string;
  projectPath: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  logs: string[];
  deliverables: string[];
}

interface CoworkPanelProps {
  sessions: CoworkSession[];
  onCreateSession: (name: string, objective: string, projectPath: string, options: {
    autoApprove?: boolean;
    skills?: string[];
  }) => Promise<void>;
  onStartSession: (sessionId: string) => Promise<void>;
  onPauseSession: (sessionId: string) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onViewSession: (sessionId: string) => void;
}

export const CoworkPanel: React.FC<CoworkPanelProps> = ({
  sessions,
  onCreateSession,
  onStartSession,
  onPauseSession,
  onStopSession,
  onDeleteSession,
  onViewSession
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CoworkSession | null>(null);
  const [newSessionConfig, setNewSessionConfig] = useState({
    name: '',
    objective: '',
    projectPath: '',
    autoApprove: false
  });

  const handleCreateSession = async () => {
    try {
      await onCreateSession(
        newSessionConfig.name,
        newSessionConfig.objective,
        newSessionConfig.projectPath,
        { autoApprove: newSessionConfig.autoApprove }
      );
      setShowCreateModal(false);
      setNewSessionConfig({
        name: '',
        objective: '',
        projectPath: '',
        autoApprove: false
      });
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-[var(--success)]" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-[var(--warning)]" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-[var(--success)]" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-[var(--error)]" />;
      default:
        return <Clock className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-[rgba(60,200,120,0.1)] text-[var(--success)] border-[rgba(60,200,120,0.3)]';
      case 'paused':
        return 'bg-[rgba(232,184,74,0.1)] text-[var(--warning)] border-[rgba(232,184,74,0.3)]';
      case 'completed':
        return 'bg-[rgba(104,144,244,0.1)] text-[var(--info)] border-[rgba(104,144,244,0.3)]';
      case 'error':
        return 'bg-[rgba(232,90,106,0.1)] text-[var(--error)] border-[rgba(232,90,106,0.3)]';
      default:
        return 'bg-[var(--bg-hover)] text-[var(--text-muted)] border-[var(--border-subtle)]';
    }
  };

  return (
    <div className="h-full flex">
      {/* Sessions List */}
      <div className="w-96 border-r border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--text-muted)]" />
            <h2 className="font-semibold text-[var(--text-primary)]">Cowork Sessions</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-icon-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                selectedSession?.id === session.id
                  ? 'bg-[var(--a-bg-xs)] border-[var(--a-border)]'
                  : 'hover:bg-[var(--bg-hover)] border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(session.status)}
                  <span className="font-medium text-sm truncate max-w-[180px]">
                    {session.name}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(session.status)}`}>
                  {session.status}
                </span>
              </div>
              
              <p className="text-xs text-[var(--text-muted)] truncate mb-2">
                {session.objective}
              </p>
              
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>{session.progress}% complete</span>
                <span>{new Date(session.createdAt).toLocaleDateString()}</span>
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    session.status === 'error' ? 'bg-[var(--error)]' :
                    session.status === 'completed' ? 'bg-[var(--success)]' :
                    'bg-[var(--a-500)]'
                  }`}
                  style={{ width: `${session.progress}%` }}
                />
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs mt-1">Create your first cowork session</p>
            </div>
          )}
        </div>
      </div>

      {/* Session Detail View */}
      <div className="flex-1 flex flex-col bg-[var(--bg-app)]">
        {selectedSession ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold truncate text-[var(--text-primary)]">{selectedSession.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(selectedSession.status)}`}>
                    {selectedSession.status}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Created {new Date(selectedSession.createdAt).toLocaleString()}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedSession.status === 'idle' && (
                  <button
                    onClick={() => onStartSession(selectedSession.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                )}
                
                {selectedSession.status === 'running' && (
                  <>
                    <button
                      onClick={() => onPauseSession(selectedSession.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                    <button
                      onClick={() => onStopSession(selectedSession.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                )}
                
                {selectedSession.status === 'paused' && (
                  <>
                    <button
                      onClick={() => onStartSession(selectedSession.id)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                    <button
                      onClick={() => onStopSession(selectedSession.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => onDeleteSession(selectedSession.id)}
                  className="p-2 text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-3xl space-y-6">
                {/* Objective */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">Objective</h3>
                  <p className="text-[var(--text-secondary)]">{selectedSession.objective}</p>
                </div>

                {/* Progress */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Progress</h3>
                    <span className="text-2xl font-bold text-[var(--text-primary)]">{selectedSession.progress}%</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedSession.status === 'error' ? 'bg-[var(--error)]' :
                        selectedSession.status === 'completed' ? 'bg-[var(--success)]' :
                        'bg-[var(--a-500)]'
                      }`}
                      style={{ width: `${selectedSession.progress}%` }}
                    />
                  </div>
                </div>

                {/* Logs */}
                {selectedSession.logs.length > 0 && (
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Activity Log</h3>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {selectedSession.logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono text-[var(--text-muted)]">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deliverables */}
                {selectedSession.deliverables.length > 0 && (
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Deliverables</h3>
                    <div className="space-y-2">
                      {selectedSession.deliverables.map((deliverable, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-[var(--text-muted)]" />
                          <span>{deliverable}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed info */}
                {selectedSession.completedAt && (
                  <div className="bg-[rgba(60,200,120,0.1)] border border-[rgba(60,200,120,0.3)] rounded-lg p-4">
                    <div className="flex items-center gap-2 text-[var(--success)]">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">
                        Completed on {new Date(selectedSession.completedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Select a session</p>
              <p className="text-sm mt-2">Choose a cowork session to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-4">Create New Cowork Session</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Session Name</label>
                <input
                  type="text"
                  value={newSessionConfig.name}
                  onChange={e => setNewSessionConfig({ ...newSessionConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md"
                  placeholder="e.g., Refactor Authentication Module"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Objective</label>
                <textarea
                  value={newSessionConfig.objective}
                  onChange={e => setNewSessionConfig({ ...newSessionConfig, objective: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md min-h-[100px] resize-none"
                  placeholder="Describe what you want the agent to accomplish..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Project Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSessionConfig.projectPath}
                    onChange={e => setNewSessionConfig({ ...newSessionConfig, projectPath: e.target.value })}
                    className="flex-1 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-md"
                    placeholder="/path/to/project"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewSessionConfig({ ...newSessionConfig, projectPath: path });
                    }}
                    className="px-3 py-2 bg-[var(--bg-hover)] rounded-md hover:bg-[var(--bg-active)]"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={newSessionConfig.autoApprove}
                  onChange={e => setNewSessionConfig({ ...newSessionConfig, autoApprove: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="autoApprove" className="text-sm">
                  Auto-approve changes (runs autonomously)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionConfig.name || !newSessionConfig.objective || !newSessionConfig.projectPath}
                className="btn btn-primary disabled:opacity-50"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoworkPanel;
