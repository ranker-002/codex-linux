import React, { useState, useEffect } from 'react';
import { Search, Download, Star, Shield, Zap, Package, X, ExternalLink, Check } from 'lucide-react';

export interface Plugin {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  rating: number;
  downloads: number;
  tags: string[];
  icon?: string;
  installed?: boolean;
  updateAvailable?: boolean;
}

interface PluginMarketplaceProps {
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
  installedPlugins: string[];
  onClose: () => void;
}

const PLUGIN_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'ai', label: 'AI & ML' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'tools', label: 'Dev Tools' },
  { id: 'custom', label: 'Custom' },
];

const SAMPLE_PLUGINS: Plugin[] = [
  {
    id: 'code-review',
    name: 'Code Review Pro',
    description: 'Advanced code review with pattern detection and best practices enforcement',
    author: 'Codex Team',
    version: '1.2.0',
    rating: 4.8,
    downloads: 12500,
    tags: ['ai', 'productivity'],
    installed: false,
  },
  {
    id: 'test-generator',
    name: 'Test Generator',
    description: 'Automatically generate unit tests based on code changes and coverage gaps',
    author: 'Codex Team',
    version: '2.0.0',
    rating: 4.6,
    downloads: 8900,
    tags: ['productivity', 'tools'],
    installed: false,
  },
  {
    id: 'github-integration',
    name: 'GitHub Integration',
    description: 'Enhanced GitHub workflow with PR templates, auto-merge, and issue tracking',
    author: 'Community',
    version: '1.5.0',
    rating: 4.5,
    downloads: 15000,
    tags: ['integrations'],
    installed: true,
  },
  {
    id: 'slack-notifications',
    name: 'Slack Notifications',
    description: 'Get real-time notifications in Slack for agent activities and errors',
    author: 'Community',
    version: '1.0.0',
    rating: 4.2,
    downloads: 5200,
    tags: ['integrations'],
    installed: false,
  },
  {
    id: 'context7-docs',
    name: 'Context7 Docs',
    description: 'Fetch always-up-to-date library documentation from Context7',
    author: 'Community',
    version: '1.1.0',
    rating: 4.9,
    downloads: 22000,
    tags: ['ai', 'tools'],
    installed: false,
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    description: 'Web search capability using Brave Search API',
    author: 'Anthropic',
    version: '1.0.0',
    rating: 4.7,
    downloads: 18000,
    tags: ['ai', 'integrations'],
    installed: false,
  },
  {
    id: 'database-mcp',
    name: 'Database MCP',
    description: 'Connect to PostgreSQL, MySQL, and other databases directly',
    author: 'Community',
    version: '2.1.0',
    rating: 4.4,
    downloads: 7500,
    tags: ['tools', 'integrations'],
    installed: false,
  },
  {
    id: 'figma-integration',
    name: 'Figma Integration',
    description: 'Import designs from Figma and generate UI code automatically',
    author: 'Community',
    version: '0.9.0',
    rating: 4.3,
    downloads: 4100,
    tags: ['integrations', 'ai'],
    installed: false,
  },
];

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export const PluginMarketplace: React.FC<PluginMarketplaceProps> = ({
  onInstall,
  onUninstall,
  installedPlugins,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [plugins, setPlugins] = useState<Plugin[]>(SAMPLE_PLUGINS);
  const [installing, setInstalling] = useState<string | null>(null);

  useEffect(() => {
    setPlugins(SAMPLE_PLUGINS.map(p => ({
      ...p,
      installed: installedPlugins.includes(p.id),
    })));
  }, [installedPlugins]);

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.tags.some(t => t.includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      plugin.tags.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (pluginId: string) => {
    setInstalling(pluginId);
    await onInstall(pluginId);
    setInstalling(null);
  };

  const handleUninstall = async (pluginId: string) => {
    setInstalling(pluginId);
    await onUninstall(pluginId);
    setInstalling(null);
  };

  const formatDownloads = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Plugin Marketplace</h2>
              <p className="text-sm text-muted-foreground">Extend Codex Linux with plugins</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-muted border-0 rounded-lg text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-3 overflow-x-auto">
            {PLUGIN_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors',
                  selectedCategory === category.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Plugin List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlugins.map((plugin) => (
              <div
                key={plugin.id}
                className="p-4 border border-border rounded-lg hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{plugin.name}</h3>
                      {plugin.installed && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                          <Check className="w-3 h-3 inline" /> Installed
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{plugin.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span>{plugin.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="w-3.5 h-3.5" />
                    <span>{formatDownloads(plugin.downloads)}</span>
                  </div>
                  <span>v{plugin.version}</span>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">by {plugin.author}</span>
                  
                  {plugin.installed ? (
                    <button
                      onClick={() => handleUninstall(plugin.id)}
                      disabled={installing === plugin.id}
                      className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
                    >
                      {installing === plugin.id ? 'Uninstalling...' : 'Uninstall'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleInstall(plugin.id)}
                      disabled={installing === plugin.id}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {installing === plugin.id ? 'Installing...' : 'Install'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredPlugins.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No plugins found matching your search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" />
              Verified plugins
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Fast installation
            </span>
          </div>
          <a
            href="#"
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            Browse more plugins
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default PluginMarketplace;
