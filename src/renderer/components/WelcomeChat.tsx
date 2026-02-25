import React, { useMemo, useRef, useState } from 'react';
import { Agent, AIProvider, Skill } from '../../shared/types';
import {
  ArrowUp,
  Folder,
  Monitor,
  GitBranch,
  ImagePlus,
  Sparkles,
} from 'lucide-react';

interface WelcomeChatProps {
  agents: Agent[];
  providers: AIProvider[];
  skills: Skill[];
  onCreateAgent: (config: any) => Promise<Agent>;
}

const FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', providerId: 'free' },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', providerId: 'free' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', providerId: 'free' },
];

export const WelcomeChat: React.FC<WelcomeChatProps> = ({
  agents,
  providers,
  skills,
  onCreateAgent,
}) => {
  const [input, setInput] = useState('');
  const [workspacePath, setWorkspacePath] = useState(process.cwd());
  const [selectedRuntime, setSelectedRuntime] = useState('local');
  const [selectedModel, setSelectedModel] = useState(FREE_MODELS[0].id);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      const modelConfig = FREE_MODELS.find((model) => model.id === selectedModel) || FREE_MODELS[0];
      const providerId = runtimeProvider?.id === 'local' ? modelConfig.providerId : runtimeProvider?.id;

      const newAgent = await onCreateAgent({
        name: 'Quick Chat',
        projectPath: workspacePath,
        providerId,
        model: selectedModel,
        skills: [],
      });

      await window.electronAPI.agent.sendMessage(newAgent.id, input.trim());
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
              <span className="welcome-select-text">{workspacePath || 'Select folder'}</span>
            </span>
            <span className="welcome-select-caret">⌄</span>
          </button>

          <div className="welcome-runtime-select">
            <Monitor className="welcome-select-icon" />
            <select
              value={selectedRuntime}
              onChange={(e) => setSelectedRuntime(e.target.value)}
              className="welcome-runtime-native"
              data-testid="welcome-runtime"
            >
              {runtimeOptions.map((runtime) => (
                <option key={runtime.id} value={runtime.id}>
                  {runtime.label}
                </option>
              ))}
            </select>
            <span className="welcome-select-caret">⌄</span>
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
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="welcome-model-select"
                  >
                    {FREE_MODELS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
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
                  Claude Code may read, write, or execute files in this folder. This can pose security
                  risks, so only use Claude Code in trusted repositories.
                </span>
              </p>
            </div>
          </div>

          <div className="welcome-right">
            <div className="welcome-preview">
              <span className="welcome-preview-chip">
                <Monitor className="w-3.5 h-3.5" />
                Preview
              </span>
              <div className="welcome-preview-card">
                <h3>Welcome to Claude Code!</h3>
                <p>Your coding partner that works directly in your codebase.</p>

                <div className="welcome-preview-log">
                  <div>• Task: Find clawed component</div>
                  <div>• Grep: <code>claw</code></div>
                  <div>• Read: <code>./components/ClawedCharacter.tsx</code></div>
                  <div>• Edit: keyframes block</div>
                </div>

                <button className="btn btn-secondary btn-sm">Install runtime dependencies</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeChat;
