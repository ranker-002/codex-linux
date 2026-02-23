import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Copy, Check, X, Plus, Trash2, MessageSquare } from 'lucide-react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface ChatTabProps {
  onSendMessage?: (message: string) => Promise<string>;
  onClearChat?: () => void;
  initialMessages?: ChatMessage[];
}

function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ');
}

const formatTimestamp = (date: Date): string => {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const ChatTab: React.FC<ChatTabProps> = ({
  onSendMessage,
  onClearChat,
  initialMessages = [],
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response = '';
      
      if (onSendMessage) {
        response = await onSendMessage(userMessage.content);
      } else {
        response = generateMockResponse(userMessage.content);
      }

      setMessages(prev => {
        const newMessages = prev.filter(m => m.id !== loadingMessage.id);
        return [
          ...newMessages,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: response,
            timestamp: new Date(),
          },
        ];
      });
    } catch (error) {
      setMessages(prev => {
        const newMessages = prev.filter(m => m.id !== loadingMessage.id);
        return [
          ...newMessages,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockResponse = (input: string): string => {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return "Hello! I'm Codex Chat - a conversational AI assistant without file access. I can help you with general questions, coding concepts, debugging strategies, and more. What would you like to chat about?";
    }
    
    if (lowerInput.includes('code') || lowerInput.includes('program')) {
      return "I'd be happy to help with coding concepts! While I can't access your files in this chat mode, I can explain:\n\n- Programming patterns and best practices\n- Algorithm design\n- Debugging strategies\n- Language-specific features\n- Architecture decisions\n\nWhat would you like to learn more about?";
    }
    
    if (lowerInput.includes('help')) {
      return "In this Chat mode, I can help you with:\n\n- **General questions** about programming\n- **Concept explanations** (algorithms, patterns, etc.)\n- **Debugging strategies** without seeing your code\n- **Code reviews** if you paste snippets\n- **Best practice recommendations**\n\nNote: This mode doesn't have file access. For coding tasks with file access, use the Code tab!";
    }

    return `I understand you're asking about "${input.slice(0, 50)}...". 

In this Chat mode, I can have general conversations about:
- Programming concepts and patterns
- Debugging strategies
- Code architecture
- Best practices
- Language features

For file-based coding tasks, please switch to the **Code** tab where I can access your project files!`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([]);
    onClearChat?.();
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          <h2 className="font-semibold">Chat</h2>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            No file access
          </span>
        </div>
        
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-muted transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bot className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium mb-2">Welcome to Codex Chat</p>
            <p className="text-sm text-center max-w-md">
              A conversational AI assistant without file access. 
              Great for general questions, coding concepts, and debugging strategies.
            </p>
            <p className="text-xs mt-4 text-muted-foreground/60">
              For file-based coding tasks, use the Code tab
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                message.role === 'user' ? 'bg-primary/10' : 'bg-muted'
              )}>
                {message.role === 'user' ? (
                  <User className="w-4 h-4 text-primary" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
              
              <div className={cn(
                'flex-1 max-w-[80%]',
                message.role === 'user' ? 'text-right' : 'text-left'
              )}>
                <div className={cn(
                  'inline-block px-4 py-2 rounded-lg',
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted'
                )}>
                  {message.isLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
                
                {!message.isLoading && message.role === 'assistant' && (
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => handleCopy(message.content, message.id)}
                      className="p-1 hover:bg-muted rounded transition-colors"
                      title="Copy"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3 text-muted-foreground" />
                      )}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Codex Chat..."
              className="w-full px-4 py-3 bg-muted border border-input rounded-lg resize-none text-sm"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-3 rounded-lg transition-colors',
              input.trim() && !isLoading
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send, Shift+Enter for new line • Chat mode has no file access
        </p>
      </div>
    </div>
  );
};

export default ChatTab;
