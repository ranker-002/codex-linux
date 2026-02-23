import React, { useState, useEffect } from 'react';
import { Brain, Gauge, ChevronDown, ChevronUp, Info, AlertTriangle, CheckCircle } from 'lucide-react';

export interface ContextUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  maxTokens: number;
  messagesCount: number;
  filesInContext: number;
}

export interface ThinkingConfig {
  enabled: boolean;
  maxThinkingTokens: number;
  adaptiveThinking: boolean;
  currentThinkingTokens: number;
}

interface ContextUsageDisplayProps {
  usage: ContextUsage;
  thinking?: ThinkingConfig;
  compact?: boolean;
  onThinkingToggle?: (enabled: boolean) => void;
  onThinkingTokensChange?: (tokens: number) => void;
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
};

const getUsagePercentage = (current: number, max: number): number => {
  return Math.min(100, Math.round((current / max) * 100));
};

const getUsageColor = (percentage: number): string => {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
};

export const ContextUsageDisplay: React.FC<ContextUsageDisplayProps> = ({
  usage,
  thinking,
  compact = false,
  onThinkingToggle,
  onThinkingTokensChange,
}) => {
  const [expanded, setExpanded] = useState(!compact);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);

  const usagePercentage = getUsagePercentage(usage.totalTokens, usage.maxTokens);
  const usageColor = getUsageColor(usagePercentage);

  if (compact) {
    return (
      <div 
        className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain className="w-3.5 h-3.5" />
        <span>{formatNumber(usage.totalTokens)}</span>
        <span className="text-muted-foreground/60">/</span>
        <span>{formatNumber(usage.maxTokens)}</span>
        
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
          <div 
            className={cn('h-full rounded-full transition-all', usageColor)}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header - Always visible */}
      <div 
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-medium">Context Usage</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full rounded-full transition-all', usageColor)}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {usagePercentage}%
            </span>
          </div>
          
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 py-3 border-t border-border space-y-4">
          {/* Token breakdown */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Input</div>
              <div className="text-lg font-semibold">{formatNumber(usage.inputTokens)}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round((usage.inputTokens / usage.maxTokens) * 100)}% of limit
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Output</div>
              <div className="text-lg font-semibold">{formatNumber(usage.outputTokens)}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round((usage.outputTokens / usage.maxTokens) * 100)}% of limit
              </div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Total</div>
              <div className="text-lg font-semibold">{formatNumber(usage.totalTokens)}</div>
              <div className="text-xs text-muted-foreground">
                / {formatNumber(usage.maxTokens)}
              </div>
            </div>
          </div>

          {/* Additional stats */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{usage.messagesCount} messages</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{usage.filesInContext} files in context</span>
            </div>
          </div>

          {/* Thinking config */}
          {thinking && (
            <div className="border-t border-border pt-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
              >
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" />
                  <span className="font-medium">Extended Thinking</span>
                  {thinking.adaptiveThinking && (
                    <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                      Adaptive
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={thinking.enabled}
                      onChange={(e) => onThinkingToggle?.(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  
                  {thinkingExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {thinkingExpanded && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current thinking tokens</span>
                    <span className="font-medium">{formatNumber(thinking.currentThinkingTokens)}</span>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Max thinking tokens</span>
                      <span className="font-medium">{formatNumber(thinking.maxThinkingTokens)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={thinking.maxThinkingTokens}
                      value={thinking.maxThinkingTokens}
                      onChange={(e) => onThinkingTokensChange?.(parseInt(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0</span>
                      <span>{formatNumber(thinking.maxThinkingTokens)}</span>
                    </div>
                  </div>

                  {!thinking.adaptiveThinking && thinking.enabled && (
                    <div className="flex items-start gap-2 p-2 bg-yellow-500/10 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-500">
                        Extended thinking uses additional tokens for reasoning. 
                        This may increase costs on paid plans.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextUsageDisplay;
