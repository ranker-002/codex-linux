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
import { I18nProvider } from './i18n/I18nProvider';
import { Agent, Worktree, Skill, Automation, AIProvider, Settings } from '../shared/types';
import './styles/design-system.css';

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

    window.electronAPI.on('agent:streamChunk', handleStreamChunk);
    window.electronAPI.on('agent:streamEnd', handleStreamEnd);
    window.electronAPI.on('agent:streamError', handleStreamError);

    return () => {
      window.electronAPI.removeListener('agent:streamChunk', handleStreamChunk);
      window.electronAPI.removeListener('agent:streamEnd', handleStreamEnd);
      window.electronAPI.removeListener('agent:streamError', handleStreamError);
    };
  }, []);

  const loadInitialData = async () => {
    if (!window.electronAPI) {
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

      setAgents(agentsData);
      setSkills(skillsData);
      setAutomations(automationsData);
      setProviders(providersData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAgent = async (config: any) => {
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

  if (isLoading) {
    return (
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--bg-void)'
        }}
        data-testid="app-loading"
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2px solid var(--border-default)',
              borderTopColor: 'var(--teal-500)',
              animation: 'spin 0.6s linear infinite'
            }} />
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', animation: 'pulse 2s ease-in-out infinite' }}>Loading Codex...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nProvider>
      <div 
        className="app-shell"
        data-testid="app-container"
      >
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        
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
                  <WelcomeChat 
                    agents={agents}
                    providers={providers}
                    skills={skills}
                    onCreateAgent={handleCreateAgent}
                  />
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
}

export default App;
