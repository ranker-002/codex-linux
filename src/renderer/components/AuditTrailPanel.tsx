import React, { useState, useEffect } from 'react';
import { ScrollText, Download, Filter, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

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
    if (action.includes('created')) return 'bg-green-500/10 text-green-500';
    if (action.includes('deleted')) return 'bg-red-500/10 text-red-500';
    if (action.includes('applied') || action.includes('restored')) return 'bg-blue-500/10 text-blue-500';
    if (action.includes('failed')) return 'bg-orange-500/10 text-orange-500';
    return 'bg-gray-500/10 text-gray-500';
  };

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-3">
          <ScrollText className="w-5 h-5 text-muted-foreground" />
          <div>
            <h3 className="font-medium">Audit Trail</h3>
            <p className="text-xs text-muted-foreground">Session activity log</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadEvents}
            disabled={loading}
            className="p-2 hover:bg-muted rounded-md disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={exportLogs}
            className="p-2 hover:bg-muted rounded-md"
            title="Export logs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b border-border">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by action..."
            className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-md text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No audit events</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="border border-border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
              >
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionColor(event.action)}`}>
                  {event.action}
                </span>
                <span className="text-xs text-muted-foreground flex-1">
                  {format(new Date(event.timestamp), 'MMM d, HH:mm:ss')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {expandedId === event.id ? '−' : '+'}
                </span>
              </button>

              {expandedId === event.id && (
                <div className="px-3 py-2 bg-muted/30 border-t border-border">
                  <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                    {JSON.stringify(event.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground">
        Showing {filteredEvents.length} of {events.length} events
      </div>
    </div>
  );
};
