import React, { useEffect, useMemo, useState } from 'react';
import { Agent, AIProvider, Skill, CodeChange, ChangeStatus } from '../../shared/types';
import { 
  Bot, 
  Plus, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  MessageSquare,
  MoreVertical
} from 'lucide-react';
import DiffViewer from './DiffViewer';

interface AgentPanelProps {
  agents: Agent[];
  providers: AIProvider[];
  skills: Skill[];
  onCreateAgent: (config: any) => Promise<Agent>;
  onDeleteAgent: (agentId: string) => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  agents,
  providers,
  skills,
  onCreateAgent,
  onDeleteAgent
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [changes, setChanges] = useState<CodeChange[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
  const [queueItems, setQueueItems] = useState<Array<{ id: string; type: 'message' | 'task'; content: string; status?: 'pending' | 'running'; position?: number; createdAt?: number }>>([]);
  const [queueHistory, setQueueHistory] = useState<Array<{ id: string; type: 'message' | 'task'; content: string; status: string; createdAt: Date; completedAt?: Date; error?: string }>>([]);
  const [showQueueHistory, setShowQueueHistory] = useState(false);
  const [inFlightByAgent, setInFlightByAgent] = useState<Record<string, boolean>>({});
  const [claimedByAgent, setClaimedByAgent] = useState<Record<string, { id: string; type: 'message' | 'task'; content: string } | null>>({});
  const [newQueueType, setNewQueueType] = useState<'message' | 'task'>('task');
  const [newQueueContent, setNewQueueContent] = useState('');
  const [newAgentConfig, setNewAgentConfig] = useState({
    name: '',
    projectPath: '',
    providerId: providers[0]?.id || '',
    model: '',
    skills: [] as string[]
  });

  const selectedAgentChanges = useMemo(() => {
    if (!selectedAgent) return [];
    return changes.filter(c => c.agentId === selectedAgent.id);
  }, [changes, selectedAgent]);

  const refreshChanges = async (agentId: string) => {
    setChangesLoading(true);
    try {
      const list = await window.electronAPI.changes.list(agentId);
      setChanges(list as CodeChange[]);
    } catch (error) {
      console.error('Failed to load code changes:', error);
    } finally {
      setChangesLoading(false);
    }
  };

  const refreshQueue = async (agentId: string) => {
    try {
      const list = await window.electronAPI.queue.list(agentId);
      setQueueItems(list as any);
    } catch (error) {
      console.error('Failed to load queue:', error);
    }
  };

  const refreshQueueHistory = async (agentId: string) => {
    try {
      const history = await window.electronAPI.queue.history(agentId, 20);
      setQueueHistory(history as any);
    } catch (error) {
      console.error('Failed to load queue history:', error);
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    void refreshChanges(selectedAgent.id);
    void refreshQueue(selectedAgent.id);
    void refreshQueueHistory(selectedAgent.id);
  }, [selectedAgent?.id]);

  useEffect(() => {
    const onTaskStarted = (event: any, payload: { agentId: string }) => {
      setInFlightByAgent(prev => ({ ...prev, [payload.agentId]: true }));
    };

    const onTaskCompleted = async (event: any, payload: { agentId: string }) => {
      const claimed = claimedByAgent[payload.agentId];
      if (claimed) {
        try {
          await window.electronAPI.queue.complete(payload.agentId, claimed.id, 'completed');
          await refreshQueue(payload.agentId);
        } catch (error) {
          console.error('Failed to complete queued item:', error);
        }
        setClaimedByAgent(prev => ({ ...prev, [payload.agentId]: null }));
      }
      setInFlightByAgent(prev => ({ ...prev, [payload.agentId]: false }));
    };

    const onTaskFailed = async (event: any, payload: { agentId: string; error?: any }) => {
      const claimed = claimedByAgent[payload.agentId];
      if (claimed) {
        try {
          await window.electronAPI.queue.complete(payload.agentId, claimed.id, 'failed', payload.error ? String(payload.error) : undefined);
          await refreshQueue(payload.agentId);
        } catch (error) {
          console.error('Failed to fail queued item:', error);
        }
        setClaimedByAgent(prev => ({ ...prev, [payload.agentId]: null }));
      }
      setInFlightByAgent(prev => ({ ...prev, [payload.agentId]: false }));
    };

    window.electronAPI.on('agent:taskStarted', onTaskStarted);
    window.electronAPI.on('agent:taskCompleted', onTaskCompleted);
    window.electronAPI.on('agent:taskFailed', onTaskFailed);

    return () => {
      window.electronAPI.removeListener('agent:taskStarted', onTaskStarted);
      window.electronAPI.removeListener('agent:taskCompleted', onTaskCompleted);
      window.electronAPI.removeListener('agent:taskFailed', onTaskFailed);
    };
  }, [claimedByAgent]);

  useEffect(() => {
    if (!selectedAgent) return;
    const agentId = selectedAgent.id;
    const inFlight = Boolean(inFlightByAgent[agentId]);

    if (inFlight) return;
    if (claimedByAgent[agentId]) return;

    const hasPending = queueItems.some(i => (i.status || 'pending') === 'pending');
    if (!hasPending) return;

    setInFlightByAgent(prev => ({ ...prev, [agentId]: true }));

    (async () => {
      try {
        const claimed = await window.electronAPI.queue.claimNext(agentId);
        if (!claimed) {
          setInFlightByAgent(prev => ({ ...prev, [agentId]: false }));
          return;
        }

        setClaimedByAgent(prev => ({ ...prev, [agentId]: claimed }));
        await refreshQueue(agentId);

        if (claimed.type === 'message') {
          await window.electronAPI.agent.sendMessage(agentId, claimed.content);
          await window.electronAPI.queue.complete(agentId, claimed.id, 'completed');
          setClaimedByAgent(prev => ({ ...prev, [agentId]: null }));
          await refreshQueue(agentId);
          setInFlightByAgent(prev => ({ ...prev, [agentId]: false }));
        } else {
          await window.electronAPI.agent.executeTask(agentId, claimed.content);
          // keep inFlight until taskCompleted/taskFailed
        }
      } catch (error) {
        console.error('Failed to dispatch queued item:', error);
        const claimed = claimedByAgent[agentId];
        if (claimed) {
          try {
            await window.electronAPI.queue.complete(agentId, claimed.id, 'failed', error instanceof Error ? error.message : String(error));
          } catch {
            // ignore
          }
          setClaimedByAgent(prev => ({ ...prev, [agentId]: null }));
        }
        setInFlightByAgent(prev => ({ ...prev, [agentId]: false }));
        await refreshQueue(agentId);
        await window.electronAPI.notification.show({
          title: 'Queue dispatch failed',
          body: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  }, [queueItems, inFlightByAgent, claimedByAgent, selectedAgent?.id]);

  useEffect(() => {
    const handler = (event: any, payload: { agentId: string; changeId: string }) => {
      if (!selectedAgent) return;
      if (payload.agentId !== selectedAgent.id) return;
      void refreshChanges(selectedAgent.id);
    };

    window.electronAPI.on('changes:created', handler);
    return () => {
      window.electronAPI.removeListener('changes:created', handler);
    };
  }, [selectedAgent?.id]);

  const handleCreateAgent = async () => {
    try {
      await onCreateAgent(newAgentConfig);
      setShowCreateModal(false);
      setNewAgentConfig({
        name: '',
        projectPath: '',
        providerId: providers[0]?.id || '',
        model: '',
        skills: []
      });
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleSendMessage = async (agentId: string, message: string) => {
    try {
      await window.electronAPI.agent.sendMessage(agentId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleExecuteTask = async (agentId: string, task: string) => {
    try {
      await window.electronAPI.agent.executeTask(agentId, task);
    } catch (error) {
      console.error('Failed to execute task:', error);
    }
  };

  const handleApproveChange = async (changeId: string) => {
    if (!selectedAgent) return;
    try {
      await window.electronAPI.changes.approve(changeId);
      await refreshChanges(selectedAgent.id);
      await window.electronAPI.notification.show({
        title: 'Change approved',
        body: 'The change is approved and ready to apply.'
      });
    } catch (error) {
      console.error('Failed to approve change:', error);
      await window.electronAPI.notification.show({
        title: 'Approve failed',
        body: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleRejectChange = async (changeId: string, comment?: string) => {
    if (!selectedAgent) return;
    try {
      const finalComment =
        typeof comment === 'string'
          ? comment
          : (window.prompt('Rejection comment (optional):') ?? undefined);

      await window.electronAPI.changes.reject(changeId, finalComment);
      await refreshChanges(selectedAgent.id);
      await window.electronAPI.notification.show({
        title: 'Change rejected',
        body: 'The change was rejected.'
      });
    } catch (error) {
      console.error('Failed to reject change:', error);
      await window.electronAPI.notification.show({
        title: 'Reject failed',
        body: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleApplyChange = async (changeId: string) => {
    if (!selectedAgent) return;
    try {
      await window.electronAPI.changes.apply(changeId);
      await refreshChanges(selectedAgent.id);
      await window.electronAPI.notification.show({
        title: 'Change applied',
        body: 'The change was written to the worktree.'
      });
    } catch (error) {
      console.error('Failed to apply change:', error);
      await window.electronAPI.notification.show({
        title: 'Apply failed',
        body: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case 'paused':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  return (
    <div className="h-full flex">
      {/* Agents List */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Active Agents</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-2">
          {agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedAgent?.id === agent.id
                  ? 'bg-primary/10 border border-primary/30'
                  : 'hover:bg-muted border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{agent.name}</span>
                </div>
                {getStatusIcon(agent.status)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <div className="truncate">{agent.projectPath}</div>
                <div className="mt-1">{agent.model}</div>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents yet</p>
              <p className="text-xs mt-1">Create your first agent to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Agent Detail View */}
      <div className="flex-1 flex flex-col">
        {selectedAgent ? (
          <>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedAgent.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedAgent.projectPath} • {selectedAgent.model}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendMessage(selectedAgent.id, 'Hello!')}
                  className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Chat
                </button>
                <button
                  onClick={() => onDeleteAgent(selectedAgent.id)}
                  className="p-2 text-destructive hover:bg-destructive/10 rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium">Queue</h3>
                        <p className="text-xs text-muted-foreground">Stack work while the agent is busy</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {queueItems.length} queued
                        {inFlightByAgent[selectedAgent.id] ? ' • running' : ''}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <select
                        value={newQueueType}
                        onChange={e => setNewQueueType(e.target.value as any)}
                        className="px-2 py-2 bg-background border border-input rounded-md text-sm"
                      >
                        <option value="task">Task</option>
                        <option value="message">Message</option>
                      </select>
                      <input
                        value={newQueueContent}
                        onChange={e => setNewQueueContent(e.target.value)}
                        placeholder={newQueueType === 'task' ? 'Describe the task...' : 'Type a message...'}
                        className="flex-1 px-3 py-2 bg-background border border-input rounded-md text-sm"
                      />
                      <button
                        onClick={() => {
                          if (!newQueueContent.trim() || !selectedAgent) return;
                          const agentId = selectedAgent.id;
                          (async () => {
                            try {
                              await window.electronAPI.queue.enqueue(agentId, newQueueType, newQueueContent.trim());
                              setNewQueueContent('');
                              await refreshQueue(agentId);
                            } catch (error) {
                              await window.electronAPI.notification.show({
                                title: 'Enqueue failed',
                                body: error instanceof Error ? error.message : String(error)
                              });
                            }
                          })();
                        }}
                        className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-3 space-y-2 max-h-40 overflow-auto">
                      {queueItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-background border border-border">
                            {item.type}
                          </span>
                          <span className="text-sm flex-1 truncate">{item.content}</span>
                          <button
                            onClick={() => {
                              const agentId = selectedAgent.id;
                              (async () => {
                                await window.electronAPI.queue.delete(agentId, item.id);
                                await refreshQueue(agentId);
                              })();
                            }}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                          <button
                            disabled={idx === 0}
                            onClick={() => {
                              const agentId = selectedAgent.id;
                              (async () => {
                                await window.electronAPI.queue.moveUp(agentId, item.id);
                                await refreshQueue(agentId);
                              })();
                            }}
                            className="text-xs text-muted-foreground disabled:opacity-50"
                          >
                            Up
                          </button>
                        </div>
                      ))}
                      {queueItems.length === 0 && (
                        <div className="text-xs text-muted-foreground">No queued items</div>
                      )}
                    </div>

                    {/* Queue History */}
                    <div className="mt-3">
                      <button
                        onClick={() => setShowQueueHistory(!showQueueHistory)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showQueueHistory ? 'Hide' : 'Show'} history ({queueHistory.length})
                      </button>
                      {showQueueHistory && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                          {queueHistory.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
                              <span className={`px-1.5 py-0.5 rounded-full ${
                                item.status === 'completed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                              }`}>
                                {item.status}
                              </span>
                              <span className="text-muted-foreground">{item.type}</span>
                              <span className="flex-1 truncate">{item.content}</span>
                              {item.error && (
                                <span className="text-red-500 truncate" title={item.error}>⚠️</span>
                              )}
                            </div>
                          ))}
                          {queueHistory.length === 0 && (
                            <div className="text-xs text-muted-foreground">No completed items yet</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Status</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        selectedAgent.status === 'running' ? 'bg-green-500/10 text-green-500' :
                        selectedAgent.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500' :
                        selectedAgent.status === 'error' ? 'bg-red-500/10 text-red-500' :
                        'bg-gray-500/10 text-gray-500'
                      }`}>
                        {selectedAgent.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAgent.skills.map(skillId => {
                        const skill = skills.find(s => s.id === skillId);
                        return (
                          <span
                            key={skillId}
                            className="px-2 py-1 bg-muted rounded-md text-xs"
                          >
                            {skill?.name || skillId}
                          </span>
                        );
                      })}
                      {selectedAgent.skills.length === 0 && (
                        <span className="text-sm text-muted-foreground">No skills applied</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-2">Recent Tasks</h3>
                    <div className="space-y-2">
                      {selectedAgent.tasks.slice(-5).map(task => (
                        <div
                          key={task.id}
                          className="p-3 bg-muted rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{task.description}</span>
                            <span className={`text-xs ${
                              task.status === 'completed' ? 'text-green-500' :
                              task.status === 'failed' ? 'text-red-500' :
                              task.status === 'running' ? 'text-blue-500' :
                              'text-muted-foreground'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                          {task.status === 'running' && (
                            <div className="mt-2 h-1 bg-muted-foreground/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedAgent.tasks.length === 0 && (
                        <span className="text-sm text-muted-foreground">No tasks yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg overflow-hidden min-h-[420px]">
                  <div className="p-3 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Changes</h3>
                      <p className="text-xs text-muted-foreground">
                        Review and apply changes generated by the agent
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!selectedAgent) return;
                        try {
                          const checkpoints = await window.electronAPI.checkpoints.list(selectedAgent.id);
                          const lastPending = (checkpoints as any[]).find(c => !c.restoredAt);
                          const restoredFilePath = lastPending?.filePath as string | undefined;

                          await window.electronAPI.checkpoints.restoreLast(selectedAgent.id);
                          await refreshChanges(selectedAgent.id);
                          await window.electronAPI.notification.show({
                            title: 'Checkpoint restored',
                            body: restoredFilePath
                              ? `Rolled back: ${restoredFilePath}`
                              : 'Last applied change was rolled back.'
                          });
                        } catch (error) {
                          await window.electronAPI.notification.show({
                            title: 'Rollback failed',
                            body: error instanceof Error ? error.message : String(error)
                          });
                        }
                      }}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-md"
                    >
                      Undo last apply
                    </button>
                    {changesLoading && (
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    )}
                  </div>

                  <div className="h-[520px]">
                    <DiffViewer
                      changes={selectedAgentChanges.filter(c => c.status !== ChangeStatus.APPLIED)}
                      onApprove={handleApproveChange}
                      onReject={handleRejectChange}
                      onApply={handleApplyChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>Select an agent to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-lg font-semibold mb-4">Create New Agent</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newAgentConfig.name}
                  onChange={e => setNewAgentConfig({ ...newAgentConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="My Coding Agent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Project Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAgentConfig.projectPath}
                    onChange={e => setNewAgentConfig({ ...newAgentConfig, projectPath: e.target.value })}
                    className="flex-1 px-3 py-2 bg-background border border-input rounded-md"
                    placeholder="/path/to/project"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewAgentConfig({ ...newAgentConfig, projectPath: path });
                    }}
                    className="px-3 py-2 bg-muted rounded-md hover:bg-muted/80"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={newAgentConfig.providerId}
                  onChange={e => {
                    const provider = providers.find(p => p.id === e.target.value);
                    setNewAgentConfig({
                      ...newAgentConfig,
                      providerId: e.target.value,
                      model: provider?.models[0]?.id || ''
                    });
                  }}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <select
                  value={newAgentConfig.model}
                  onChange={e => setNewAgentConfig({ ...newAgentConfig, model: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  {providers
                    .find(p => p.id === newAgentConfig.providerId)
                    ?.models.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {skills.map(skill => (
                    <button
                      key={skill.id}
                      onClick={() => {
                        const newSkills = newAgentConfig.skills.includes(skill.id)
                          ? newAgentConfig.skills.filter(id => id !== skill.id)
                          : [...newAgentConfig.skills, skill.id];
                        setNewAgentConfig({ ...newAgentConfig, skills: newSkills });
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        newAgentConfig.skills.includes(skill.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
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
                onClick={handleCreateAgent}
                disabled={!newAgentConfig.name || !newAgentConfig.projectPath}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};