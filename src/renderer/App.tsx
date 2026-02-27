import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { WorktreePanel } from './components/WorktreePanel';
import { SkillsPanel } from './components/SkillsPanel';
import { AutomationPanel } from './components/AutomationPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { CodeWorkspace } from './components/CodeWorkspace';
import { AuditTrailPanel } from './components/AuditTrailPanel';
import { WelcomeChat } from './components/WelcomeChat';
import { ChatInterface } from './components/ChatInterface';
import { I18nProvider } from './i18n/I18nProvider';
import { Agent, Worktree, Skill, Automation, AIProvider, Settings } from '../shared/types';
import './styles/design-system.css';
import { ElectronAPI } from './types.d';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [streamingContent, setStreamingContent] = useState<Record<string, string>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveTab('chat');
      return;
    }
    if (path.startsWith('/agents')) {
      setActiveTab('agents');
      return;
    }
    if (path.startsWith('/code')) {
      setActiveTab('code');
      return;
    }
    if (path.startsWith('/worktrees')) {
      setActiveTab('worktrees');
      return;
    }
    if (path.startsWith('/skills')) {
      setActiveTab('skills');
      return;
    }
    if (path.startsWith('/automations')) {
      setActiveTab('automations');
      return;
    }
    if (path.startsWith('/audit')) {
      setActiveTab('audit');
      return;
    }
    if (path.startsWith('/settings')) {
      setActiveTab('settings');
      return;
    }
    setActiveTab('chat');
  }, [location.pathname]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'chat':
        navigate('/');
        break;
      case 'agents':
        navigate('/agents');
        break;
      case 'code':
        navigate('/code');
        break;
      case 'worktrees':
        navigate('/worktrees');
        break;
      case 'skills':
        navigate('/skills');
        break;
      case 'automations':
        navigate('/automations');
        break;
      case 'audit':
        navigate('/audit');
        break;
      case 'settings':
        navigate('/settings');
        break;
      default:
        navigate('/');
    }
  };

  const handleSelectAgent = (agent: Agent, messageToSend?: string) => {
    console.log('[DEBUG] handleSelectAgent called:', agent.id, messageToSend);
    setSelectedAgent(agent);
    setActiveTab('chat');
    navigate('/');
    if (messageToSend) {
      console.log('[DEBUG] Setting pendingMessage:', messageToSend);
      setPendingMessage(messageToSend);
    }
  };

  const handleSendMessage = async (message: string) => {
    console.log('[DEBUG] handleSendMessage called:', message);
    console.log('[DEBUG] selectedAgent:', selectedAgent);
    if (!selectedAgent) {
      console.log('[DEBUG] No selectedAgent, returning');
      return;
    }
    
    console.log('[DEBUG] Calling backend sendMessage');
    try {
      await window.electronAPI.agent.sendMessage(selectedAgent.id, message);
      console.log('[DEBUG] sendMessage completed');
    } catch (error) {
      console.error('[DEBUG] sendMessage error:', error);
    }
  };

  const handleExecuteTask = async (task: string) => {
    if (!selectedAgent) return;
    await window.electronAPI.agent.executeTask(selectedAgent.id, task);
  };

  const handleModelChange = async (modelId: string) => {
    if (!selectedAgent) return;
    await window.electronAPI.agent.update(selectedAgent.id, { model: modelId });
    setSelectedAgent({ ...selectedAgent, model: modelId });
    setAgents(prev => prev.map(a => a.id === selectedAgent.id ? { ...a, model: modelId } : a));
  };

  useEffect(() => {
    const resolveTheme = () => {
      const selectedTheme = settings?.theme ?? 'dark';
      if (selectedTheme === 'light') {
        return 'light';
      }
      if (
        selectedTheme === 'system' &&
        window.matchMedia?.('(prefers-color-scheme: light)').matches
      ) {
        return 'light';
      }
      return 'dark';
    };

    const applyTheme = () => {
      document.documentElement.setAttribute('data-theme', resolveTheme());
    };

    applyTheme();

    if (settings?.theme !== 'system' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const onThemeChange = () => applyTheme();
    mediaQuery.addEventListener('change', onThemeChange);

    return () => {
      mediaQuery.removeEventListener('change', onThemeChange);
    };
  }, [settings?.theme]);

  useEffect(() => {
    if (selectedAgent && pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage(null);
      handleSendMessage(msg);
    }
  }, [selectedAgent, pendingMessage]);

  useEffect(() => {
    loadInitialData();

    if (!window.electronAPI) {
      return;
    }

    const handleStreamChunk = ({ agentId, chunk }: { agentId: string; chunk: string }) => {
      setStreamingContent(prev => ({
        ...prev,
        [agentId]: (prev[agentId] || '') + chunk
      }));
    };

    const handleStreamEnd = ({ agentId }: { agentId: string }) => {
      setAgents(prev => prev.map(agent => {
        if (agent.id === agentId && streamingContent[agentId]) {
          return {
            ...agent,
            messages: [...agent.messages, {
              id: Date.now().toString(),
              role: 'assistant',
              content: streamingContent[agentId],
              timestamp: new Date()
            }]
          };
        }
        return agent;
      }));
      setStreamingContent(prev => {
        const newContent = { ...prev };
        delete newContent[agentId];
        return newContent;
      });
    };

    const handleStreamError = ({ agentId, error }: { agentId: string; error: string }) => {
      console.error(`Stream error for agent ${agentId}:`, error);
      setStreamingContent(prev => {
        const newContent = { ...prev };
        delete newContent[agentId];
        return newContent;
      });
    };

    const handleAgentMessage = ({ agentId, message }: { agentId: string; message: any }) => {
      console.log('[DEBUG] Received agent:message:', agentId, message);
      setAgents(prev => prev.map(agent => {
        if (agent.id === agentId) {
          // Check if message already exists to avoid duplicates
          if (agent.messages.some(m => m.id === message.id)) {
            return agent;
          }
          return {
            ...agent,
            messages: [...agent.messages, message]
          };
        }
        return agent;
      }));

      // Update selected agent if it's the one that sent/received the message
      setSelectedAgent(prev => {
        if (prev?.id === agentId) {
          if (prev.messages.some(m => m.id === message.id)) {
            return prev;
          }
          return {
            ...prev,
            messages: [...prev.messages, message]
          };
        }
        return prev;
      });
    };

    window.electronAPI.on('agent:streamChunk', handleStreamChunk);
    window.electronAPI.on('agent:streamEnd', handleStreamEnd);
    window.electronAPI.on('agent:streamError', handleStreamError);
    window.electronAPI.on('agent:message', handleAgentMessage);

    return () => {
      window.electronAPI.removeListener('agent:streamChunk', handleStreamChunk);
      window.electronAPI.removeListener('agent:streamEnd', handleStreamEnd);
      window.electronAPI.removeListener('agent:streamError', handleStreamError);
      window.electronAPI.removeListener('agent:message', handleAgentMessage);
    };
  }, []);

  const loadInitialData = async () => {
    console.log('[DEBUG] loadInitialData - electronAPI:', window.electronAPI);
    
    // Safety timeout: force loading to end after 5 seconds if IPC hangs
    const timeout = setTimeout(() => {
      console.warn('[DEBUG] loadInitialData timed out, forcing isLoading to false');
      setIsLoading(false);
    }, 5000);

    if (!window.electronAPI) {
      console.error('[DEBUG] electronAPI not available in loadInitialData');
      clearTimeout(timeout);
      setIsLoading(false);
      return;
    }
    try {
      const [
        agentsData,
        skillsData,
        automationsData,
        providersData,
        settingsData
      ] = await Promise.all([
        window.electronAPI.agent.list(),
        window.electronAPI.skills.list(),
        window.electronAPI.automation.list(),
        window.electronAPI.providers.list(),
        window.electronAPI.settings.getAll()
      ]);

      setAgents(agentsData || []);
      setSkills(skillsData || []);
      setAutomations(automationsData || []);
      setProviders(providersData || []);
      setSettings(settingsData);

      // Optionally load worktrees for each agent's project path
      const projectPaths = [...new Set((agentsData || []).map((a: any) => a.projectPath))];
      const allWorktrees: Worktree[] = [];
      for (const path of projectPaths) {
        try {
          const ws = await window.electronAPI.worktree.list(path);
          if (ws) allWorktrees.push(...ws);
        } catch (e) {
          console.warn(`Failed to load worktrees for ${path}`, e);
        }
      }
      setWorktrees(allWorktrees);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
    }
  };

  const handleCreateAgent = async (config: any) => {
    console.log('[DEBUG] handleCreateAgent called, electronAPI:', window.electronAPI);
    if (!window.electronAPI) {
      console.error('[DEBUG] electronAPI is undefined!');
      throw new Error('Electron API not available');
    }
    try {
      const newAgent = await window.electronAPI.agent.create(config);
      setAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (error) {
      console.error('Failed to create agent:', error);
      throw error;
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await window.electronAPI.agent.delete(agentId);
      setAgents(prev => prev.filter(a => a.id !== agentId));
    } catch (error) {
      console.error('Failed to delete agent:', error);
    }
  };

  const handleCreateWorktree = async (repoPath: string, name: string) => {
    try {
      const worktree = await window.electronAPI.worktree.create(repoPath, name);
      setWorktrees(prev => [...prev, worktree]);
      return worktree;
    } catch (error) {
      console.error('Failed to create worktree:', error);
      throw error;
    }
  };

  const handleDeleteWorktree = async (worktreePath: string) => {
    try {
      await window.electronAPI.worktree.remove(worktreePath);
      setWorktrees(prev => prev.filter(w => w.path !== worktreePath));
    } catch (error) {
      console.error('Failed to delete worktree:', error);
    }
  };

  const handleCreateSkill = async (config: any) => {
    try {
      const newSkill = await window.electronAPI.skills.create(config);
      setSkills(prev => [...prev, newSkill]);
      return newSkill;
    } catch (error) {
      console.error('Failed to create skill:', error);
      throw error;
    }
  };

  const handleCreateAutomation = async (config: any) => {
    try {
      const newAutomation = await window.electronAPI.automation.create(config);
      setAutomations(prev => [...prev, newAutomation]);
      return newAutomation;
    } catch (error) {
      console.error('Failed to create automation:', error);
      throw error;
    }
  };

  const handleDeleteAutomation = async (automationId: string) => {
    try {
      await window.electronAPI.automation.delete(automationId);
      setAutomations(prev => prev.filter(a => a.id !== automationId));
    } catch (error) {
      console.error('Failed to delete automation:', error);
    }
  };

  if (isLoading) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          width: '100vw',
          background: '#0f0f0f',
          color: '#dedede'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '2px solid #333',
            borderTopColor: '#00dfc0',
            animation: 'spin 0.6s linear infinite'
          }} />
          <p>Loading Codex Linux...</p>
        </div>
      </div>
    );
  }

  try {
    return (
      <I18nProvider>
        <div 
          className="app-shell"
          style={{ height: '100vh', width: '100vw', display: 'flex', overflow: 'hidden' }}
          data-testid="app-container"
        >
          <Sidebar 
            activeTab={activeTab} 
            onTabChange={handleTabChange} 
            agents={agents}
            selectedAgentId={selectedAgent?.id}
            onSelectAgent={handleSelectAgent}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            width={sidebarWidth}
            onResize={setSidebarWidth}
          />
          
          <div className="app-main">
            {activeTab !== 'chat' && (
              <Header 
                activeTab={activeTab}
                agents={agents}
                onSettingsClick={() => handleTabChange('settings')}
              />
            )}
            
            <main 
              className={`app-content dot-grid-bg animate-fadeIn`}
              data-testid="main-content"
            >
              <Routes>
                <Route 
                  path="/" 
                  element={
                    selectedAgent ? (
                      <div className="h-full pt-6 px-4 pb-4">
                        <ChatInterface 
                          agent={selectedAgent}
                          onSendMessage={handleSendMessage}
                          onExecuteTask={handleExecuteTask}
                          onModelChange={handleModelChange}
                          providers={providers}
                        />
                      </div>
                    ) : (
                      <WelcomeChat 
                        agents={agents}
                        providers={providers}
                        skills={skills}
                        onCreateAgent={handleCreateAgent}
                        onAgentCreated={(agent, message) => handleSelectAgent(agent, message)}
                      />
                    )
                  } 
                />
                <Route 
                  path="/agents" 
                  element={
                    <AgentPanel 
                      agents={agents}
                      providers={providers}
                      skills={skills}
                      onCreateAgent={handleCreateAgent}
                      onDeleteAgent={handleDeleteAgent}
                    />
                  } 
                />
                <Route 
                  path="/code" 
                  element={
                    <CodeWorkspace rootPath="/" />
                  } 
                />
                <Route 
                  path="/worktrees" 
                  element={
                    <WorktreePanel 
                      worktrees={worktrees}
                      onCreateWorktree={handleCreateWorktree}
                      onDeleteWorktree={handleDeleteWorktree}
                    />
                  } 
                />
                <Route 
                  path="/skills" 
                  element={
                    <SkillsPanel 
                      skills={skills}
                      onCreateSkill={handleCreateSkill}
                    />
                  } 
                />
                <Route 
                  path="/automations" 
                  element={
                    <AutomationPanel 
                      automations={automations}
                      agents={agents}
                      skills={skills}
                      onCreateAutomation={handleCreateAutomation}
                      onDeleteAutomation={handleDeleteAutomation}
                    />
                  } 
                />
                <Route 
                  path="/audit" 
                  element={<AuditTrailPanel />} 
                />
                <Route 
                  path="/settings" 
                  element={
                    <SettingsPanel 
                      settings={settings!}
                      providers={providers}
                      onSettingsChange={setSettings}
                    />
                  } 
                />
              </Routes>
            </main>
          </div>
        </div>
      </I18nProvider>
    );
  } catch (error) {
    return (
      <div style={{ padding: 40, background: '#0f0f0f', color: '#e85a6a', height: '100vh' }}>
        <h1>Application Error</h1>
        <pre>{(error as Error).message}</pre>
        <button onClick={() => window.location.reload()} className="btn btn-primary mt-4">Reload</button>
      </div>
    );
  }
}
}

export default App;
