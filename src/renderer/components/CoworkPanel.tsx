import React, { useState, useEffect } from 'react';
import { CoworkSession } from '../../shared/types';
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
        return <Loader2 className="w-4 h-4 animate-spin text-green-500" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-500 border-green-500/30';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
      case 'error':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/30';
    }
  };

  return (
    <div className="h-full flex">
      {/* Sessions List */}
      <div className="w-96 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="font-semibold">Cowork Sessions</h2>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
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
                  ? 'bg-primary/10 border-primary/30'
                  : 'hover:bg-muted border-transparent'
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
              
              <p className="text-xs text-muted-foreground truncate mb-2">
                {session.objective}
              </p>
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{session.progress}% complete</span>
                <span>{new Date(session.createdAt).toLocaleDateString()}</span>
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    session.status === 'error' ? 'bg-red-500' :
                    session.status === 'completed' ? 'bg-green-500' :
                    'bg-primary'
                  }`}
                  style={{ width: `${session.progress}%` }}
                />
              </div>
            </div>
          ))}

          {sessions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs mt-1">Create your first cowork session</p>
            </div>
          )}
        </div>
      </div>

      {/* Session Detail View */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedSession ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold truncate">{selectedSession.name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusColor(selectedSession.status)}`}>
                    {selectedSession.status}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Created {new Date(selectedSession.createdAt).toLocaleString()}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {selectedSession.status === 'idle' && (
                  <button
                    onClick={() => onStartSession(selectedSession.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </button>
                )}
                
                {selectedSession.status === 'running' && (
                  <>
                    <button
                      onClick={() => onPauseSession(selectedSession.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      <Pause className="w-4 h-4" />
                      Pause
                    </button>
                    <button
                      onClick={() => onStopSession(selectedSession.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
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
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <Play className="w-4 h-4" />
                      Resume
                    </button>
                    <button
                      onClick={() => onStopSession(selectedSession.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                )}
                
                <button
                  onClick={() => onDeleteSession(selectedSession.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <div className="max-w-3xl space-y-6">
                {/* Objective */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-2">Objective</h3>
                  <p className="text-muted-foreground">{selectedSession.objective}</p>
                </div>

                {/* Progress */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Progress</h3>
                    <span className="text-2xl font-bold">{selectedSession.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        selectedSession.status === 'error' ? 'bg-red-500' :
                        selectedSession.status === 'completed' ? 'bg-green-500' :
                        'bg-primary'
                      }`}
                      style={{ width: `${selectedSession.progress}%` }}
                    />
                  </div>
                </div>

                {/* Logs */}
                {selectedSession.logs.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Activity Log</h3>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {selectedSession.logs.map((log, index) => (
                        <div key={index} className="text-xs font-mono text-muted-foreground">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deliverables */}
                {selectedSession.deliverables.length > 0 && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <h3 className="text-sm font-medium mb-3">Deliverables</h3>
                    <div className="space-y-2">
                      {selectedSession.deliverables.map((deliverable, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span>{deliverable}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed info */}
                {selectedSession.completedAt && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-500">
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
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-4">Create New Cowork Session</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Session Name</label>
                <input
                  type="text"
                  value={newSessionConfig.name}
                  onChange={e => setNewSessionConfig({ ...newSessionConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="e.g., Refactor Authentication Module"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Objective</label>
                <textarea
                  value={newSessionConfig.objective}
                  onChange={e => setNewSessionConfig({ ...newSessionConfig, objective: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md min-h-[100px] resize-none"
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
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md"
                    placeholder="/path/to/project"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewSessionConfig({ ...newSessionConfig, projectPath: path });
                    }}
                    className="px-3 py-2 bg-muted rounded-md hover:bg-muted/80"
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
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionConfig.name || !newSessionConfig.objective || !newSessionConfig.projectPath}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
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
