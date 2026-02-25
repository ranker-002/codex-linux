import React, { useState, useRef, useEffect } from 'react';
import { Agent, AgentMessage, PermissionMode } from '../../shared/types';
import { Send, Bot, User, Loader2, Paperclip, MoreVertical, Copy, Check, ChevronDown, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { PermissionSelector } from './PermissionSelector';

interface ModelOption {
  id: string;
  name: string;
  backend: string;
  isFree?: boolean;
  contextWindow?: number;
  supportsVision?: boolean;
}

interface ChatInterfaceProps {
  agent: Agent;
  onSendMessage: (message: string) => Promise<void>;
  onExecuteTask: (task: string) => Promise<void>;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  onModelChange?: (modelId: string) => void;
  allowBypassMode?: boolean;
  isLoading?: boolean;
  availableModels?: ModelOption[];
  currentModel?: string;
}

const FREE_MODELS: ModelOption[] = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', backend: 'openrouter', isFree: true, contextWindow: 32768 },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', backend: 'openrouter', isFree: true, contextWindow: 128000, supportsVision: true },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', backend: 'openrouter', isFree: true, contextWindow: 32768 },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', backend: 'groq', isFree: true, contextWindow: 128000 },
  { id: 'llama3.2:latest', name: 'Llama 3.2 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000, supportsVision: true },
  { id: 'llama3.3:latest', name: 'Llama 3.3 70B (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'mistral:latest', name: 'Mistral 7B (Ollama)', backend: 'ollama', isFree: true, contextWindow: 32768 },
  { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'qwen2.5:latest', name: 'Qwen 2.5 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'codellama:latest', name: 'Code Llama (Ollama)', backend: 'ollama', isFree: true, contextWindow: 16384 },
];

const BACKEND_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  nvidia: 'NVIDIA NIM',
  groq: 'Groq',
  ollama: 'Ollama',
  google: 'Google AI',
  cerebras: 'Cerebras',
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  agent,
  onSendMessage,
  onExecuteTask,
  onPermissionModeChange,
  onModelChange,
  allowBypassMode = false,
  isLoading = false,
  availableModels,
  currentModel,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedAutoContext, setExpandedAutoContext] = useState<Record<string, boolean>>({});
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModel, setSelectedModel] = useState(currentModel || agent.model);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBackend, setSelectedBackend] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  const models = availableModels || FREE_MODELS;

  useEffect(() => {
    scrollToBottom();
  }, [agent.messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setShowModelSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (currentModel) {
      setSelectedModel(currentModel);
    }
  }, [currentModel]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelSelector(false);
    onModelChange?.(modelId);
  };

  const filteredModels = models.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          model.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBackend = selectedBackend === 'all' || model.backend === selectedBackend;
    return matchesSearch && matchesBackend;
  });

  const groupedModels = filteredModels.reduce((acc, model) => {
    const backend = model.backend || 'other';
    if (!acc[backend]) acc[backend] = [];
    acc[backend].push(model);
    return acc;
  }, {} as Record<string, ModelOption[]>);

  const getCurrentModelInfo = () => {
    return models.find(m => m.id === selectedModel) || { name: selectedModel, backend: 'unknown' };
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    
    if (message.startsWith('/task ')) {
      await onExecuteTask(message.slice(6));
    } else if (message.startsWith('/search ')) {
      const searchQuery = message.slice(8);
      await onSendMessage(`[SEARCH] ${searchQuery}`);
    } else if (message.startsWith('/vision ') || message.startsWith('/analyze ')) {
      const visionQuery = message.split(' ').slice(1).join(' ');
      await onSendMessage(`[VISION] ${visionQuery}`);
    } else {
      await onSendMessage(message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getAutoContext = (message: AgentMessage): null | { files: Array<{ path: string; reason: string }>; totalChars?: number } => {
    const raw = (message as any)?.metadata?.autoContext;
    if (!raw || typeof raw !== 'object') return null;
    const files = Array.isArray(raw.files) ? raw.files : [];
    return {
      files: files
        .filter((f: any) => f && typeof f.path === 'string')
        .map((f: any) => ({ path: String(f.path), reason: String(f.reason || '') })),
      totalChars: typeof raw.totalChars === 'number' ? raw.totalChars : undefined,
    };
  };

  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('```')) {
        return null;
      }
      
      if (line.includes('`')) {
        const parts = line.split(/(`[^`]+`)/);
        return (
          <p key={index} className="my-1">
            {parts.map((part, i) => 
              part.startsWith('`') && part.endsWith('`') ? (
                <code key={i} className="bg-[var(--bg-hover)] px-1 py-0.5 rounded text-[11px] font-[var(--font-mono)] text-[var(--teal-300)]">
                  {part.slice(1, -1)}
                </code>
              ) : (
                part
              )
            )}
          </p>
        );
      }

      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-[15px] font-semibold mt-4 mb-2 text-[var(--text-primary)]">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-[17px] font-semibold mt-4 mb-2 text-[var(--text-primary)]">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-[19px] font-bold mt-4 mb-2 text-[var(--text-primary)]">{line.slice(2)}</h1>;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4 my-1 text-[var(--text-secondary)]">{line.slice(2)}</li>;
      }

      if (line.trim() === '') {
        return <br key={index} />;
      }

      return <p key={index} className="my-1 text-[var(--text-secondary)]">{line}</p>;
    });
  };

  const extractCodeBlocks = (content: string) => {
    const codeBlocks: { language: string; code: string }[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }
    return codeBlocks;
  };

  const currentModelInfo = getCurrentModelInfo();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            agent.status === 'running' ? 'bg-[var(--success)] animate-pulse' :
            agent.status === 'error' ? 'bg-[var(--error)]' :
            agent.status === 'paused' ? 'bg-[var(--warning)]' :
            'bg-[var(--text-muted)]'
          }`} />
          <div>
            <h3 className="font-medium text-[13px] text-[var(--text-primary)]">{agent.name}</h3>
          </div>
        </div>
        
        <div className="relative" ref={modelSelectorRef}>
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors text-[12px] border border-[var(--border-subtle)]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="font-medium truncate max-w-[150px] text-[var(--text-primary)]">{currentModelInfo.name}</span>
            <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--bg-hover)] rounded">
              {BACKEND_LABELS[currentModelInfo.backend || 'unknown'] || currentModelInfo.backend}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
          </button>

          {showModelSelector && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] shadow-xl z-50 max-h-[70vh] overflow-hidden">
              <div className="p-3 border-b border-[var(--border-subtle)]">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-elevated)] rounded-[var(--radius-md)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--teal-500)] border border-[var(--border-subtle)]"
                />
                <div className="flex gap-1 mt-2 flex-wrap">
                  <button
                    onClick={() => setSelectedBackend('all')}
                    className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                      selectedBackend === 'all' ? 'bg-[var(--teal-500)] text-[var(--bg-void)]' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)]'
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(BACKEND_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedBackend(key)}
                      className={`px-2 py-1 text-[10px] rounded-md transition-colors ${
                        selectedBackend === key ? 'bg-[var(--teal-500)] text-[var(--bg-void)]' : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-y-auto max-h-[50vh]">
                {Object.entries(groupedModels).map(([backend, backendModels]) => (
                  <div key={backend}>
                    <div className="px-3 py-2 bg-[var(--bg-elevated)] text-[10px] font-medium text-[var(--text-muted)] sticky top-0">
                      {BACKEND_LABELS[backend] || backend} ({backendModels.length})
                    </div>
                    {backendModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between ${
                          selectedModel === model.id ? 'bg-[rgba(0,200,168,0.08)]' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[12px] truncate text-[var(--text-primary)]">{model.name}</span>
                            {model.isFree && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-[rgba(60,200,120,0.1)] text-[var(--success)] rounded">
                                FREE
                              </span>
                            )}
                            {model.supportsVision && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-[rgba(104,144,244,0.1)] text-[var(--info)] rounded">
                                VISION
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)] truncate">{model.id}</div>
                        </div>
                        {model.contextWindow && model.contextWindow >= 100000 && (
                          <span className="text-[10px] text-[var(--text-muted)] ml-2">
                            {model.contextWindow >= 1000000 ? '1M' : `${model.contextWindow / 1000}K`}
                          </span>
                        )}
                        {selectedModel === model.id && (
                          <Check className="w-3.5 h-3.5 text-[var(--teal-400)] ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onPermissionModeChange && (
            <PermissionSelector
              currentMode={agent.permissionMode}
              onModeChange={onPermissionModeChange}
              allowBypass={allowBypassMode}
            />
          )}
          <span className="text-[11px] text-[var(--text-muted)]">
            {agent.messages.length} messages
          </span>
          <button className="p-2 hover:bg-[var(--bg-hover)] rounded-[var(--radius-sm)] text-[var(--text-muted)] transition-colors">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agent.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
            <Bot className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-[15px] font-medium text-[var(--text-primary)]">Start a conversation</p>
            <p className="text-[12px] mt-2">Send a message or use /task to assign a task</p>
            <div className="mt-6 space-y-2 text-[12px]">
              <button 
                onClick={() => setInput('Can you help me refactor this code?')}
                className="block px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] hover:border-[var(--border-accent)] transition-colors text-[var(--text-secondary)]"
              >
                "Can you help me refactor this code?"
              </button>
              <button 
                onClick={() => setInput('/task Review all JavaScript files for potential bugs')}
                className="block px-4 py-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] hover:border-[var(--border-accent)] transition-colors text-[var(--text-secondary)]"
              >
                "/task Review all JavaScript files..."
              </button>
            </div>
          </div>
        ) : (
          agent.messages.map((message) => (
            <div
              key={message.id}
              className={`group flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' 
                  ? 'bg-[var(--teal-500)] text-[var(--bg-void)]' 
                  : message.role === 'system'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
                  : 'bg-[rgba(0,200,168,0.1)] text-[var(--teal-400)]'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : message.role === 'system' ? (
                  <span className="text-[10px] font-bold">S</span>
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className={`flex-1 max-w-[85%] ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}>
                <div className={`relative rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-[var(--teal-500)] text-[var(--bg-void)]'
                    : message.role === 'system'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)] text-[12px] italic'
                    : 'bg-[var(--bg-card)] border border-[var(--border-subtle)]'
                }`}>
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface)] rounded-md"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3 h-3 text-[var(--success)]" />
                    ) : (
                      <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                    )}
                  </button>

                  <div className="prose prose-sm dark:prose-invert max-w-none pr-8">
                    {message.role === 'assistant' && (() => {
                      const ac = getAutoContext(message);
                      if (!ac || ac.files.length === 0) return null;
                      const isExpanded = Boolean(expandedAutoContext[message.id]);
                      return (
                        <div className="mb-3">
                          <button
                            onClick={() => setExpandedAutoContext(prev => ({ ...prev, [message.id]: !isExpanded }))}
                            className="text-[10px] px-2 py-1 rounded-md bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
                            type="button"
                          >
                            Auto-context: {ac.files.length} files{typeof ac.totalChars === 'number' ? `  ${ac.totalChars} chars` : ''}
                            {isExpanded ? ' (hide)' : ' (show)'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 text-[10px]">
                              <div className="space-y-1">
                                {ac.files.map((f, idx) => (
                                  <div key={`${message.id}-ac-${idx}`} className="flex gap-2">
                                    <span className="font-[var(--font-mono)] text-[var(--text-primary)] truncate max-w-[260px]">{f.path}</span>
                                    <span className="text-[var(--text-muted)]">- {f.reason}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {renderMessageContent(message.content)}
                  </div>

                  {extractCodeBlocks(message.content).map((block, idx) => (
                    <div key={idx} className="mt-4 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">{block.language}</span>
                        <button
                          onClick={() => copyToClipboard(block.code, `code-${idx}`)}
                          className="p-1 hover:bg-[var(--bg-hover)] rounded"
                        >
                          {copiedId === `code-${idx}` ? (
                            <Check className="w-3 h-3 text-[var(--success)]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[var(--text-muted)]" />
                          )}
                        </button>
                      </div>
                      <pre className="bg-[var(--bg-void)] p-3 rounded-b-lg overflow-x-auto">
                        <code className="text-[12px] font-[var(--font-mono)] text-[var(--teal-300)]">{block.code}</code>
                      </pre>
                    </div>
                  ))}

                  <div className={`text-[10px] mt-2 ${
                    message.role === 'user' 
                      ? 'text-[var(--bg-void)] opacity-60'
                      : 'text-[var(--text-muted)]'
                  }`}>
                    {format(new Date(message.timestamp), 'HH:mm')}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,200,168,0.1)] text-[var(--teal-400)] flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--teal-400)]" />
              <span className="text-[12px] text-[var(--text-muted)]">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="relative flex items-end gap-2">
          <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line, /task for tasks)"
              className="w-full px-4 py-3 pr-12 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[var(--radius-lg)] resize-none focus:outline-none focus:border-[var(--teal-500)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] min-h-[56px] max-h-[200px]"
              rows={1}
              style={{ height: 'auto' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 200) + 'px';
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-[var(--teal-500)] text-[var(--bg-void)] rounded-[var(--radius-lg)] hover:bg-[var(--teal-400)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-[10px] text-[var(--text-muted)]">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded text-[9px]">Enter</kbd> to send
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded text-[9px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-[var(--bg-elevated)] rounded text-[9px]">Enter</kbd> for new line
            </span>
          </div>
          <span>{input.length} characters</span>
        </div>
      </div>
    </div>
  );
};
