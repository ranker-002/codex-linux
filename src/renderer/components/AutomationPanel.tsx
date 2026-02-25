import React, { useState } from 'react';
import { Automation, Agent, Skill } from '../../shared/types';
import { Clock, Plus, Play, Pause, Trash2, Calendar, Zap } from 'lucide-react';

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
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div>
          <h2 
            className="text-[18px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
          >
            Automations
          </h2>
          <p className="text-[12px] text-[var(--text-muted)]">Schedule and automate agent tasks</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] text-[13px] font-medium transition-colors"
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
              className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] hover:border-[var(--border-accent)] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[var(--text-muted)]" />
                  <span className="font-medium text-[13px] text-[var(--text-primary)]">{automation.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(automation.id, !automation.enabled)}
                    className={`p-1.5 rounded-[var(--radius-sm)] transition-colors ${
                      automation.enabled
                        ? 'text-[var(--success)] hover:bg-[rgba(60,200,120,0.1)]'
                        : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {automation.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button className="p-1.5 text-[var(--error)] hover:bg-[rgba(232,90,106,0.1)] rounded-[var(--radius-sm)] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-[12px] text-[var(--text-muted)] mb-3">
                {automation.description}
              </p>

              <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
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
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--success)]">
                  <div className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
                  Active
                </div>
              )}
            </div>
          ))}

          {automations.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
              <Clock className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-[15px] font-medium text-[var(--text-primary)]">No automations yet</p>
              <p className="text-[12px]">Create an automation to schedule agent tasks</p>
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-[rgba(3,7,9,0.8)] flex items-center justify-center z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] p-6 w-[600px]">
            <h2 className="text-[16px] font-medium text-[var(--text-primary)] mb-4">Create New Automation</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Name</label>
                <input
                  type="text"
                  value={newAutomation.name}
                  onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="Daily Code Review"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={newAutomation.description}
                  onChange={e => setNewAutomation({ ...newAutomation, description: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] h-20 resize-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                  placeholder="What does this automation do?"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Trigger Type</label>
                <select
                  value={newAutomation.triggerType}
                  onChange={e => setNewAutomation({
                    ...newAutomation,
                    triggerType: e.target.value as any,
                    triggerConfig: e.target.value === 'schedule' ? { cron: '0 9 * * *' } : {}
                  })}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)]"
                >
                  <option value="schedule">Schedule (Cron)</option>
                  <option value="event">Event</option>
                  <option value="webhook">Webhook</option>
                  <option value="manual">Manual Only</option>
                </select>
              </div>

              {newAutomation.triggerType === 'schedule' && (
                <div>
                  <label className="block text-[11px] font-medium mb-1 text-[var(--text-secondary)]">Cron Expression</label>
                  <input
                    type="text"
                    value={newAutomation.triggerConfig.cron}
                    onChange={e => setNewAutomation({
                      ...newAutomation,
                      triggerConfig: { cron: e.target.value }
                    })}
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--teal-300)] font-[var(--font-mono)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                    placeholder="0 9 * * *"
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Example: 0 9 * * * (every day at 9 AM)
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newAutomation.name}
                className="px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] disabled:opacity-50 text-[13px] font-medium transition-colors hover:bg-[var(--teal-400)]"
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
