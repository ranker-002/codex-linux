import React, { useState, useRef, useEffect } from 'react';
import { Agent, AgentMessage, AgentStatus, PermissionMode } from '../../shared/types';
import { Send, Bot, User, Loader2, Paperclip, MoreVertical, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { PermissionSelector } from './PermissionSelector';

interface ChatInterfaceProps {
  agent: Agent;
  onSendMessage: (message: string) => Promise<void>;
  onExecuteTask: (task: string) => Promise<void>;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  allowBypassMode?: boolean;
  isLoading?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  agent,
  onSendMessage,
  onExecuteTask,
  onPermissionModeChange,
  allowBypassMode = false,
  isLoading = false
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedAutoContext, setExpandedAutoContext] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [agent.messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const message = input;
    setInput('');
    
    // Check for slash commands
    if (message.startsWith('/task ')) {
      await onExecuteTask(message.slice(6));
    } else if (message.startsWith('/search ')) {
      // Handle search command
      const searchQuery = message.slice(8);
      await onSendMessage(`[SEARCH] ${searchQuery}`);
    } else if (message.startsWith('/vision ') || message.startsWith('/analyze ')) {
      // Handle vision command
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
      totalChars: typeof raw.totalChars === 'number' ? raw.totalChars : undefined
    };
  };

  const renderMessageContent = (content: string) => {
    // Simple markdown-like rendering
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        return null; // Handled separately
      }
      
      // Inline code
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

      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mt-4 mb-2">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
      }

      // Lists
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={index} className="ml-4 my-1">{line.slice(2)}</li>;
      }

      // Empty line
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
            <p className="text-xs text-muted-foreground">{agent.model}</p>
          </div>
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
                &quot;Can you help me refactor this code?&quot;
              </button>
              <button 
                onClick={() => setInput('/task Review all JavaScript files for potential bugs')}
                className="block px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                &quot;/task Review all JavaScript files...&quot;
              </button>
              <button 
                onClick={() => setInput('Explain how this function works')}
                className="block px-4 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                &quot;Explain how this function works&quot;
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
                  {/* Copy button */}
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

                  {/* Message content */}
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
                            Auto-context: {ac.files.length} files{typeof ac.totalChars === 'number' ? ` • ${ac.totalChars} chars` : ''}
                            {isExpanded ? ' (hide)' : ' (show)'}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-md border border-border bg-background/50 p-2 text-xs">
                              <div className="space-y-1">
                                {ac.files.map((f, idx) => (
                                  <div key={`${message.id}-ac-${idx}`} className="flex gap-2">
                                    <span className="font-mono text-foreground truncate max-w-[260px]">{f.path}</span>
                                    <span className="text-muted-foreground">— {f.reason}</span>
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

                  {/* Code blocks */}
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

                  {/* Timestamp */}
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
        
        {/* Loading indicator */}
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
