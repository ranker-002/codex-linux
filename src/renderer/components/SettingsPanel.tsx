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
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-5 h-5 text-[var(--teal-400)]" />
          <h2 
            className="text-[18px] font-medium text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
          >
            Settings
          </h2>
        </div>
        
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
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
              <h3 className="text-[14px] font-medium mb-4 text-[var(--text-primary)]">General Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">Auto Save</label>
                    <p className="text-[11px] text-[var(--text-muted)]">Automatically save changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.autoSave}
                    onChange={e => setLocalSettings({ ...localSettings, autoSave: e.target.checked })}
                    className="w-5 h-5 accent-[var(--teal-500)]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">Max Parallel Agents</label>
                    <p className="text-[11px] text-[var(--text-muted)]">Maximum number of agents running simultaneously</p>
                  </div>
                  <input
                    type="number"
                    value={localSettings.maxParallelAgents}
                    onChange={e => setLocalSettings({ ...localSettings, maxParallelAgents: parseInt(e.target.value) })}
                    className="w-20 px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)]"
                    min={1}
                    max={10}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">Show Notifications</label>
                    <p className="text-[11px] text-[var(--text-muted)]">Display desktop notifications for agent events</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.showNotifications}
                    onChange={e => setLocalSettings({ ...localSettings, showNotifications: e.target.checked })}
                    className="w-5 h-5 accent-[var(--teal-500)]"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <div>
                    <label className="block text-[13px] font-medium text-[var(--text-primary)]">Confirm Destructive Actions</label>
                    <p className="text-[11px] text-[var(--text-muted)]">Show confirmation dialogs before deleting agents or worktrees</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={localSettings.confirmDestructiveActions}
                    onChange={e => setLocalSettings({ ...localSettings, confirmDestructiveActions: e.target.checked })}
                    className="w-5 h-5 accent-[var(--teal-500)]"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[14px] font-medium mb-4 text-[var(--text-primary)]">Git Configuration</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Author Name</label>
                  <input
                    type="text"
                    value={localSettings.gitAuthorName}
                    onChange={e => setLocalSettings({ ...localSettings, gitAuthorName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
                    placeholder="Your Name"
                  />
                </div>

                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Author Email</label>
                  <input
                    type="email"
                    value={localSettings.gitAuthorEmail}
                    onChange={e => setLocalSettings({ ...localSettings, gitAuthorEmail: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:outline-none focus:border-[var(--teal-500)]"
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
              <section className="p-4 border-2 border-[rgba(60,200,120,0.3)] bg-[rgba(60,200,120,0.05)] rounded-[var(--radius-lg)]">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-[var(--success)]" />
                  <h3 className="text-[15px] font-medium text-[var(--text-primary)]">Free AI Models</h3>
                  <span className="badge badge-success">
                    No API Key Required
                  </span>
                </div>
                <p className="text-[12px] text-[var(--text-muted)] mb-4">
                  Start using AI immediately with free models from OpenRouter, Groq, Google AI Studio, and Cerebras. 
                  No API key required for OpenRouter free tier - just select a model and start chatting!
                </p>
                
                <div className="mb-4">
                  <label className="block text-[12px] font-medium mb-2 text-[var(--text-secondary)]">Select Model</label>
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
                        className={`p-3 text-left rounded-[var(--radius-md)] border transition-all ${
                          selectedModel === model.id
                            ? 'border-[var(--teal-500)] bg-[rgba(0,200,168,0.08)]'
                            : 'border-[var(--border-subtle)] hover:border-[var(--teal-500)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[12px] truncate text-[var(--text-primary)]">{model.name}</span>
                          {selectedModel === model.id && (
                            <Check className="w-4 h-4 text-[var(--teal-400)] flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(104,144,244,0.1)] text-[var(--info)]">
                            {model.backend || 'openrouter'}
                          </span>
                          {model.supportsVision && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(136,88,219,0.1)] text-purple-400">
                              vision
                            </span>
                          )}
                          {model.contextWindow >= 100000 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(230,185,74,0.1)] text-[var(--warning)]">
                              {model.contextWindow >= 1000000 ? '1M ctx' : `${model.contextWindow / 1000}k ctx`}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">{model.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            <section>
              <h3 className="text-[15px] font-medium mb-4 text-[var(--text-primary)]">Premium Providers</h3>
              <p className="text-[12px] text-[var(--text-muted)] mb-4">
                Add your API keys for premium models with higher limits and advanced features.
              </p>
              
              <div className="space-y-4">
                {paidProviders.map(provider => (
                  <div key={provider.id} className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)]">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-[13px] text-[var(--text-primary)]">{provider.name}</h4>
                        <p className="text-[11px] text-[var(--text-muted)]">{provider.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="activeProvider"
                          checked={localSettings.defaultProvider === provider.id}
                          onChange={() => setLocalSettings({ ...localSettings, defaultProvider: provider.id })}
                          className="w-4 h-4 accent-[var(--teal-500)]"
                        />
                        <span className="text-[12px] text-[var(--text-secondary)]">Default</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">API Key</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showApiKeys[provider.id] ? 'text' : 'password'}
                            defaultValue={provider.config.apiKey}
                            placeholder={`Enter ${provider.name} API key`}
                            className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] pr-10 focus:outline-none focus:border-[var(--teal-500)]"
                            onBlur={e => handleProviderConfig(provider.id, e.target.value)}
                          />
                          <button
                            onClick={() => setShowApiKeys({
                              ...showApiKeys,
                              [provider.id]: !showApiKeys[provider.id]
                            })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          >
                            {showApiKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <button
                          onClick={() => handleProviderConfig(provider.id, provider.config.apiKey || '')}
                          className="px-3 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-md)] hover:bg-[var(--teal-400)] text-[13px] font-medium transition-colors"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    {provider.models.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Available Models</label>
                        <div className="flex flex-wrap gap-2">
                          {provider.models.map(model => (
                            <span
                              key={model.id}
                              className="px-2 py-1 bg-[var(--bg-hover)] rounded text-[11px] text-[var(--text-secondary)]"
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

            <section className="p-4 bg-[rgba(104,144,244,0.1)] border border-[rgba(104,144,244,0.3)] rounded-[var(--radius-lg)]">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-[var(--info)]" />
                <h4 className="font-medium text-[var(--info)]">Get Free API Keys</h4>
              </div>
              <div className="text-[12px] text-[var(--text-muted)] space-y-1">
                <p><strong>OpenRouter:</strong> <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-[var(--teal-400)] hover:underline">openrouter.ai</a> - No key needed for free models</p>
                <p><strong>Ollama:</strong> <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-[var(--teal-400)] hover:underline">ollama.com</a> - Local models, no API key needed</p>
                <p><strong>NVIDIA NIM:</strong> <a href="https://build.nvidia.com" target="_blank" rel="noopener noreferrer" className="text-[var(--teal-400)] hover:underline">build.nvidia.com</a> - Kimi K2.5, DeepSeek R1, Llama (40 req/min free)</p>
                <p><strong>Groq:</strong> <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-[var(--teal-400)] hover:underline">console.groq.com</a> - Fast inference, generous free tier</p>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'appearance' && (
          <div className="max-w-2xl space-y-6">
            <section>
              <h3 className="text-[14px] font-medium mb-4 text-[var(--text-primary)]">Appearance</h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Theme</label>
                  <select
                    value={localSettings.theme}
                    onChange={e => setLocalSettings({ ...localSettings, theme: e.target.value as any })}
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)]"
                  >
                    <option value="dark">Dark (Abyss Teal)</option>
                    <option value="system">System</option>
                  </select>
                </div>

                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Font Size</label>
                  <input
                    type="range"
                    value={localSettings.fontSize}
                    onChange={e => setLocalSettings({ ...localSettings, fontSize: parseInt(e.target.value) })}
                    className="w-full accent-[var(--teal-500)]"
                    min={10}
                    max={20}
                  />
                  <span className="text-[12px] text-[var(--text-muted)]">{localSettings.fontSize}px</span>
                </div>

                <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                  <label className="block text-[12px] font-medium mb-1 text-[var(--text-secondary)]">Font Family</label>
                  <input
                    type="text"
                    value={localSettings.fontFamily}
                    onChange={e => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--teal-500)]"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="max-w-2xl">
            <section>
              <h3 className="text-[14px] font-medium mb-4 text-[var(--text-primary)]">Keyboard Shortcuts</h3>
              
              <div className="space-y-2">
                {Object.entries(localSettings.shortcuts).map(([action, shortcut]) => (
                  <div key={action} className="flex items-center justify-between py-2 px-3 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)]">
                    <span className="text-[12px] capitalize text-[var(--text-secondary)]">{action.replace(/:/g, ' ')}</span>
                    <input
                      type="text"
                      value={shortcut}
                      onChange={e => setLocalSettings({
                        ...localSettings,
                        shortcuts: { ...localSettings.shortcuts, [action]: e.target.value }
                      })}
                      className="px-3 py-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-[11px] font-[var(--font-mono)] text-[var(--teal-300)] w-32 focus:outline-none focus:border-[var(--teal-500)]"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border-subtle)] flex justify-end bg-[var(--bg-surface)]">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-sm)] hover:bg-[var(--teal-400)] text-[13px] font-medium transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
};
