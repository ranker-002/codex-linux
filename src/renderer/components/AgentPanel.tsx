import React, { useState } from 'react';
import { Agent, AIProvider, Skill } from '../shared/types';
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
  const [newAgentConfig, setNewAgentConfig] = useState({
    name: '',
    projectPath: '',
    providerId: providers[0]?.id || '',
    model: '',
    skills: [] as string[]
  });

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
              <div className="space-y-4">
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