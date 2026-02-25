import { GitWorktreeManager } from '../../src/main/git/GitWorktreeManager';
import simpleGit from 'simple-git';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  rmdir: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('simple-git');

describe('GitWorktreeManager', () => {
  let manager: GitWorktreeManager;
  let mockGit: any;

  beforeEach(() => {
    manager = new GitWorktreeManager();
    mockGit = {
      checkIsRepo: jest.fn().mockResolvedValue(true),
      branchLocal: jest.fn().mockResolvedValue({ all: [] }),
      checkoutBranch: jest.fn().mockResolvedValue(undefined),
      deleteLocalBranch: jest.fn().mockResolvedValue(undefined),
      revparse: jest.fn().mockImplementation(async (args: string[]) => {
        if (Array.isArray(args) && args.includes('--show-toplevel')) return '/repo';
        if (Array.isArray(args) && args.includes('--abbrev-ref')) return 'main';
        return 'abc123';
      }),
      raw: jest.fn().mockResolvedValue(''),
      status: jest.fn().mockResolvedValue({
        staged: [],
        not_added: [],
        modified: [],
        deleted: [],
      }),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue({ commit: 'def456' }),
      diff: jest.fn().mockResolvedValue('diff content'),
    };
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  describe('createWorktree', () => {
    it('should create worktree with new branch', async () => {
      const worktree = await manager.createWorktree('/repo', 'test-worktree');

      expect(worktree).toBeDefined();
      expect(worktree.name).toBe('test-worktree');
      expect(worktree.branch).toBe('codex/test-worktree');
      expect(mockGit.checkoutBranch).toHaveBeenCalledWith(
        'codex/test-worktree',
        'main'
      );
    });

    it('should delete existing branch if it exists', async () => {
      mockGit.branchLocal.mockResolvedValue({
        all: ['codex/test-worktree'],
      });

      await manager.createWorktree('/repo', 'test-worktree');

      expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith(
        'codex/test-worktree',
        true
      );
    });

    it('should throw error if not a git repo', async () => {
      mockGit.checkIsRepo.mockResolvedValue(false);

      await expect(manager.createWorktree('/not-a-repo', 'test')).rejects.toThrow(
        'not a git repository'
      );
    });
  });

  describe('listWorktrees', () => {
    it('should parse worktree list output', async () => {
      mockGit.raw.mockResolvedValue(
        'worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\n' +
        'worktree /repo/.codex/worktrees/test\nHEAD def456\nbranch refs/heads/codex/test'
      );

      const worktrees = await manager.listWorktrees('/repo');

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0].isMain).toBe(true);
      expect(worktrees[1].branch).toBe('codex/test');
    });

    it('should return empty array on error', async () => {
      mockGit.raw.mockRejectedValue(new Error('Git error'));

      const worktrees = await manager.listWorktrees('/repo');

      expect(worktrees).toEqual([]);
    });
  });

  describe('removeWorktree', () => {
    it('should remove worktree and delete branch', async () => {
      await manager.removeWorktree('/repo', 'test-worktree');

      expect(mockGit.raw).toHaveBeenCalledWith([
        'worktree',
        'remove',
        '--force',
        expect.stringContaining('test-worktree'),
      ]);
      expect(mockGit.deleteLocalBranch).toHaveBeenCalledWith(
        'codex/test-worktree',
        true
      );
    });
  });

  describe('commitChanges', () => {
    it('should stage all files and commit', async () => {
      const commitHash = await manager.commitChanges(
        '/repo',
        'Test commit message'
      );

      expect(mockGit.add).toHaveBeenCalledWith('.');
      expect(mockGit.commit).toHaveBeenCalledWith('Test commit message');
      expect(commitHash).toBe('def456');
    });

    it('should stage specific files if provided', async () => {
      await manager.commitChanges('/repo', 'Test commit', ['file1.ts', 'file2.ts']);

      expect(mockGit.add).toHaveBeenCalledWith(['file1.ts', 'file2.ts']);
    });
  });

  describe('getChanges', () => {
    it('should return staged and unstaged files', async () => {
      mockGit.status.mockResolvedValue({
        staged: ['staged-file.ts'],
        not_added: ['new-file.ts'],
        modified: ['modified-file.ts'],
        deleted: ['deleted-file.ts'],
      });

      const changes = await manager.getChanges('/repo');

      expect(changes.staged).toEqual(['staged-file.ts']);
      expect(changes.unstaged).toEqual(['new-file.ts', 'modified-file.ts', 'deleted-file.ts']);
    });
  });
});