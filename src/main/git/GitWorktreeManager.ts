import * as path from 'path';
import * as fs from 'fs/promises';
import simpleGit, { SimpleGit } from 'simple-git';
import log from 'electron-log';
import { Worktree } from '../../shared/types';

export class GitWorktreeManager {
  private gitInstances: Map<string, SimpleGit> = new Map();

  async createWorktree(repoPath: string, name: string): Promise<Worktree> {
    const git = await this.getGitInstance(repoPath);
    
    // Check if it's a git repository
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new Error(`${repoPath} is not a git repository`);
    }

    // Create worktree directory
    const worktreePath = path.join(repoPath, '.codex', 'worktrees', name);
    await fs.mkdir(path.dirname(worktreePath), { recursive: true });

    // Create a new branch for this worktree
    const branchName = `codex/${name}`;
    
    try {
      // Check if branch exists
      const branches = await git.branchLocal();
      if (branches.all.includes(branchName)) {
        // Branch exists, delete it
        await git.deleteLocalBranch(branchName, true);
      }

      // Create new branch from current HEAD
      const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
      await git.checkoutBranch(branchName, currentBranch);

      // Add worktree
      await git.raw(['worktree', 'add', worktreePath, branchName]);

      log.info(`Created worktree ${name} at ${worktreePath}`);

      return {
        name,
        path: worktreePath,
        commit: await git.revparse(['HEAD']),
        branch: branchName,
        isMain: false,
        agents: [],
        createdAt: new Date()
      };
    } catch (error) {
      // Cleanup on failure
      try {
        await fs.rmdir(worktreePath, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  async listWorktrees(repoPath: string): Promise<Worktree[]> {
    const git = await this.getGitInstance(repoPath);
    
    try {
      const worktreeOutput = await git.raw(['worktree', 'list', '--porcelain']);
      const worktrees: Worktree[] = [];
      
      const entries = worktreeOutput.split('\n\n').filter(Boolean);
      
      for (const entry of entries) {
        const lines = entry.split('\n');
        const worktree: Partial<Worktree> = {
          isMain: false,
          agents: [],
          createdAt: new Date()
        };

        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            worktree.path = line.substring(9);
          } else if (line.startsWith('HEAD ')) {
            worktree.commit = line.substring(5);
          } else if (line.startsWith('branch ')) {
            worktree.branch = line.substring(7).replace('refs/heads/', '');
          } else if (line === 'bare') {
            continue;
          }
        }

        if (worktree.path) {
          // Extract name from path
          worktree.name = path.basename(worktree.path);
          
          // Check if it's the main worktree
          const mainWorktreePath = await git.revparse(['--show-toplevel']);
          worktree.isMain = worktree.path === mainWorktreePath;

          worktrees.push(worktree as Worktree);
        }
      }

      return worktrees;
    } catch (error) {
      log.error('Failed to list worktrees:', error);
      return [];
    }
  }

  async removeWorktree(repoPath: string, name: string): Promise<void> {
    const git = await this.getGitInstance(repoPath);
    
    const worktreePath = path.join(repoPath, '.codex', 'worktrees', name);
    const branchName = `codex/${name}`;

    try {
      // Remove worktree
      await git.raw(['worktree', 'remove', '--force', worktreePath]);
      
      // Delete branch
      try {
        await git.deleteLocalBranch(branchName, true);
      } catch (branchError) {
        log.warn(`Failed to delete branch ${branchName}:`, branchError);
      }

      // Clean up directory
      await fs.rmdir(worktreePath, { recursive: true }).catch(() => {});

      log.info(`Removed worktree ${name}`);
    } catch (error) {
      log.error(`Failed to remove worktree ${name}:`, error);
      throw error;
    }
  }

  async getChanges(worktreePath: string): Promise<{ staged: string[]; unstaged: string[] }> {
    const git = simpleGit(worktreePath);
    
    const status = await git.status();
    
    return {
      staged: status.staged,
      unstaged: [...status.not_added, ...status.modified, ...status.deleted]
    };
  }

  async commitChanges(
    worktreePath: string,
    message: string,
    files?: string[]
  ): Promise<string> {
    const git = simpleGit(worktreePath);
    
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }

    const result = await git.commit(message);
    return result.commit;
  }

  async getDiff(worktreePath: string, filePath?: string): Promise<string> {
    const git = simpleGit(worktreePath);
    
    if (filePath) {
      return await git.diff(['--', filePath]);
    }
    
    return await git.diff();
  }

  async mergeWorktree(
    repoPath: string,
    worktreeName: string,
    targetBranch: string = 'main'
  ): Promise<void> {
    const git = await this.getGitInstance(repoPath);
    const worktreePath = path.join(repoPath, '.codex', 'worktrees', worktreeName);
    const branchName = `codex/${worktreeName}`;

    // Checkout target branch
    await git.checkout(targetBranch);
    
    // Merge the worktree branch
    try {
      await git.merge([branchName, '--no-ff', '-m', `Merge ${branchName}`]);
      log.info(`Merged ${branchName} into ${targetBranch}`);
    } catch (error) {
      // Merge conflict
      log.error(`Merge conflict when merging ${branchName}:`, error);
      throw new Error(`Merge conflict. Please resolve manually.`);
    }
  }

  private async getGitInstance(repoPath: string): Promise<SimpleGit> {
    if (!this.gitInstances.has(repoPath)) {
      const git = simpleGit(repoPath);
      this.gitInstances.set(repoPath, git);
    }
    return this.gitInstances.get(repoPath)!;
  }

  async cleanup(): Promise<void> {
    this.gitInstances.clear();
    log.info('GitWorktreeManager cleanup completed');
  }
}