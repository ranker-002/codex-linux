import React, { useState } from 'react';
import { 
  Plug, 
  Plus, 
  Trash2, 
  Check, 
  X,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  Github,
  Calendar,
  Database,
  Search,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'communication' | 'project' | 'storage' | 'search' | 'calendar';
  enabled: boolean;
  configured: boolean;
  config: Record<string, string>;
  lastSync?: Date;
  error?: string;
}

interface ConnectorsPanelProps {
  connectors: Connector[];
  onEnableConnector: (connectorId: string) => Promise<void>;
  onDisableConnector: (connectorId: string) => Promise<void>;
  onConfigureConnector: (connectorId: string, config: Record<string, string>) => Promise<void>;
  onTestConnector: (connectorId: string) => Promise<boolean>;
  onSyncConnector: (connectorId: string) => Promise<void>;
  onRemoveConnector: (connectorId: string) => Promise<void>;
}

const connectorDefaults: Omit<Connector, 'id' | 'enabled' | 'configured' | 'config'>[] = [
  {
    name: 'Slack',
    description: 'Send messages and interact with Slack channels',
    icon: 'slack',
    category: 'communication'
  },
  {
    name: 'GitHub',
    description: 'Access repositories, issues, and pull requests',
    icon: 'github',
    category: 'project'
  },
  {
    name: 'Linear',
    description: 'Manage issues and projects from Linear',
    icon: 'linear',
    category: 'project'
  },
  {
    name: 'Notion',
    description: 'Read and write to Notion databases and pages',
    icon: 'notion',
    category: 'storage'
  },
  {
    name: 'Google Calendar',
    description: 'Read calendar events and schedule meetings',
    icon: 'calendar',
    category: 'calendar'
  },
  {
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    icon: 'database',
    category: 'storage'
  },
  {
    name: 'Brave Search',
    description: 'Search the web using Brave Search API',
    icon: 'search',
    category: 'search'
  }
];

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'communication':
      return <MessageSquare className="w-4 h-4" />;
    case 'project':
      return <Github className="w-4 h-4" />;
    case 'storage':
      return <Database className="w-4 h-4" />;
    case 'search':
      return <Search className="w-4 h-4" />;
    case 'calendar':
      return <Calendar className="w-4 h-4" />;
    default:
      return <Plug className="w-4 h-4" />;
  }
};

