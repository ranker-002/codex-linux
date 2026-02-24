import React, { useState } from 'react';
import { Settings, AIProvider } from '../../shared/types';
import { Settings as SettingsIcon, Key, Eye, EyeOff, Save, Zap, Check, Sparkles } from 'lucide-react';

interface SettingsPanelProps {
  settings: Settings;
  providers: AIProvider[];
  onSettingsChange: (settings: Settings) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  providers,
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [selectedModel, setSelectedModel] = useState<string>(localSettings.defaultModel);

  const handleSave = async () => {
    for (const [key, value] of Object.entries(localSettings)) {
      await window.electronAPI.settings.set(key, value);
    }
    onSettingsChange(localSettings);
  };

  const handleProviderConfig = async (providerId: string, apiKey: string) => {
    try {
      await window.electronAPI.providers.configure(providerId, { apiKey });
      const success = await window.electronAPI.providers.test(providerId);
      if (success) {
        alert('Connection successful!');
      } else {
        alert('Connection failed. Please check your API key.');
      }
    } catch (error) {
      console.error('Failed to configure provider:', error);
      alert('Failed to configure provider');
    }
  };

  const handleModelSelect = (modelId: string, providerId: string) => {
    setSelectedModel(modelId);
    setLocalSettings({
      ...localSettings,
      defaultModel: modelId,
      defaultProvider: providerId
    });
  };

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'providers', label: 'AI Providers' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'shortcuts', label: 'Shortcuts' }
  ];

  const freeModelsProvider = providers.find(p => p.isFree);
  const paidProviders = providers.filter(p => !p.isFree);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        
        <div className="flex gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'general' && (
          <div className="max-w-2xl space-y-6">
            <section>
              <h3 className="text-lg font-medium mb-4">General Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-medium">Auto Save</label>
                    <p className="text-sm text-muted-foreground">Automatically save changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSave}
                    onChange={e => setLocalSettings({ ...localSettings, autoSave: e.target.checked })}
                    className="w-5 h-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-medium">Max Parallel Agents</label>
                    <p className="text-sm text-muted-foreground">Maximum number of agents running simultaneously</p>
                  </div>
                  <input
                    type="number"
                    value={localSettings.maxParallelAgents}
                    onChange={e => setLocalSettings({ ...localSettings, maxParallelAgents: parseInt(e.target.value) })}
                    className="w-20 px-3 py-2 bg-background border border-input rounded-md"
                    min={1}
                    max={10}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-medium">Show Notifications</label>
                    <p className="text-sm text-muted-foreground">Display desktop notifications for agent events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.showNotifications}
                    onChange={e => setLocalSettings({ ...localSettings, showNotifications: e.target.checked })}
                    className="w-5 h-5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="block font-medium">Confirm Destructive Actions</label>
                    <p className="text-sm text-muted-foreground">Show confirmation dialogs before deleting agents or worktrees</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.confirmDestructiveActions}
                    onChange={e => setLocalSettings({ ...localSettings, confirmDestructiveActions: e.target.checked })}
                    className="w-5 h-5"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-medium mb-4">Git Configuration</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1">Author Name</label>
                  <input
                    type="text"
                    value={localSettings.gitAuthorName}
                    onChange={e => setLocalSettings({ ...localSettings, gitAuthorName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Author Email</label>
                  <input
                    type="email"
                    value={localSettings.gitAuthorEmail}
                    onChange={e => setLocalSettings({ ...localSettings, gitAuthorEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                    placeholder="your@email.com"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'providers' && (
          <div className="max-w-4xl space-y-6">
            {freeModelsProvider && (
              <section className="p-4 border-2 border-green-500/30 bg-green-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-green-500" />
                  <h3 className="text-lg font-medium">Free AI Models</h3>
                  <span className="px-2 py-0.5 text-xs font-medium bg-green-500/20 text-green-500 rounded-full">
                    No API Key Required
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Start using AI immediately with free models from OpenRouter, Groq, Google AI Studio, and Cerebras. 
                  No API key required for OpenRouter free tier - just select a model and start chatting!
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Select Model</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
                    {freeModelsProvider.models
                      .sort((a, b) => {
                        const backends = ['openrouter', 'groq', 'google', 'cerebras'];
                        const aBackend = a.backend || 'openrouter';
                        const bBackend = b.backend || 'openrouter';
                        return backends.indexOf(aBackend) - backends.indexOf(bBackend);
                      })
                      .map(model => (
                      <button
                        key={model.id}
                        onClick={() => handleModelSelect(model.id, freeModelsProvider.id)}
                        className={`p-3 text-left rounded-lg border transition-all ${
                          selectedModel === model.id
                            ? 'border-green-500 bg-green-500/10'
                            : 'border-border hover:border-green-500/50 hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate">{model.name}</span>
                          {selectedModel === model.id && (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            {model.backend || 'openrouter'}
                          </span>
                          {model.supportsVision && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                              vision
                            </span>
                          )}
                          {model.contextWindow >= 100000 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              {model.contextWindow >= 1000000 ? '1M ctx' : `${model.contextWindow / 1000}k ctx`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{model.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  <strong>Tip:</strong> OpenRouter models work without an API key. For Groq, Google AI Studio, or Cerebras models, 
                  you may need to add your free API key below.
                </div>
              </section>
            )}

            <section>
              <h3 className="text-lg font-medium mb-4">Premium Providers</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your API keys for premium models with higher limits and advanced features.
              </p>
              
              <div className="space-y-4">
                {paidProviders.map(provider => (
                  <div key={provider.id} className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{provider.name}</h4>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="activeProvider"
                          checked={localSettings.defaultProvider === provider.id}
                          onChange={() => setLocalSettings({ ...localSettings, defaultProvider: provider.id })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Default</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">API Key</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showApiKeys[provider.id] ? 'text' : 'password'}
                            defaultValue={provider.config.apiKey}
                            placeholder={`Enter ${provider.name} API key`}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md pr-10"
                            onBlur={e => handleProviderConfig(provider.id, e.target.value)}
                          />
                          <button
                            onClick={() => setShowApiKeys({
                              ...showApiKeys,
                              [provider.id]: !showApiKeys[provider.id]
                            })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showApiKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleProviderConfig(provider.id, provider.config.apiKey || '')}
                          className="px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    {provider.models.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium mb-1">Available Models</label>
                        <div className="flex flex-wrap gap-2">
                          {provider.models.map(model => (
                            <span
                              key={model.id}
                              className="px-2 py-1 bg-background rounded text-xs"
                            >
                              {model.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <h4 className="font-medium text-blue-400">Get Free API Keys</h4>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>OpenRouter:</strong> <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">openrouter.ai</a> - No key needed for free models</p>
                <p><strong>Ollama:</strong> <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">ollama.com</a> - Local models, no API key needed</p>
                <p><strong>NVIDIA NIM:</strong> <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">build.nvidia.com</a> - Kimi K2.5, DeepSeek R1, Llama (40 req/min free)</p>
                <p><strong>Groq:</strong> <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.groq.com</a> - Fast inference, generous free tier</p>
                <p><strong>Google AI Studio:</strong> <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">aistudio.google.com</a> - Gemini models free tier</p>
                <p><strong>Cerebras:</strong> <a href="https://cloud.cerebras.ai" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">cloud.cerebras.ai</a> - Ultra-fast inference</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="max-w-2xl space-y-6">
            <section>
              <h3 className="text-lg font-medium mb-4">Appearance</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1">Theme</label>
                  <select
                    value={localSettings.theme}
                    onChange={e => setLocalSettings({ ...localSettings, theme: e.target.value as any })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Font Size</label>
                  <input
                    type="range"
                    value={localSettings.fontSize}
                    onChange={e => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
                    className="w-full"
                    min={10}
                    max={20}
                  />
                  <span className="text-sm text-muted-foreground">{localSettings.fontSize}px</span>
                </div>

                <div>
                  <label className="block font-medium mb-1">Font Family</label>
                  <input
                    type="text"
                    value={localSettings.fontFamily}
                    onChange={e => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="max-w-2xl">
            <section>
              <h3 className="text-lg font-medium mb-4">Keyboard Shortcuts</h3>
              
              <div className="space-y-3">
                {Object.entries(localSettings.shortcuts).map(([action, shortcut]) => (
                  <div key={action} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-sm capitalize">{action.replace(/:/g, ' ')}</span>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={e => setLocalSettings({
                        ...localSettings,
                        shortcuts: { ...localSettings.shortcuts, [action]: e.target.value }
                      })}
                      className="px-3 py-1 bg-background border border-input rounded-md text-sm font-mono w-32"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
};
