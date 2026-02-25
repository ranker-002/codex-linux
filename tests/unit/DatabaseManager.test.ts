import { DatabaseManager } from '../../src/main/DatabaseManager';
import Database from 'better-sqlite3';
import { AgentStatus, ChangeStatus, TaskStatus } from '../../src/shared/types';

jest.mock('better-sqlite3');

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let mockDb: any;
  let mockSelectChangeGet: jest.Mock;
  let mockSelectAgentGet: jest.Mock;
  let mockSelectCheckpointGet: jest.Mock;
  let mockSelectLastCheckpointGet: jest.Mock;
  let mockUpdateRun: jest.Mock;
  let mockUpdateCheckpointRun: jest.Mock;

  beforeEach(() => {
    mockSelectChangeGet = jest.fn();
    mockSelectAgentGet = jest.fn();
    mockSelectCheckpointGet = jest.fn();
    mockSelectLastCheckpointGet = jest.fn();
    mockUpdateRun = jest.fn();
    mockUpdateCheckpointRun = jest.fn();

    mockDb = {
      pragma: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn(),
      close: jest.fn(),
    };
    (Database as unknown as jest.Mock).mockReturnValue(mockDb);
    dbManager = new DatabaseManager();

    mockDb.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith('SELECT * FROM code_changes WHERE id')) {
        return { get: mockSelectChangeGet };
      }
      if (sql.startsWith('SELECT * FROM agents WHERE id')) {
        return { get: mockSelectAgentGet };
      }
      if (sql.startsWith('SELECT * FROM checkpoints WHERE id')) {
        return { get: mockSelectCheckpointGet };
      }
      if (sql.startsWith('SELECT * FROM checkpoints WHERE agent_id')) {
        return { get: mockSelectLastCheckpointGet };
      }
      if (sql.startsWith('UPDATE code_changes SET status')) {
        return { run: mockUpdateRun };
      }
      if (sql.startsWith('UPDATE checkpoints SET restored_at')) {
        return { run: mockUpdateCheckpointRun };
      }
      return {
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      };
    });
  });

  describe('initialize', () => {
    it('should create database and tables', async () => {
      await dbManager.initialize();

      expect(Database).toHaveBeenCalled();
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDb.exec).toHaveBeenCalledTimes(10);
    });
  });

  describe('createAgent', () => {
    it('should insert agent into database', async () => {
      await dbManager.initialize();

      const agent = {
        id: 'agent-1',
        name: 'Test Agent',
        status: AgentStatus.IDLE,
        projectPath: '/test',
        worktreeName: 'worktree-1',
        providerId: 'openai',
        model: 'gpt-4o',
        skills: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActiveAt: null,
        metadata: {},
      };

      await dbManager.createAgent(agent as any);

      const stmt = mockDb.prepare.mock.results[0].value;
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  describe('getCodeChanges', () => {
    it('should return changes for specific agent', async () => {
      await dbManager.initialize();

      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([
          {
            id: 'change-1',
            file_path: 'test.ts',
            status: ChangeStatus.PENDING,
            created_at: Date.now(),
          },
        ]),
      });

      const changes = await dbManager.getCodeChanges('agent-1');

      expect(changes).toHaveLength(1);
      expect(changes[0].filePath).toBe('test.ts');
    });

    it('should return all changes if no agentId specified', async () => {
      await dbManager.initialize();

      mockDb.prepare.mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });

      await dbManager.getCodeChanges();

      const prepareCall = mockDb.prepare.mock.calls.find(
        (call: any[]) => call[0].includes('SELECT * FROM code_changes')
      );
      expect(prepareCall).toBeDefined();
    });
  });

  describe('approveCodeChange', () => {
    it('should update change status to approved', async () => {
      await dbManager.initialize();

      await dbManager.approveCodeChange('change-1');

      const approvePrepareIndex = mockDb.prepare.mock.calls.findIndex(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE code_changes') && call[0].includes('reviewed_at')
      );
      expect(approvePrepareIndex).toBeGreaterThanOrEqual(0);

      const stmt = mockDb.prepare.mock.results[approvePrepareIndex].value;
      expect(stmt.run).toHaveBeenCalledWith(
        ChangeStatus.APPROVED,
        expect.any(Number),
        'user',
        'change-1'
      );
    });
  });

  describe('rejectCodeChange', () => {
    it('should update change status to rejected with comment', async () => {
      await dbManager.initialize();

      await dbManager.rejectCodeChange('change-1', 'Needs improvement');

      const rejectPrepareIndex = mockDb.prepare.mock.calls.findIndex(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('UPDATE code_changes') && call[0].includes('comment')
      );
      expect(rejectPrepareIndex).toBeGreaterThanOrEqual(0);

      const stmt = mockDb.prepare.mock.results[rejectPrepareIndex].value;
      expect(stmt.run).toHaveBeenCalledWith(
        ChangeStatus.REJECTED,
        expect.any(Number),
        'user',
        'Needs improvement',
        'change-1'
      );
    });
  });

  describe('applyCodeChange', () => {
    it('should throw if change is not approved', async () => {
      await dbManager.initialize();

      mockSelectChangeGet.mockReturnValue({
        id: 'change-1',
        agent_id: 'agent-1',
        file_path: 'src/a.ts',
        new_content: 'x',
        status: ChangeStatus.PENDING
      });

      await expect(dbManager.applyCodeChange('change-1')).rejects.toThrow('must be approved');
    });

    it('should write file to worktree and mark as applied when approved', async () => {
      await dbManager.initialize();

      const fs = require('fs');
      jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
      jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('missing'));

      mockSelectChangeGet.mockReturnValue({
        id: 'change-1',
        agent_id: 'agent-1',
        file_path: 'src/a.ts',
        new_content: 'new',
        status: ChangeStatus.APPROVED
      });

      mockSelectAgentGet.mockReturnValue({
        id: 'agent-1',
        metadata: JSON.stringify({ worktreePath: '/tmp/worktree' })
      });

      await dbManager.applyCodeChange('change-1');

      expect(fs.promises.mkdir).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/worktree'),
        'new',
        'utf-8'
      );
      expect(mockUpdateRun).toHaveBeenCalledWith(ChangeStatus.APPLIED, 'change-1');
    });
  });

  describe('restoreLastCheckpoint', () => {
    it('should restore last non-restored checkpoint for agent', async () => {
      await dbManager.initialize();

      const fs = require('fs');
      jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
      jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

      mockSelectLastCheckpointGet.mockReturnValue({
        id: 'cp-1',
        agent_id: 'agent-1',
        file_path: 'src/a.ts',
        content: 'old'
      });

      mockSelectCheckpointGet.mockReturnValue({
        id: 'cp-1',
        agent_id: 'agent-1',
        file_path: 'src/a.ts',
        content: 'old'
      });

      mockSelectAgentGet.mockReturnValue({
        id: 'agent-1',
        metadata: JSON.stringify({ worktreePath: '/tmp/worktree' })
      });

      await dbManager.restoreLastCheckpoint('agent-1');

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('/tmp/worktree'),
        'old',
        'utf-8'
      );
      expect(mockUpdateCheckpointRun).toHaveBeenCalled();
    });
  });
});