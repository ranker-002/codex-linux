import React, { useState, useRef, useEffect } from 'react';
import { Agent, AgentMessage, AgentStatus, PermissionMode } from '../../shared/types';
import { Send, Bot, User, Loader2, Paperclip, MoreVertical, Copy, Check, ChevronDown, Sparkles, Zap } from 'lucide-react';
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
  { id: 'google/gemma-3-12b-it:free', name: 'Gemma 3 12B', backend: 'openrouter', isFree: true, contextWindow: 32768 },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', backend: 'openrouter', isFree: true, contextWindow: 128000, supportsVision: true },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', backend: 'openrouter', isFree: true, contextWindow: 32768 },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron 12B VL', backend: 'openrouter', isFree: true, contextWindow: 32768, supportsVision: true },
  { id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air', backend: 'openrouter', isFree: true, contextWindow: 128000 },
  { id: 'liquid/lfm-2.5-1.2b-instruct:free', name: 'LFM 2.5 1.2B', backend: 'openrouter', isFree: true, contextWindow: 8192 },
  { id: 'upstage/solar-pro-3:free', name: 'Solar Pro 3', backend: 'openrouter', isFree: true, contextWindow: 32768 },
  { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', backend: 'nvidia', isFree: true, contextWindow: 128000 },
  { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (NVIDIA)', backend: 'nvidia', isFree: true, contextWindow: 128000 },
  { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B (NVIDIA)', backend: 'nvidia', isFree: true, contextWindow: 8192 },
  { id: 'microsoft/phi-3-medium-128k-instruct', name: 'Phi-3 Medium 128K', backend: 'nvidia', isFree: true, contextWindow: 128000 },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', backend: 'groq', isFree: true, contextWindow: 128000 },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Groq)', backend: 'groq', isFree: true, contextWindow: 128000 },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Groq)', backend: 'groq', isFree: true, contextWindow: 32768 },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B (Groq)', backend: 'groq', isFree: true, contextWindow: 8192 },
  { id: 'minimax-m2.5:cloud', name: 'Minimax M2.5 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'llama3.2:latest', name: 'Llama 3.2 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000, supportsVision: true },
  { id: 'llama3.3:latest', name: 'Llama 3.3 70B (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'mistral:latest', name: 'Mistral 7B (Ollama)', backend: 'ollama', isFree: true, contextWindow: 32768 },
  { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'qwen2.5:latest', name: 'Qwen 2.5 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'qwen2.5-coder:latest', name: 'Qwen 2.5 Coder (Ollama)', backend: 'ollama', isFree: true, contextWindow: 32768 },
  { id: 'gemma3:latest', name: 'Gemma 3 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 32768, supportsVision: true },
  { id: 'phi3:latest', name: 'Phi-3 (Ollama)', backend: 'ollama', isFree: true, contextWindow: 128000 },
  { id: 'codellama:latest', name: 'Code Llama (Ollama)', backend: 'ollama', isFree: true, contextWindow: 16384 },
  { id: 'deepseek-coder:latest', name: 'DeepSeek Coder (Ollama)', backend: 'ollama', isFree: true, contextWindow: 16384 },
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

  const handleImageUpload = async (file: File) => {
    if (isLoading) return;
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        await onSendMessage(`[IMAGE] ${base64}`);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
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
                <code key={i} className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
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
        return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      }

      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4 my-1">{line.slice(2)}</li>;
      }

      if (line.trim() === '') {
        return <br key={index} />;
      }

      return <p key={index} className="my-1">{line}</p>;
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
    <div className="flex flex-col h-full bg-card">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/50">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${
            agent.status === 'running' ? 'bg-green-500 animate-pulse' :
            agent.status === 'error' ? 'bg-red-500' :
            agent.status === 'paused' ? 'bg-yellow-500' :
            'bg-gray-400'
          }`} />
          <div>
            <h3 className="font-medium">{agent.name}</h3>
          </div>
        </div>
        
        {/* Model Selector */}
        <div className="relative" ref={modelSelectorRef}>
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm"
          >
            <Sparkles className="w-4 h-4 text-green-500" />
            <span className="font-medium truncate max-w-[150px]">{currentModelInfo.name}</span>
            <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-background rounded">
              {BACKEND_LABELS[currentModelInfo.backend || 'unknown'] || currentModelInfo.backend}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} />
          </button>

          {showModelSelector && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-xl z-50 max-h-[70vh] overflow-hidden">
              <div className="p-3 border-b border-border">
                <input
                  type="text"
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 bg-muted rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex gap-1 mt-2 flex-wrap">
                  <button
                    onClick={() => setSelectedBackend('all')}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      selectedBackend === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    All
                  </button>
                  {Object.entries(BACKEND_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedBackend(key)}
                      className={`px-2 py-1 text-xs rounded-md transition-colors ${
                        selectedBackend === key ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
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
                    <div className="px-3 py-2 bg-muted/50 text-xs font-medium text-muted-foreground sticky top-0">
                      {BACKEND_LABELS[backend] || backend} ({backendModels.length})
                    </div>
                    {backendModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                        className={`w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-center justify-between ${
                          selectedModel === model.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{model.name}</span>
                            {model.isFree && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-500 rounded">
                                FREE
                              </span>
                            )}
                            {model.supportsVision && (
                              <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-500 rounded">
                                VISION
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{model.id}</div>
                        </div>
                        {model.contextWindow && model.contextWindow >= 100000 && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {model.contextWindow >= 1000000 ? '1M' : `${model.contextWindow / 1000}K`}
                          </span>
                        )}
                        {selectedModel === model.id && (
                          <Check className="w-4 h-4 text-primary ml-2" />
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
          <span className="text-xs text-muted-foreground">
            {agent.messages.length} messages
          </span>
          <button className="p-2 hover:bg-muted rounded-md">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {agent.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bot className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm mt-2">Send a message or use /task to assign a task</p>
            <div className="mt-6 space-y-2 text-sm">
              <button 
                onClick={() => setInput('Can you help me refactor this code?')}
                className="block px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                "Can you help me refactor this code?"
              </button>
              <button 
                onClick={() => setInput('/task Review all JavaScript files for potential bugs')}
                className="block px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                "/task Review all JavaScript files..."
              </button>
              <button 
                onClick={() => setInput('Explain how this function works')}
                className="block px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                "Explain how this function works"
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
                  ? 'bg-primary text-primary-foreground' 
                  : message.role === 'system'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-green-500/10 text-green-500'
              }`}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : message.role === 'system' ? (
                  <span className="text-xs font-bold">S</span>
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div className={`flex-1 max-w-[85%] ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}>
                <div className={`relative rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : message.role === 'system'
                    ? 'bg-muted text-muted-foreground text-sm italic'
                    : 'bg-muted'
                }`}>
                  <button
                    onClick={() => copyToClipboard(message.content, message.id)}
                    className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-md"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
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
                            className="text-xs px-2 py-1 rounded-md bg-background/60 hover:bg-background/80 border border-border text-muted-foreground"
                            type="button"
                          >
                            Auto-context: {ac.files.length} files{typeof ac.totalChars === 'number' ? `  ${ac.totalChars} chars` : ''}
                            {isExpanded ? ' (hide)' : ' (show)'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-md border border-border bg-background/50 p-2 text-xs">
                              <div className="space-y-1">
                                {ac.files.map((f, idx) => (
                                  <div key={`${message.id}-ac-${idx}`} className="flex gap-2">
                                    <span className="font-mono text-foreground truncate max-w-[260px]">{f.path}</span>
                                    <span className="text-muted-foreground">- {f.reason}</span>
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
                    <div key={idx} className="mt-4 rounded-lg overflow-hidden border border-border">
                      <div className="flex items-center justify-between px-3 py-2 bg-background/50 border-b border-border">
                        <span className="text-xs font-medium text-muted-foreground">{block.language}</span>
                        <button
                          onClick={() => copyToClipboard(block.code, `code-${idx}`)}
                          className="p-1 hover:bg-background rounded"
                        >
                          {copiedId === `code-${idx}` ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <pre className="bg-black/50 p-3 rounded-b-lg overflow-x-auto">
                        <code className="text-sm font-mono text-green-400">{block.code}</code>
                      </pre>
                    </div>
                  ))}

                  <div className={`text-xs mt-2 ${
                    message.role === 'user' 
                      ? 'text-primary-foreground/60' 
                      : 'text-muted-foreground'
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
            <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background/50">
        <div className="relative flex items-end gap-2">
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <Paperclip className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Shift+Enter for new line, /task for tasks)"
              className="w-full px-4 py-3 pr-12 bg-background border border-input rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary min-h-[56px] max-h-[200px]"
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
            className="p-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> to send
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> for new line
            </span>
          </div>
          <span>{input.length} characters</span>
        </div>
      </div>
    </div>
  );
};
