import { DatabaseManager } from '../../src/main/DatabaseManager';
import Database from 'better-sqlite3';
import { AgentStatus, ChangeStatus, TaskStatus } from '../../src/shared/types';

jest.mock('better-sqlite3');

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      pragma: jest.fn(),
      exec: jest.fn(),
      prepare: jest.fn().mockReturnValue({
        run: jest.fn(),
        all: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      }),
      close: jest.fn(),
    };
    (Database as unknown as jest.Mock).mockReturnValue(mockDb);
    dbManager = new DatabaseManager();
  });

  describe('initialize', () => {
    it('should create database and tables', async () => {
      await dbManager.initialize();

      expect(Database).toHaveBeenCalled();
      expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockDb.exec).toHaveBeenCalledTimes(6); // 6 tables created
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
        call => call[0].includes('SELECT * FROM code_changes')
      );
      expect(prepareCall).toBeDefined();
    });
  });

  describe('approveCodeChange', () => {
    it('should update change status to approved', async () => {
      await dbManager.initialize();

      await dbManager.approveCodeChange('change-1');

      const stmt = mockDb.prepare.mock.results.find(
        (result: any) => result.value && result.value.run
      )?.value;
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

      const stmt = mockDb.prepare.mock.results.find(
        (result: any) => result.value && result.value.run
      )?.value;
      expect(stmt.run).toHaveBeenCalledWith(
        ChangeStatus.REJECTED,
        expect.any(Number),
        'user',
        'Needs improvement',
        'change-1'
      );
    });
  });
});