export const ConnectorsPanel: React.FC<ConnectorsPanelProps> = ({
  connectors,
  onEnableConnector,
  onDisableConnector,
  onConfigureConnector,
  onTestConnector,
  onSyncConnector,
  onRemoveConnector
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [editingConnector, setEditingConnector] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ connectorId: string; success: boolean } | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['communication', 'project', 'storage', 'search', 'calendar']));

  const groupedConnectors = connectors.reduce((acc, connector) => {
    if (!acc[connector.category]) {
      acc[connector.category] = [];
    }
    acc[connector.category].push(connector);
    return acc;
  }, {} as Record<string, Connector[]>);

  const handleConfigure = (connector: Connector) => {
    setEditingConnector(connector.id);
    setConfigValues(connector.config || {});
  };

  const handleSaveConfig = async (connectorId: string) => {
    try {
      await onConfigureConnector(connectorId, configValues);
      setEditingConnector(null);
      setConfigValues({});
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleTest = async (connectorId: string) => {
    setTesting(connectorId);
    try {
      const success = await onTestConnector(connectorId);
      setTestResult({ connectorId, success });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      setTestResult({ connectorId, success: false });
    } finally {
      setTesting(null);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          <h2 className="font-semibold">Connectors</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Connector
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {connectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Plug className="w-16 h-16 mb-4 opacity-30" />
            <h3 className="text-lg font-medium">No Connectors</h3>
            <p className="text-sm mt-2 text-center max-w-md">
              Connect external services like Slack, GitHub, Linear, and more to extend Claude&apos;s capabilities
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Add Your First Connector
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {Object.entries(groupedConnectors).map(([category, categoryConnectors]) => (
              <div key={category} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    <span className="font-medium capitalize">{category}</span>
                    <span className="text-xs text-muted-foreground">
                      ({categoryConnectors.length})
                    </span>
                  </div>
                  {expandedCategories.has(category) ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>

                {expandedCategories.has(category) && (
                  <div className="divide-y divide-border">
                    {categoryConnectors.map(connector => (
                      <div key={connector.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              connector.enabled ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              {getCategoryIcon(connector.category)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{connector.name}</h3>
                                {connector.enabled ? (
                                  <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">
                                    Active
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {connector.description}
                              </p>
                              {connector.lastSync && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Last synced: {new Date(connector.lastSync).toLocaleString()}
                                </p>
                              )}
                              {connector.error && (
                                <div className="flex items-center gap-1 text-xs text-red-500 mt-1">
                                  <AlertCircle className="w-3 h-3" />
                                  {connector.error}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {testResult?.connectorId === connector.id && (
                              <span className={`text-xs ${testResult.success ? 'text-green-500' : 'text-red-500'}`}>
                                {testResult.success ? 'Connected' : 'Failed'}
                              </span>
                            )}
                            
                            {connector.configured && (
                              <button
                                onClick={() => handleTest(connector.id)}
                                disabled={testing === connector.id}
                                className="p-2 hover:bg-muted rounded-md text-muted-foreground"
                                title="Test connection"
                              >
                                <RefreshCw className={`w-4 h-4 ${testing === connector.id ? 'animate-spin' : ''}`} />
                              </button>
                            )}

                            {connector.enabled ? (
                              <button
                                onClick={() => onDisableConnector(connector.id)}
                                className="p-2 hover:bg-muted rounded-md text-muted-foreground"
                                title="Disable"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => onEnableConnector(connector.id)}
                                className="p-2 hover:bg-muted rounded-md text-muted-foreground"
                                title="Enable"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleConfigure(connector)}
                              className="p-2 hover:bg-muted rounded-md text-muted-foreground"
                              title="Configure"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => onRemoveConnector(connector.id)}
                              className="p-2 hover:bg-destructive/10 text-destructive rounded-md"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Configuration Editor */}
                        {editingConnector === connector.id && (
                          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <h4 className="text-sm font-medium mb-3">Configuration</h4>
                            <div className="space-y-3">
                              {Object.entries(getRequiredConfig(connector.name)).map(([key, label]) => (
                                <div key={key}>
                                  <label className="block text-xs text-muted-foreground mb-1">
                                    {label}
                                  </label>
                                  <input
                                    type={key.toLowerCase().includes('token') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') ? 'password' : 'text'}
                                    value={configValues[key] || ''}
                                    onChange={e => setConfigValues(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm"
                                    placeholder={`Enter ${label.toLowerCase()}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center justify-end gap-2 mt-4">
                              <button
                                onClick={() => {
                                  setEditingConnector(null);
                                  setConfigValues({});
                                }}
                                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveConfig(connector.id)}
                                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
                              >
                                Save Configuration
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Connector Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 w-[500px] max-w-[90vw] max-h-[80vh] overflow-auto">
            <h2 className="text-lg font-semibold mb-4">Add Connector</h2>
            
            <div className="space-y-3">
              {connectorDefaults.map(connector => {
                const existing = connectors.find(c => c.name === connector.name);
                return (
                  <button
                    key={connector.name}
                    onClick={() => {
                      if (!existing) {
                        onEnableConnector(`connector-${Date.now()}`);
                        setShowAddModal(false);
                      }
                    }}
                    disabled={!!existing}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      existing 
                        ? 'opacity-50 cursor-not-allowed bg-muted' 
                        : 'hover:bg-muted border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="p-2 bg-muted rounded-lg">
                      {getCategoryIcon(connector.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">{connector.name}</h3>
                        {existing && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-500 rounded-full">
                            Connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {connector.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get required config fields for each connector
function getRequiredConfig(connectorName: string): Record<string, string> {
  switch (connectorName) {
    case 'Slack':
      return {
        botToken: 'Bot Token',
        signingSecret: 'Signing Secret'
      };
    case 'GitHub':
      return {
        token: 'Personal Access Token',
        organization: 'Organization (optional)'
      };
    case 'Linear':
      return {
        apiKey: 'API Key'
      };
    case 'Notion':
      return {
        token: 'Integration Token'
      };
    case 'Google Calendar':
      return {
        clientId: 'Client ID',
        clientSecret: 'Client Secret'
      };
    case 'PostgreSQL':
      return {
        connectionString: 'Connection String'
      };
    case 'Brave Search':
      return {
        apiKey: 'API Key'
      };
    default:
      return {
        apiKey: 'API Key'
      };
  }
}

export default ConnectorsPanel;
