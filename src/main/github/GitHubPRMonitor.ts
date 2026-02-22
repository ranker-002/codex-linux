import { Octokit } from '@octokit/rest';
import { EventEmitter } from 'events';
import log from 'electron-log';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { GitWorktreeManager } from '../git/GitWorktreeManager';
import { NotificationManager } from '../notifications/NotificationManager';

interface PRMonitor {
  id: string;
  owner: string;
  repo: string;
  pullNumber: number;
  status: 'monitoring' | 'fixing' | 'merged' | 'failed';
  autoMerge: boolean;
  autoFix: boolean;
  lastCheck: Date;
  checks: PRCheck[];
}

interface PRCheck {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}

export class GitHubPRMonitor extends EventEmitter {
  private octokit: Octokit;
  private monitors: Map<string, PRMonitor> = new Map();
  private agentOrchestrator: AgentOrchestrator;
  private gitManager: GitWorktreeManager;
  private notificationManager: NotificationManager;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    token: string,
    agentOrchestrator: AgentOrchestrator,
    gitManager: GitWorktreeManager,
    notificationManager: NotificationManager
  ) {
    super();
    this.octokit = new Octokit({ auth: token });
    this.agentOrchestrator = agentOrchestrator;
    this.gitManager = gitManager;
    this.notificationManager = notificationManager;
  }

  async initialize(): Promise<void> {
    // Start monitoring loop
    this.checkInterval = setInterval(() => this.checkAllPRs(), 60000); // Every minute
    log.info('GitHub PR Monitor initialized');
  }

  async monitorPR(
    owner: string,
    repo: string,
    pullNumber: number,
    options: {
      autoMerge?: boolean;
      autoFix?: boolean;
    } = {}
  ): Promise<PRMonitor> {
    const monitorId = `${owner}/${repo}#${pullNumber}`;
    
    const monitor: PRMonitor = {
      id: monitorId,
      owner,
      repo,
      pullNumber,
      status: 'monitoring',
      autoMerge: options.autoMerge ?? false,
      autoFix: options.autoFix ?? true,
      lastCheck: new Date(),
      checks: [],
    };

    this.monitors.set(monitorId, monitor);
    
    // Initial check
    await this.checkPR(monitor);
    
    this.emit('pr:monitoring', monitor);
    log.info(`Started monitoring PR: ${monitorId}`);
    
    return monitor;
  }

  private async checkAllPRs(): Promise<void> {
    for (const monitor of this.monitors.values()) {
      if (monitor.status === 'monitoring') {
        await this.checkPR(monitor);
      }
    }
  }

  private async checkPR(monitor: PRMonitor): Promise<void> {
    try {
      // Get PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner: monitor.owner,
        repo: monitor.repo,
        pull_number: monitor.pullNumber,
      });

      // Get check runs
      const { data: checkRuns } = await this.octokit.checks.listForRef({
        owner: monitor.owner,
        repo: monitor.repo,
        ref: pr.head.sha,
      });

      monitor.checks = checkRuns.check_runs.map(run => ({
        name: run.name,
        status: run.status as PRCheck['status'],
        conclusion: run.conclusion as PRCheck['conclusion'],
      }));

      monitor.lastCheck = new Date();

      // Check if all checks completed
      const allCompleted = monitor.checks.every(c => c.status === 'completed');
      
      if (allCompleted) {
        const failedChecks = monitor.checks.filter(
          c => c.conclusion === 'failure' || c.conclusion === 'timed_out'
        );

        if (failedChecks.length > 0) {
          // Checks failed
          if (monitor.autoFix) {
            await this.attemptFix(monitor, failedChecks);
          } else {
            this.notificationManager.show({
              title: 'PR Checks Failed',
              body: `${monitor.id}: ${failedChecks.length} check(s) failed`,
            });
            this.emit('pr:failed', { monitor, failedChecks });
          }
        } else {
          // All checks passed
          if (monitor.autoMerge) {
            await this.mergePR(monitor);
          } else {
            this.notificationManager.show({
              title: 'PR Ready to Merge',
              body: `${monitor.id}: All checks passed`,
            });
            this.emit('pr:ready', monitor);
          }
        }
      }

      this.emit('pr:updated', monitor);
    } catch (error) {
      log.error(`Failed to check PR ${monitor.id}:`, error);
    }
  }

  private async attemptFix(monitor: PRMonitor, failedChecks: PRCheck[]): Promise<void> {
    monitor.status = 'fixing';
    this.emit('pr:fixing', monitor);

    this.notificationManager.show({
      title: 'Attempting to Fix PR',
      body: `${monitor.id}: Analyzing ${failedChecks.length} failed check(s)`,
    });

    try {
      // Get PR files
      const { data: files } = await this.octokit.pulls.listFiles({
        owner: monitor.owner,
        repo: monitor.repo,
        pull_number: monitor.pullNumber,
      });

      // Clone or use existing worktree
      const worktreePath = `/tmp/pr-fix-${monitor.pullNumber}`;
      
      // Get check logs for context
      const checkLogs = await Promise.all(
        failedChecks.map(async check => {
          const { data: run } = await this.octokit.checks.get({
            owner: monitor.owner,
            repo: monitor.repo,
            check_run_id: parseInt(check.name), // This would need proper ID
          });
          return run.output?.summary || 'No logs available';
        })
      );

      // Create agent to fix issues
      const agent = await this.agentOrchestrator.createAgent({
        name: `PR Fix: ${monitor.id}`,
        projectPath: worktreePath,
        providerId: 'openai',
        model: 'gpt-4o',
        skills: ['refactoring', 'testing', 'debugging'],
      });

      // Analyze failures and fix
      const fixTask = await this.agentOrchestrator.executeTask(
        agent.id,
        `Fix the failing checks for this PR. Failed checks: ${failedChecks.map(c => c.name).join(', ')}.
         
Check logs:
${checkLogs.join('\n\n')}

Files modified in PR:
${files.map(f => `- ${f.filename}: ${f.status}`).join('\n')}

Analyze the failures, identify the root causes, and implement fixes. Run tests to verify the fixes work.`
      );

      // Wait for fix (with timeout)
      await this.waitForTask(agent.id, fixTask.id, 10 * 60 * 1000); // 10 min timeout

      // Commit and push fixes
      await this.gitManager.commitChanges(
        worktreePath,
        `Fix: Resolve ${failedChecks.length} failing check(s)\n\nAuto-fixed by Codex Linux`,
        files.map(f => f.filename)
      );

      // Push to PR branch
      // This would need implementation

      monitor.status = 'monitoring';
      this.notificationManager.show({
        title: 'PR Fix Applied',
        body: `${monitor.id}: Fixes committed, waiting for new checks`,
      });

      this.emit('pr:fixed', monitor);

    } catch (error) {
      monitor.status = 'failed';
      log.error(`Failed to fix PR ${monitor.id}:`, error);
      
      this.notificationManager.show({
        title: 'PR Fix Failed',
        body: `${monitor.id}: Could not automatically fix the issues`,
      });
      
      this.emit('pr:fix-failed', { monitor, error });
    }
  }

  private async mergePR(monitor: PRMonitor): Promise<void> {
    try {
      await this.octokit.pulls.merge({
        owner: monitor.owner,
        repo: monitor.repo,
        pull_number: monitor.pullNumber,
        merge_method: 'squash',
      });

      monitor.status = 'merged';
      this.monitors.delete(monitor.id);

      this.notificationManager.show({
        title: 'PR Merged Successfully',
        body: `${monitor.id} has been merged`,
      });

      this.emit('pr:merged', monitor);
      log.info(`Merged PR: ${monitor.id}`);
    } catch (error) {
      log.error(`Failed to merge PR ${monitor.id}:`, error);
      throw error;
    }
  }

  private waitForTask(agentId: string, taskId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkInterval = setInterval(async () => {
        if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Fix timeout'));
          return;
        }

        try {
          const agent = await this.agentOrchestrator.getAgent(agentId);
          const task = agent?.tasks.find(t => t.id === taskId);
          
          if (task?.status === 'completed') {
            clearInterval(checkInterval);
            resolve();
          } else if (task?.status === 'failed') {
            clearInterval(checkInterval);
            reject(new Error(task.error || 'Task failed'));
          }
        } catch (error) {
          clearInterval(checkInterval);
          reject(error);
        }
      }, 2000);
    });
  }

  stopMonitoring(monitorId: string): void {
    this.monitors.delete(monitorId);
    log.info(`Stopped monitoring PR: ${monitorId}`);
  }

  getMonitors(): PRMonitor[] {
    return Array.from(this.monitors.values());
  }

  async cleanup(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.monitors.clear();
  }
}