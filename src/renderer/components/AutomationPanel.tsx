import React, { useState } from 'react';
import { Automation, Agent, Skill } from '../../shared/types';
import { Clock, Plus, Play, Pause, Settings, Trash2, Calendar, Zap } from 'lucide-react';

interface AutomationPanelProps {
  automations: Automation[];
  agents: Agent[];
  skills: Skill[];
  onCreateAutomation: (config: any) => Promise<Automation>;
}

export const AutomationPanel: React.FC<AutomationPanelProps> = ({
  automations,
  agents,
  skills,
  onCreateAutomation
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAutomation, setNewAutomation] = useState({
    name: '',
    description: '',
    triggerType: 'schedule' as const,
    triggerConfig: { cron: '0 9 * * *' },
    actions: [] as any[]
  });

  const handleCreate = async () => {
    try {
      await onCreateAutomation(newAutomation);
      setShowCreateModal(false);
      setNewAutomation({
        name: '',
        description: '',
        triggerType: 'schedule',
        triggerConfig: { cron: '0 9 * * *' },
        actions: []
      });
    } catch (error) {
      console.error('Failed to create automation:', error);
    }
  };

  const handleToggle = async (automationId: string, enabled: boolean) => {
    try {
      await window.electronAPI.automation.toggle(automationId, enabled);
    } catch (error) {
      console.error('Failed to toggle automation:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Automations</h2>
          <p className="text-sm text-muted-foreground">Schedule and automate agent tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Automation
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {automations.map(automation => (
            <div
              key={automation.id}
              className="p-4 bg-card border border-border rounded-lg"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{automation.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(automation.id, !automation.enabled)}
                    className={`p-1.5 rounded-md ${
                      automation.enabled
                        ? 'text-green-500 hover:bg-green-500/10'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {automation.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {automation.description}
              </p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span className="capitalize">{automation.trigger.type}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  <span>{automation.actions.length} actions</span>
                </div>
                {automation.runCount > 0 && (
                  <div>
                    Run {automation.runCount} times
                  </div>
                )}
              </div>

              {automation.enabled && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-500">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Active
                </div>
              )}
            </div>
          ))}

          {automations.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No automations yet</p>
              <p className="text-sm">Create an automation to schedule agent tasks</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[600px]">
            <h2 className="text-lg font-semibold mb-4">Create New Automation</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={newAutomation.name}
                  onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  placeholder="Daily Code Review"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newAutomation.description}
                  onChange={e => setNewAutomation({ ...newAutomation, description: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md h-20 resize-none"
                  placeholder="What does this automation do?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Trigger Type</label>
                <select
                  value={newAutomation.triggerType}
                  onChange={e => setNewAutomation({
                    ...newAutomation,
                    triggerType: e.target.value as any,
                    triggerConfig: e.target.value === 'schedule' ? { cron: '0 9 * * *' } : {}
                  })}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="schedule">Schedule (Cron)</option>
                  <option value="event">Event</option>
                  <option value="webhook">Webhook</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>

              {newAutomation.triggerType === 'schedule' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cron Expression</label>
                  <input
                    type="text"
                    value={newAutomation.triggerConfig.cron}
                    onChange={e => setNewAutomation({
                      ...newAutomation,
                      triggerConfig: { cron: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md font-mono"
                    placeholder="0 9 * * *"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Example: 0 9 * * * (every day at 9 AM)
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-muted-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newAutomation.name}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50"
              >
                Create Automation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};