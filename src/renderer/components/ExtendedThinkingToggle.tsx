import React, { useState } from 'react';
import { Brain, Info, AlertTriangle, Zap, Gauge } from 'lucide-react';
import { ExtendedThinkingConfig } from '../../shared/types';

interface ExtendedThinkingToggleProps {
  config: ExtendedThinkingConfig;
  onChange: (config: ExtendedThinkingConfig) => void;
  disabled?: boolean;
  model?: string;
}

export const ExtendedThinkingToggle: React.FC<ExtendedThinkingToggleProps> = ({
  config,
  onChange,
  disabled = false,
  model = ''
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const handleToggle = () => {
    onChange({
      ...config,
      enabled: !config.enabled
    });
  };

  const handleMaxTokensChange = (value: number) => {
    onChange({
      ...config,
      maxTokens: Math.max(0, Math.min(32000, value))
    });
  };

  const handleReasoningEffortChange = (effort: 'low' | 'medium' | 'high') => {
    onChange({
      ...config,
      reasoningEffort: effort
    });
  };

  // Check if model supports extended thinking
  const supportsExtendedThinking = model.startsWith('o1') || model.includes('opus');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className="font-medium">Extended Thinking</span>
        </div>
        
        <button
          onClick={handleToggle}
          disabled={disabled || !supportsExtendedThinking}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            config.enabled ? 'bg-purple-500' : 'bg-muted'
          } ${disabled || !supportsExtendedThinking ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Improves performance on complex reasoning tasks by using additional tokens for thinking.
      </p>

      {!supportsExtendedThinking && (
        <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Extended thinking is only available with o1 and Claude 3 Opus models.
          </span>
        </div>
      )}

      {config.enabled && supportsExtendedThinking && (
        <div className="space-y-3 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
          {/* Reasoning Effort Selector */}
          <div>
            <label className="text-xs font-medium mb-2 block">Reasoning Effort</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleReasoningEffortChange('low')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  config.reasoningEffort === 'low'
                    ? 'bg-purple-500 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <Zap className="w-3 h-3" />
                Low
              </button>
              <button
                onClick={() => handleReasoningEffortChange('medium')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  config.reasoningEffort === 'medium'
                    ? 'bg-purple-500 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <Gauge className="w-3 h-3" />
                Medium
              </button>
              <button
                onClick={() => handleReasoningEffortChange('high')}
                className={`flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  config.reasoningEffort === 'high'
                    ? 'bg-purple-500 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <Brain className="w-3 h-3" />
                High
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {config.reasoningEffort === 'low' && 'Minimal thinking, faster responses'}
              {config.reasoningEffort === 'medium' && 'Balanced thinking for most tasks'}
              {config.reasoningEffort === 'high' && 'Deep reasoning for complex problems'}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Max Thinking Tokens</label>
              <span className="text-xs text-muted-foreground">{config.maxTokens}</span>
            </div>
            <input
              type="range"
              min="0"
              max="32000"
              step="1000"
              value={config.maxTokens}
              onChange={e => handleMaxTokensChange(parseInt(e.target.value))}
              disabled={disabled}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0 (disabled)</span>
              <span>16000</span>
              <span>32000</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-yellow-600 bg-yellow-500/10 p-2 rounded">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              Extended thinking uses additional tokens and may increase costs. 
              Set to 0 to disable thinking entirely.
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Info className="w-3 h-3" />
        {showDetails ? 'Hide details' : 'Learn more'}
      </button>

      {showDetails && (
        <div className="text-xs text-muted-foreground space-y-2 bg-muted/50 p-3 rounded-lg">
          <p>
            <strong>How it works:</strong> When enabled, the model uses a portion of your token budget 
            to "think" through complex problems before responding. This improves accuracy on tasks 
            requiring multi-step reasoning, math, or logic.
          </p>
          <p>
            <strong>Reasoning Effort:</strong> Controls how deeply the model thinks before responding.
            Low = faster responses, High = deeper analysis.
          </p>
          <p>
            <strong>Cost:</strong> Thinking tokens count toward your input token usage and pricing. 
            Disable by setting max tokens to 0.
          </p>
        </div>
      )}
    </div>
  );
};

// Component to display reasoning tokens in messages
interface ReasoningDisplayProps {
  reasoning?: string;
  tokens?: number;
  effort?: 'low' | 'medium' | 'high';
}

export const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({
  reasoning,
  tokens,
  effort
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reasoning && !tokens) return null;

  return (
    <div className="mt-2 p-2 bg-purple-500/5 border border-purple-500/20 rounded-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
            Reasoning Process
          </span>
          {effort && (
            <span className="text-xs px-1.5 py-0.5 bg-purple-500/10 rounded text-purple-600 dark:text-purple-400 capitalize">
              {effort}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {tokens && (
            <span className="text-xs text-muted-foreground">
              {tokens.toLocaleString()} tokens
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </button>

      {isExpanded && reasoning && (
        <div className="mt-2 pt-2 border-t border-purple-500/10">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-2 rounded">
            {reasoning}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ExtendedThinkingToggle;
