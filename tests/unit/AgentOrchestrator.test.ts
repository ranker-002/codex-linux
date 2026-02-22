import { AgentOrchestrator } from '../../src/main/agents/AgentOrchestrator';
import { AIProviderManager } from '../../src/main/providers/AIProviderManager';
import { GitWorktreeManager } from '../../src/main/git/GitWorktreeManager';
import { SkillsManager } from '../../src/main/skills/SkillsManager';
import { DatabaseManager } from '../../src/main/DatabaseManager';
import { SettingsManager } from '../../src/main/SettingsManager';
import { AgentStatus, TaskStatus } from '../../src/shared/types';

describe('AgentOrchestrator', () => {
  let orchestrator: AgentOrchestrator;
  let mockAIProviderManager: jest.Mocked<AIProviderManager>;
  let mockGitWorktreeManager: jest.Mocked<GitWorktreeManager>;
  let mockSkillsManager: jest.Mocked<SkillsManager>;
  let mockDbManager: jest.Mocked<DatabaseManager>;
  let mockSettingsManager: jest.Mocked<SettingsManager>;

  beforeEach(() => {
    mockAIProviderManager = {
      getProvider: jest.fn(),
    } as any;

    mockGitWorktreeManager = {
      createWorktree: jest.fn(),
      removeWorktree: jest.fn(),
    } as any;

    mockSkillsManager = {
      getSkill: jest.fn(),
    } as any;

    mockDbManager = {
      getAllAgents: jest.fn().mockResolvedValue([]),
      createAgent: jest.fn().mockResolvedValue(undefined),
      updateAgent: jest.fn().mockResolvedValue(undefined),
      deleteAgent: jest.fn().mockResolvedValue(undefined),
      getAgent: jest.fn(),
    } as any;

    mockSettingsManager = {} as any;

    orchestrator = new AgentOrchestrator(
      mockAIProviderManager,
      mockGitWorktreeManager,
      mockSkillsManager,
      mockDbManager
    );
  });

  describe('createAgent', () => {
    it('should create a new agent with worktree', async () => {
      const config = {
        name: 'Test Agent',
        projectPath: '/test/project',
        providerId: 'openai',
        model: 'gpt-4o',
      };

      mockGitWorktreeManager.createWorktree.mockResolvedValue({
        name: 'codex-agent-test123',
        path: '/test/project/.codex/worktrees/codex-agent-test123',
        commit: 'abc123',
        branch: 'codex/codex-agent-test123',
        isMain: false,
        agents: [],
        createdAt: new Date(),
      });

      const agent = await orchestrator.createAgent(config);

      expect(agent).toBeDefined();
      expect(agent.name).toBe(config.name);
      expect(agent.status).toBe(AgentStatus.IDLE);
      expect(agent.worktreeName).toContain('codex-agent-');
      expect(mockGitWorktreeManager.createWorktree).toHaveBeenCalledWith(
        config.projectPath,
        expect.stringContaining('codex-agent-')
      );
      expect(mockDbManager.createAgent).toHaveBeenCalled();
    });

    it('should apply skills when creating agent', async () => {
      const config = {
        name: 'Test Agent',
        projectPath: '/test/project',
        providerId: 'openai',
        model: 'gpt-4o',
        skills: ['skill-1', 'skill-2'],
      };

      mockGitWorktreeManager.createWorktree.mockResolvedValue({
        name: 'codex-agent-test',
        path: '/test/project/.codex/worktrees/codex-agent-test',
        commit: 'abc123',
        branch: 'codex/codex-agent-test',
        isMain: false,
        agents: [],
        createdAt: new Date(),
      });

      mockSkillsManager.getSkill.mockResolvedValue({
        id: 'skill-1',
        name: 'Test Skill',
        files: [{ path: 'instructions.md', content: 'Test instructions', type: 'instruction' }],
      } as any);

      const agent = await orchestrator.createAgent(config);

      expect(agent.skills).toEqual(config.skills);
      expect(mockSkillsManager.getSkill).toHaveBeenCalledTimes(2);
    });

    it('should throw error if project path is invalid', async () => {
      const config = {
        name: 'Test Agent',
        projectPath: '',
        providerId: 'openai',
        model: 'gpt-4o',
      };

      mockGitWorktreeManager.createWorktree.mockRejectedValue(
        new Error('Invalid project path')
      );

      await expect(orchestrator.createAgent(config)).rejects.toThrow('Invalid project path');
    });
  });

  describe('sendMessage', () => {
    it('should send message and receive response', async () => {
      const mockProvider = {
        sendMessage: jest.fn().mockResolvedValue({
          content: 'Test response',
          metadata: { usage: { total_tokens: 100 } },
        }),
      };

      mockAIProviderManager.getProvider.mockReturnValue(mockProvider as any);
      mockDbManager.getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.IDLE,
        messages: [],
        providerId: 'openai',
        model: 'gpt-4o',
      } as any);

      const response = await orchestrator.sendMessage('agent-1', 'Hello');

      expect(response.content).toBe('Test response');
      expect(mockProvider.sendMessage).toHaveBeenCalled();
      expect(mockDbManager.updateAgent).toHaveBeenCalled();
    });

    it('should throw error if agent not found', async () => {
      mockDbManager.getAgent.mockResolvedValue(null);

      await expect(orchestrator.sendMessage('non-existent', 'Hello')).rejects.toThrow(
        'Agent non-existent not found'
      );
    });
  });

  describe('executeTask', () => {
    it('should create and execute a task', async () => {
      const mockProvider = {
        sendMessage: jest.fn().mockResolvedValue({
          content: 'Task completed',
          metadata: {},
        }),
      };

      mockAIProviderManager.getProvider.mockReturnValue(mockProvider as any);
      mockDbManager.getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.IDLE,
        messages: [],
        tasks: [],
        providerId: 'openai',
        model: 'gpt-4o',
        projectPath: '/test',
        worktreeName: 'test-worktree',
      } as any);

      const task = await orchestrator.executeTask('agent-1', 'Refactor code');

      expect(task.description).toBe('Refactor code');
      expect(task.status).toBe(TaskStatus.RUNNING);
    });
  });

  describe('pause/resume/stop', () => {
    beforeEach(async () => {
      mockDbManager.getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.RUNNING,
        messages: [],
        tasks: [],
      } as any);
    });

    it('should pause running agent', async () => {
      await orchestrator.pauseAgent('agent-1');

      expect(mockDbManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: AgentStatus.PAUSED })
      );
    });

    it('should resume paused agent', async () => {
      await orchestrator.resumeAgent('agent-1');

      expect(mockDbManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: AgentStatus.IDLE })
      );
    });

    it('should stop agent and cleanup', async () => {
      await orchestrator.stopAgent('agent-1');

      expect(mockDbManager.updateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: AgentStatus.IDLE })
      );
    });
  });

  describe('deleteAgent', () => {
    it('should delete agent and cleanup worktree', async () => {
      mockDbManager.getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        projectPath: '/test/project',
        worktreeName: 'codex-agent-test',
      } as any);

      await orchestrator.deleteAgent('agent-1');

      expect(mockGitWorktreeManager.removeWorktree).toHaveBeenCalledWith(
        '/test/project',
        'codex-agent-test'
      );
      expect(mockDbManager.deleteAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  describe('applySkills', () => {
    it('should apply skills to agent', async () => {
      mockDbManager.getAgent.mockResolvedValue({
        id: 'agent-1',
        name: 'Test Agent',
        skills: [],
        messages: [],
      } as any);

      mockSkillsManager.getSkill.mockResolvedValue({
        id: 'skill-1',
        name: 'Code Review',
        files: [
          {
            path: 'instructions.md',
            content: 'Review code for quality',
            type: 'instruction',
          },
        ],
      } as any);

      await orchestrator.applySkills('agent-1', ['skill-1']);

      expect(mockSkillsManager.getSkill).toHaveBeenCalledWith('skill-1');
      expect(mockDbManager.updateAgent).toHaveBeenCalled();
    });
  });
});