import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { WorktreePanel } from './components/WorktreePanel';
import { SkillsPanel } from './components/SkillsPanel';
import { AutomationPanel } from './components/AutomationPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { CodeWorkspace } from './components/CodeWorkspace';
import { I18nProvider } from './i18n/I18nProvider';
import { Agent, Worktree, Skill, Automation, AIProvider, Settings } from '../shared/types';
import './styles/minimalist.css';

function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [activeTab, setActiveTab] = useState('agents');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
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
      <div className="flex items-center justify-center h-screen bg-[var(--color-bg-primary)]" data-testid="app-loading">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-neutral-200 border-t-neutral-800 animate-spin" />
          </div>
          <p className="text-sm text-neutral-500 animate-pulse">Loading Codex...</p>
        </div>
      </div>
    );
  }

  return (
    <I18nProvider>
      <div className="flex h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] overflow-hidden selection:bg-neutral-900 selection:text-white" data-testid="app-container">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            activeTab={activeTab}
            agents={agents}
            onSettingsClick={() => setActiveTab('settings')}
          />
          
          <main className="flex-1 overflow-hidden animate-fadeIn" data-testid="main-content">
            <Routes>
              <Route 
                path="/" 
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