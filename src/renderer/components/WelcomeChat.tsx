import React, { useMemo, useRef, useState } from 'react';
import { Agent, AIProvider, Skill } from '../../shared/types';
import {
  ArrowUp,
  Folder,
  Monitor,
  GitBranch,
  ImagePlus,
  Sparkles,
  ChevronDown,
  Check
} from 'lucide-react';

interface WelcomeChatProps {
  agents: Agent[];
  providers: AIProvider[];
  skills: Skill[];
  onCreateAgent: (config: any) => Promise<Agent>;
  onAgentCreated?: (agent: Agent, message?: string) => void;
}

const FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', providerId: 'free-models' },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', providerId: 'free-models' },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', providerId: 'free-models' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', providerId: 'free-models' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', providerId: 'free-models' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', providerId: 'free-models' },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', providerId: 'free-models' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', providerId: 'free-models' },
  { id: 'llama3.2:latest', name: 'Llama 3.2 (Ollama)', providerId: 'free-models' },
  { id: 'llama3.3:latest', name: 'Llama 3.3 70B (Ollama)', providerId: 'free-models' },
  { id: 'mistral:latest', name: 'Mistral 7B (Ollama)', providerId: 'free-models' },
  { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Ollama)', providerId: 'free-models' },
  { id: 'qwen2.5:latest', name: 'Qwen 2.5 (Ollama)', providerId: 'free-models' },
  { id: 'codellama:latest', name: 'Code Llama (Ollama)', providerId: 'free-models' },
];

const getFreeModels = (providers: AIProvider[]) => {
  const freeProvider = providers.find(p => p.id === 'free-models');
  if (freeProvider && freeProvider.models.length > 0) {
    return freeProvider.models.map(m => ({ id: m.id, name: m.name, providerId: 'free-models' }));
  }
  return FREE_MODELS;
};

export const WelcomeChat: React.FC<WelcomeChatProps> = ({
  agents,
  providers,
  skills,
  onCreateAgent,
  onAgentCreated,
}) => {
  const [input, setInput] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [selectedRuntime, setSelectedRuntime] = useState('local');
  const [showRuntimeDropdown, setShowRuntimeDropdown] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const runtimeDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const freeModels = useMemo(() => getFreeModels(providers), [providers]);
  const [selectedModel, setSelectedModel] = useState(freeModels[0]?.id || '');

  const runtimeOptions = useMemo(() => {
    const base = [{ id: 'local', label: 'Local' }];
    const providerOptions = providers.slice(0, 3).map((p) => ({ id: p.id, label: p.name }));
    return [...base, ...providerOptions];
  }, [providers]);

  const suggestions = [
    { title: 'Create or update my', chip: 'CLAUDE.md', suffix: 'file' },
    { title: 'Search for a', chip: 'TODO', suffix: 'comment and fix it' },
    { title: 'Recommend areas to improve our', chip: 'tests', suffix: '' },
  ];

  const openFolderPicker = async () => {
    if (!window.electronAPI) {
      console.warn('Electron API not available');
      return;
    }
    try {
      const path = await window.electronAPI.dialog.selectFolder();
      if (path) {
        setWorkspacePath(path);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      const runtimeProvider = runtimeOptions.find((runtime) => runtime.id === selectedRuntime);
      const modelConfig = freeModels.find((model) => model.id === selectedModel) || freeModels[0];
      const providerId = runtimeProvider?.id === 'local' ? modelConfig.providerId : runtimeProvider?.id;

      const newAgent = await onCreateAgent({
        name: 'Quick Chat',
        projectPath: workspacePath,
        providerId,
        model: selectedModel,
        skills: [],
      });

      if (onAgentCreated) {
        onAgentCreated(newAgent, input.trim());
      } else if (window.electronAPI) {
        await window.electronAPI.agent.sendMessage(newAgent.id, input.trim());
      }
      setInput('');
      inputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="welcome-wrap">
      <div className="welcome-inner">
        <div className="welcome-mascot" aria-hidden="true">
          <span className="welcome-mascot-body" />
          <span className="welcome-mascot-legs">
            <span />
            <span />
            <span />
            <span />
          </span>
        </div>

        <div className="welcome-toolbar">
          <button
            onClick={openFolderPicker}
            className="welcome-select"
            data-testid="welcome-select-folder"
          >
              <span className="welcome-select-leading">
                <Folder className="welcome-select-icon" />
              <span className="welcome-select-text">{workspacePath || 'Select folder (optional)'}</span>
            </span>
            <span className="welcome-select-caret">⌄</span>
          </button>

          <div className="welcome-runtime-select" ref={runtimeDropdownRef}>
            <Monitor className="welcome-select-icon" />
            <button
              onClick={() => setShowRuntimeDropdown(!showRuntimeDropdown)}
              className="welcome-runtime-button"
            >
              <span>{runtimeOptions.find(r => r.id === selectedRuntime)?.label || 'Select'}</span>
              <ChevronDown className={`w-3 h-3 ${showRuntimeDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showRuntimeDropdown && (
              <div className="welcome-dropdown">
                {runtimeOptions.map((runtime) => (
                  <button
                    key={runtime.id}
                    onClick={() => { setSelectedRuntime(runtime.id); setShowRuntimeDropdown(false); }}
                    className={`welcome-dropdown-item ${selectedRuntime === runtime.id ? 'active' : ''}`}
                  >
                    <span>{runtime.label}</span>
                    {selectedRuntime === runtime.id && <Check className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="welcome-stage">
          <div className="welcome-main">
            <div className="welcome-composer">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder="Find a small todo in the codebase and do it"
                className="welcome-input"
                data-testid="welcome-input"
              />

              <div className="welcome-composer-footer">
                <div className="welcome-composer-tools">
                  <button className="welcome-composer-tool" title="Attach git context">
                    <GitBranch className="w-4 h-4" />
                  </button>
                  <button className="welcome-composer-tool" title="Attach image">
                    <ImagePlus className="w-4 h-4" />
                  </button>
                  <span className="welcome-composer-meta">
                    {agents.length} sessions · {skills.length} skills
                  </span>
                </div>

                <div className="welcome-composer-actions">
                  <div className="relative" ref={modelDropdownRef}>
                    <button
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="welcome-model-button"
                    >
                      <Sparkles className="w-3 h-3 text-[var(--a-400)]" />
                      <span>{freeModels.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
                      <ChevronDown className={`w-3 h-3 ${showModelDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    {showModelDropdown && (
                      <div className="welcome-dropdown">
                        {freeModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => { setSelectedModel(model.id); setShowModelDropdown(false); }}
                            className={`welcome-dropdown-item ${selectedModel === model.id ? 'active' : ''}`}
                          >
                            <span>{model.name}</span>
                            {selectedModel === model.id && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => void handleSend()}
                    disabled={!input.trim()}
                    className="welcome-send"
                    data-testid="welcome-send"
                  >
                    <ArrowUp className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </div>
            </div>

            <div className="welcome-suggestions">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(`${suggestion.title} ${suggestion.chip} ${suggestion.suffix}`.trim())}
                  className="welcome-suggestion"
                >
                  <span className="welcome-suggestion-text">
                    {suggestion.title}{' '}
                    <span className="welcome-chip">
                      {suggestion.chip}
                    </span>{' '}
                    {suggestion.suffix}
                  </span>
                </button>
              ))}
            </div>

            <div className="welcome-warning">
              <p className="welcome-warning-copy">
                <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Codlux may read, write, or execute files in this folder. This can pose security
                  risks, so only use Codlux in trusted repositories.
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeChat;
