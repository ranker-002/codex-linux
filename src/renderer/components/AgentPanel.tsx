import React, { useEffect, useMemo, useState } from 'react';
import { Agent, AIProvider, Skill, CodeChange, ChangeStatus } from '../../shared/types';
import { 
  Bot, 
  Plus, 
  MessageSquare,
  Trash2
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
    providerId: '',
    model: '',
    skills: [] as string[]
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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
    if (providers.length > 0 && !newAgentConfig.providerId) {
      setNewAgentConfig(prev => ({
        ...prev,
        providerId: providers[0].id,
        model: providers[0].models[0]?.id || ''
      }));
    }
  }, [providers]);

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
        }
      } catch (error) {
        console.error('Failed to dispatch queued item:', error);
        const claimed = claimedByAgent[agentId];
        if (claimed) {
          try {
            await window.electronAPI.queue.complete(agentId, claimed.id, 'failed', error instanceof Error ? error.message : String(error));
          } catch {
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
    if (!newAgentConfig.name.trim()) {
      setCreateError('Agent name is required');
      return;
    }
    if (!newAgentConfig.projectPath.trim()) {
      setCreateError('Project path is required');
      return;
    }
    if (!newAgentConfig.model) {
      setCreateError('Please select a model');
      return;
    }
    
    setCreateError(null);
    setIsCreating(true);
    
    try {
      await onCreateAgent(newAgentConfig);
      setShowCreateModal(false);
      setNewAgentConfig({
        name: '',
        projectPath: '',
        providerId: providers[0]?.id || '',
        model: providers[0]?.models[0]?.id || '',
        skills: []
      });
    } catch (error) {
      console.error('Failed to create agent:', error);
      setCreateError(error instanceof Error ? error.message : 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (agentId: string, message: string) => {
    try {
      await window.electronAPI.agent.sendMessage(agentId, message);
    } catch (error) {
      console.error('Failed to send message:', error);
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
        return <div className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />;
      case 'paused':
        return <div className="w-2 h-2 bg-[var(--warning)] rounded-full" />;
      case 'error':
        return <div className="w-2 h-2 bg-[var(--error)] rounded-full" />;
      default:
        return <div className="w-2 h-2 bg-[var(--text-muted)] rounded-full" />;
    }
  };

  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-faint)] flex items-center justify-between">
          <h2 className="font-medium text-[13px] text-[var(--text-primary)]">Active Agents</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`p-3 rounded-[var(--radius-md)] cursor-pointer transition-all ${
                selectedAgent?.id === agent.id
                  ? 'bg-[rgba(0,200,168,0.08)] border border-[var(--border-accent)]'
                  : 'hover:bg-[var(--bg-hover)] border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-[var(--text-muted)]" />
                  <span className="font-medium text-[13px] text-[var(--text-primary)]">{agent.name}</span>
                </div>
                {getStatusIcon(agent.status)}
              </div>
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                <div className="truncate">{agent.projectPath}</div>
                <div className="mt-1">{agent.model}</div>
              </div>
            </div>
          ))}

          {agents.length === 0 && (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Bot className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No agents yet</p>
              <p className="text-[11px] mt-1">Create your first agent to get started</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedAgent ? (
          <>
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-medium text-[var(--text-primary)]">{selectedAgent.name}</h2>
                <p className="text-[12px] text-[var(--text-muted)]">
                  {selectedAgent.projectPath} · {selectedAgent.model}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendMessage(selectedAgent.id, 'Hello!')}
                  className="px-3 py-1.5 text-[12px] bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] transition-colors flex items-center gap-1"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat
                </button>
                <button
                  onClick={() => onDeleteAgent(selectedAgent.id)}
                  className="p-2 text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-[var(--radius-sm)] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Queue</h3>
                        <p className="text-[11px] text-[var(--text-muted)]">Stack work while the agent is busy</p>
                      </div>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {queueItems.length} queued
                        {inFlightByAgent[selectedAgent.id] ? ' · running' : ''}
                      </span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <select
                        value={newQueueType}
                        onChange={e => setNewQueueType(e.target.value as any)}
                        className="px-2 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)]"
                      >
                        <option value="task">Task</option>
                        <option value="message">Message</option>
                      </select>
                      <input
                        value={newQueueContent}
                        onChange={e => setNewQueueContent(e.target.value)}
                        placeholder={newQueueType === 'task' ? 'Describe the task...' : 'Type a message...'}
                        className="flex-1 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
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
                        className="px-3 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-md)] hover:bg-[var(--teal-400)] text-[12px] font-medium transition-colors"
                      >
                        Add
                      </button>
                    </div>

                    <div className="mt-3 space-y-2 max-h-40 overflow-auto">
                      {queueItems.map((item, idx) => (
                        <div key={item.id} className="flex items-center gap-2 p-2 bg-[var(--bg-elevated)] rounded-[var(--radius-md)]">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {item.type}
                          </span>
                          <span className="text-[12px] flex-1 truncate text-[var(--text-primary)]">{item.content}</span>
                          <button
                            onClick={() => {
                              const agentId = selectedAgent.id;
                              (async () => {
                                await window.electronAPI.queue.delete(agentId, item.id);
                                await refreshQueue(agentId);
                              })();
                            }}
                            className="text-[11px] text-[var(--error)] hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      {queueItems.length === 0 && (
                        <div className="text-[11px] text-[var(--text-muted)]">No queued items</div>
                      )}
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => setShowQueueHistory(!showQueueHistory)}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      >
                        {showQueueHistory ? 'Hide' : 'Show'} history ({queueHistory.length})
                      </button>
                      {showQueueHistory && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-auto">
                          {queueHistory.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-2 bg-[var(--bg-elevated)] rounded-[var(--radius-md)] text-[11px]">
                              <span className={`px-1.5 py-0.5 rounded-full ${
                                item.status === 'completed' ? 'bg-[rgba(60,200,120,0.1)] text-[var(--success)]' : 'bg-[rgba(232,90,106,0.1)] text-[var(--error)]'
                              }`}>
                                {item.status}
                              </span>
                              <span className="text-[var(--text-muted)]">{item.type}</span>
                              <span className="flex-1 truncate text-[var(--text-primary)]">{item.content}</span>
                              {item.error && (
                                <span className="text-[var(--error)] truncate" title={item.error}>⚠️</span>
                              )}
                            </div>
                          ))}
                          {queueHistory.length === 0 && (
                            <div className="text-[11px] text-[var(--text-muted)]">No completed items yet</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Status</h3>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${
                        selectedAgent.status === 'running' ? 'bg-[rgba(60,200,120,0.1)] text-[var(--success)]' :
                        selectedAgent.status === 'paused' ? 'bg-[rgba(230,185,74,0.1)] text-[var(--warning)]' :
                        selectedAgent.status === 'error' ? 'bg-[rgba(232,90,106,0.1)] text-[var(--error)]' :
                        'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                      }`}>
                        {selectedAgent.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedAgent.skills.map(skillId => {
                        const skill = skills.find(s => s.id === skillId);
                        return (
                          <span
                            key={skillId}
                            className="px-2 py-1 bg-[var(--bg-hover)] rounded-[var(--radius-sm)] text-[11px] text-[var(--text-secondary)]"
                          >
                            {skill?.name || skillId}
                          </span>
                        );
                      })}
                      {selectedAgent.skills.length === 0 && (
                        <span className="text-[12px] text-[var(--text-muted)]">No skills applied</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[12px] font-medium text-[var(--text-secondary)] mb-2">Recent Tasks</h3>
                    <div className="space-y-2">
                      {selectedAgent.tasks.slice(-5).map(task => (
                        <div
                          key={task.id}
                          className="p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-medium text-[var(--text-primary)]">{task.description}</span>
                            <span className={`text-[11px] ${
                              task.status === 'completed' ? 'text-[var(--success)]' :
                              task.status === 'failed' ? 'text-[var(--error)]' :
                              task.status === 'running' ? 'text-[var(--info)]' :
                              'text-[var(--text-muted)]'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                          {task.status === 'running' && (
                            <div className="mt-2 h-1 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--teal-500)] transition-all"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {selectedAgent.tasks.length === 0 && (
                        <span className="text-[12px] text-[var(--text-muted)]">No tasks yet</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden min-h-[420px]">
                  <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
                    <div>
                      <h3 className="text-[13px] font-medium text-[var(--text-primary)]">Changes</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
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
                      className="px-3 py-1.5 text-[11px] bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors"
                    >
                      Undo last apply
                    </button>
                    {changesLoading && (
                      <span className="text-[11px] text-[var(--text-muted)]">Loading...</span>
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
          <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
            <div className="text-center">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-[14px]">Select an agent to view details</p>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 w-[500px] max-w-[90vw]">
            <h2 className="text-[16px] font-medium text-[var(--text-primary)] mb-4">Create New Agent</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Name</label>
                <input
                  type="text"
                  value={newAgentConfig.name}
                  onChange={e => setNewAgentConfig({ ...newAgentConfig, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="My Coding Agent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Project Path</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAgentConfig.projectPath}
                    onChange={e => setNewAgentConfig({ ...newAgentConfig, projectPath: e.target.value })}
                    className="flex-1 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                    placeholder="/path/to/project"
                  />
                  <button
                    onClick={async () => {
                      const path = await window.electronAPI.dialog.selectFolder();
                      if (path) setNewAgentConfig({ ...newAgentConfig, projectPath: path });
                    }}
                    className="px-3 py-2 bg-[var(--bg-hover)] rounded-[var(--radius-md)] hover:bg-[var(--bg-active)] text-[13px] text-[var(--text-secondary)] transition-colors"
                  >
                    Browse
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Provider</label>
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
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)]"
                >
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Model</label>
                <select
                  value={newAgentConfig.model}
                  onChange={e => setNewAgentConfig({ ...newAgentConfig, model: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)]"
                >
                  {providers
                    .find(p => p.id === newAgentConfig.providerId)
                    ?.models.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">Skills</label>
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
                      className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[12px] transition-colors ${
                        newAgentConfig.skills.includes(skill.id)
                          ? 'bg-[var(--teal-500)] text-[var(--bg-void)]'
                          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-active)]'
                      }`}
                    >
                      {skill.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {createError && (
              <div className="mt-4 p-3 bg-[rgba(232,90,106,0.1)] border border-[rgba(232,90,106,0.3)] rounded-[var(--radius-md)]">
                <p className="text-[12px] text-[var(--error)]">{createError}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError(null);
                }}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={isCreating || !newAgentConfig.name || !newAgentConfig.projectPath}
                className="px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] disabled:opacity-50 text-[13px] font-medium transition-colors flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[var(--bg-void)] border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Agent'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
