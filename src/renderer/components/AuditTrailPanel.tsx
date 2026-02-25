import React, { useState, useEffect } from 'react';
import { ScrollText, Download, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { AppPageLayout } from './layout/AppPageLayout';

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  details: Record<string, any>;
}

export const AuditTrailPanel: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const recent = await window.electronAPI.audit.recent(100);
      setEvents(recent as AuditEvent[]);
    } catch (error) {
      console.error('Failed to load audit events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filteredEvents = filter
    ? events.filter(e => e.action.toLowerCase().includes(filter.toLowerCase()))
    : events;

  const exportLogs = async () => {
    try {
      const path = await window.electronAPI.dialog.selectFile?.([{ name: 'JSON', extensions: ['json'] }]);
      if (path) {
        await window.electronAPI.audit.export(path);
        await window.electronAPI.notification.show({
          title: 'Audit log exported',
          body: `Exported to ${path}`
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('created')) return 'bg-[rgba(60,200,120,0.1)] text-[var(--success)]';
    if (action.includes('deleted')) return 'bg-[rgba(232,90,106,0.1)] text-[var(--error)]';
    if (action.includes('applied') || action.includes('restored')) return 'bg-[rgba(104,144,244,0.1)] text-[var(--info)]';
    if (action.includes('failed')) return 'bg-[rgba(232,184,74,0.1)] text-[var(--warning)]';
    return 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';
  };

  return (
    <AppPageLayout
      title="Audit Trail"
      subtitle="Session activity log"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-md disabled:opacity-50 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportLogs}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      }
      contentClassName="p-0"
    >
      <div className="h-full flex flex-col bg-[var(--bg-card)]">
        <div className="p-3 border-b border-[var(--border-subtle)]">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by action..."
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--a-500)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No audit events</p>
            </div>
          ) : (
            filteredEvents.map((event) => (
              <div
                key={event.id}
                className="border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(event.action)}`}>
                    {event.action}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] flex-1">
                    {format(new Date(event.timestamp), 'MMM d, HH:mm:ss')}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {expandedId === event.id ? '−' : '+'}
                  </span>
                </button>

                {expandedId === event.id && (
                  <div className="px-3 py-2 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)]">
                    <pre className="text-xs font-mono text-[var(--text-secondary)] overflow-x-auto">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
          Showing {filteredEvents.length} of {events.length} events
        </div>
      </div>
    </AppPageLayout>
  );
};
