import React, { useState } from 'react';
import { Settings, AIProvider } from '../shared/types';
import { Settings as SettingsIcon, Key, Eye, EyeOff, Save } from 'lucide-react';

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

  const handleSave = async () => {
    // Save all settings
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

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'providers', label: 'AI Providers' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'shortcuts', label: 'Shortcuts' }
  ];

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
          <div className="max-w-2xl space-y-6">
            <section>
              <h3 className="text-lg font-medium mb-4">AI Provider Configuration</h3>
              
              <div className="space-y-6">
                {providers.map(provider => (
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
                  </div>
                ))}
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