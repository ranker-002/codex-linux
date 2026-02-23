import React, { useState, useEffect, useCallback } from 'react';

interface MCPServer {
  id: string;
  name: string;
  status: string;
  disabled?: boolean;
  scope: string;
  transport: string;
  tools: number;
  resources: number;
}

interface MCPRegistryEntry {
  id: string;
  name: string;
  description: string;
  publisher: string;
  version: string;
  transport: string[];
  categories: string[];
  tags: string[];
  installs: number;
  rating: number;
}

interface MCPPanelProps {
  servers?: MCPServer[];
  registryEntries?: MCPRegistryEntry[];
  onAddServer?: (entryId: string, scope: string) => Promise<void>;
  onRemoveServer?: (serverId: string) => Promise<void>;
  onToggleServer?: (serverId: string, enabled: boolean) => Promise<void>;
  onSearchRegistry?: (query: string) => Promise<MCPRegistryEntry[]>;
  onSyncRegistry?: () => Promise<void>;
}

export const MCPPanel: React.FC<MCPPanelProps> = ({
  servers = [],
  registryEntries = [],
  onAddServer,
  onRemoveServer,
  onToggleServer,
  onSearchRegistry,
  onSyncRegistry,
}) => {
  const [activeTab, setActiveTab] = useState<'installed' | 'registry'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MCPRegistryEntry[]>(registryEntries);
  const [selectedScope, setSelectedScope] = useState<string>('local');
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categories = Array.from(new Set(registryEntries.flatMap(e => e.categories)));

  const handleSearch = useCallback(async () => {
    if (onSearchRegistry) {
      const results = await onSearchRegistry(searchQuery);
      setSearchResults(results);
    }
  }, [searchQuery, onSearchRegistry]);

  useEffect(() => {
    if (activeTab === 'registry' && searchQuery) {
      handleSearch();
    }
  }, [searchQuery, activeTab, handleSearch]);

  const handleSync = async () => {
    if (onSyncRegistry) {
      setIsSyncing(true);
      await onSyncRegistry();
      setIsSyncing(false);
    }
  };

  const getStatusColor = (status: string, disabled?: boolean) => {
    if (disabled) return 'text-gray-500';
    switch (status) {
      case 'running': return 'text-green-400';
      case 'starting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getScopeLabel = (scope: string) => {
    switch (scope) {
      case 'local': return '👤 Local';
      case 'project': return '📁 Project';
      case 'user': return '🏠 User';
      default: return scope;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">🔌 MCP Registry</h2>
        <p className="text-gray-400 text-sm">
          Connect to external tools and services via Model Context Protocol
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === 'installed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Installed ({servers.length})
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            activeTab === 'registry'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Registry ({registryEntries.length})
        </button>
      </div>

      {/* Installed Servers Tab */}
      {activeTab === 'installed' && (
        <div className="flex-1 overflow-y-auto">
          {servers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg mb-2">No MCP servers installed</p>
              <p className="text-sm">Go to the Registry tab to discover and add servers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg">{server.name}</h3>
                      <span className="text-xs text-gray-500">{server.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${getStatusColor(server.status, server.disabled)}`}>
                        {server.disabled ? 'Disabled' : server.status}
                      </span>
                      <button
                        onClick={() => onToggleServer?.(server.id, !!server.disabled)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          server.disabled ? 'bg-gray-600' : 'bg-green-500'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            server.disabled ? 'left-1' : 'right-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <span>{getScopeLabel(server.scope)}</span>
                    <span>•</span>
                    <span className="uppercase text-xs bg-gray-700 px-2 py-1 rounded">
                      {server.transport}
                    </span>
                    <span>•</span>
                    <span>{server.tools} tools</span>
                    <span>•</span>
                    <span>{server.resources} resources</span>
                  </div>

                  <button
                    onClick={() => onRemoveServer?.(server.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registry Tab */}
      {activeTab === 'registry' && (
        <div className="flex-1 flex flex-col">
          {/* Search Bar */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search MCP servers..."
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-4 py-2 rounded transition-colors"
            >
              {isSyncing ? '🔄' : '📥'}
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  if (selectedCategories.includes(category)) {
                    setSelectedCategories(selectedCategories.filter(c => c !== category));
                  } else {
                    setSelectedCategories([...selectedCategories, category]);
                  }
                }}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  selectedCategories.includes(category)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Scope Selector */}
          <div className="flex gap-2 mb-4">
            <span className="text-sm text-gray-400 py-2">Install to:</span>
            {['local', 'project', 'user'].map((scope) => (
              <button
                key={scope}
                onClick={() => setSelectedScope(scope)}
                className={`text-sm px-3 py-1 rounded transition-colors ${
                  selectedScope === scope
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {getScopeLabel(scope)}
              </button>
            ))}
          </div>

          {/* Registry Entries */}
          <div className="flex-1 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No MCP servers found</p>
                <p className="text-sm mt-2">Try syncing with the registry</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults
                  .filter(entry => 
                    selectedCategories.length === 0 || 
                    entry.categories.some(c => selectedCategories.includes(c))
                  )
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-lg">{entry.name}</h3>
                          <p className="text-sm text-gray-400">{entry.description}</p>
                        </div>
                        <button
                          onClick={() => onAddServer?.(entry.id, selectedScope)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                        >
                          Install
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-2">
                        <span className="text-blue-400">@{entry.publisher}</span>
                        <span>•</span>
                        <span>v{entry.version}</span>
                        <span>•</span>
                        <span>⭐ {entry.rating.toFixed(1)}</span>
                        <span>•</span>
                        <span>📥 {entry.installs.toLocaleString()}</span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {entry.categories.map((category) => (
                          <span
                            key={category}
                            className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                          >
                            {category}
                          </span>
                        ))}
                        {entry.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPPanel;
