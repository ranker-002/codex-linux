import React, { useState, useRef } from 'react';
import { Agent, AIProvider, Skill } from '../../shared/types';
import { Send, Sparkles, Code2, GitBranch, Wrench, Clock, Bot, X } from 'lucide-react';

interface WelcomeChatProps {
  agents: Agent[];
  providers: AIProvider[];
  skills: Skill[];
  onCreateAgent: (config: any) => Promise<Agent>;
}

const FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', backend: 'openrouter' },
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1', backend: 'openrouter' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1', backend: 'openrouter' },
];

export const WelcomeChat: React.FC<WelcomeChatProps> = ({
  agents,
  providers,
  skills,
  onCreateAgent
}) => {
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState('Cowork');
  const [selectedModel] = useState(FREE_MODELS[0].id);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = [
    { icon: Code2, text: 'Optimize my workflow' },
    { icon: GitBranch, text: 'Organize my files' },
    { icon: Wrench, text: 'Find insights in data' },
    { icon: Clock, text: 'Build an automation' },
  ];

  const files = [
    { name: 'Project Constitution v4', lines: 491, type: 'TEXT' },
    { name: 'Task Breakdown', lines: 566, type: 'TEXT' },
    { name: 'Implementation Plan', lines: 390, type: 'TEXT' },
  ];

  const handleSend = async () => {
    if (!input.trim()) return;
    
    try {
      const newAgent = await onCreateAgent({
        name: 'Quick Chat',
        projectPath: process.cwd(),
        providerId: 'free',
        model: selectedModel,
        skills: []
      });
      
      await window.electronAPI.agent.sendMessage(newAgent.id, input);
      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex relative">
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,200,168,0.04) 1px, transparent 1px)',
          backgroundSize: '22px 22px'
        }}
      />
      
      <div className="absolute w-[600px] h-[400px] -top-[120px] -right-[100px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,200,168,0.09) 0%, transparent 65%)'
        }}
      />
      <div className="absolute w-[300px] h-[300px] -bottom-[80px] -left-[60px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(0,150,130,0.06) 0%, transparent 70%)'
        }}
      />

      <div className="flex-1 flex flex-col z-10">
        <div className="h-12 border-b border-[var(--border-subtle)] flex items-center px-5 gap-1">
          <div className="flex gap-0.5 bg-[var(--bg-elevated)] p-[3px] rounded-lg">
            {['Chat', 'Cowork', 'Code'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === tab
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-[0_1px_4px_rgba(0,0,0,0.4)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-7 flex flex-col gap-5 overflow-hidden">
          <h1 
            className="text-[22px] leading-tight tracking-[-0.01em] text-[var(--text-primary)]"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 300 }}
          >
            Let's knock something<br />off your list
          </h1>

          <div className="grid grid-cols-2 gap-2.5 flex-1">
            {suggestions.map((sugg, idx) => {
              const Icon = sugg.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setInput(sugg.text)}
                  className="flex items-center gap-2.5 px-4 py-3.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] text-left hover:border-[var(--border-accent)] transition-colors group"
                >
                  <div className="w-7 h-7 rounded-md bg-[rgba(0,200,168,0.08)] border border-[rgba(0,200,168,0.12)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[var(--teal-400)]" />
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {sugg.text}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[var(--radius-lg)] px-3.5 py-3 flex gap-2.5 items-center">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can I help you today?"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] resize-none leading-normal"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-7 h-7 rounded-[7px] bg-[var(--teal-500)] flex items-center justify-center disabled:opacity-50 hover:bg-[var(--teal-400)] transition-colors flex-shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--bg-void)">
                <path d="M1 6l9-4-3.5 4L10 10 1 6z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="w-60 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] p-4 flex flex-col gap-3 z-10 flex-shrink-0">
        <div>
          <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-1">
            Memory
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-3 py-2.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
            Purpose & context
            <small className="block text-[var(--text-muted)] text-[10px] mt-0.5">
              Only you · Updated 14 days ago
            </small>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium tracking-[0.12em] uppercase text-[var(--text-muted)] mb-1">
            Files
          </div>
          <div className="flex flex-col gap-2">
            {files.map((file, idx) => (
              <div key={idx} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-md)] px-3 py-2.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {file.name}
                <small className="block text-[var(--text-muted)] text-[10px] mt-0.5">
                  {file.lines} lines · {file.type}
                </small>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <div className="h-1 bg-[var(--bg-hover)] rounded overflow-hidden">
            <div className="h-full rounded bg-gradient-to-r from-[var(--teal-700)] to-[var(--teal-400)]" style={{ width: '2%' }} />
          </div>
          <div className="text-[9px] text-[var(--text-muted)] mt-1.5">
            2% of project capacity
          </div>
        </div>
      </div>
    </div>
  );
};
