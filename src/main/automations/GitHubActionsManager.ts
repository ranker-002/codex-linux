import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch from 'node-fetch';
import { CICDConfig, WorkflowRun, CIAction } from '../../shared/types';

export class GitHubActionsManager extends EventEmitter {
  private config: CICDConfig;
  private token: string | null = null;
  private owner: string | null = null;
  private repo: string | null = null;

  constructor() {
    super();
    this.config = {
      provider: 'github',
      enabled: false,
    };
  }

  async configure(config: Partial<CICDConfig> & { token: string; owner: string; repo: string }): Promise<void> {
    this.config = { ...this.config, ...config };
    this.token = config.token;
    this.owner = config.owner;
    this.repo = config.repo;
    this.config.enabled = true;
    log.info('GitHub Actions configured', { owner: this.owner, repo: this.repo });
  }

  async runWorkflow(workflowId: string, ref: string = 'main', inputs?: Record<string, string>): Promise<WorkflowRun> {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub Actions not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref,
          inputs: inputs || {},
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to trigger workflow: ${response.statusText}`);
    }

    const run: WorkflowRun = {
      id: `run_${Date.now()}`,
      workflowId,
      status: 'queued',
      startedAt: new Date(),
      url: `https://github.com/${this.owner}/${this.repo}/actions`,
    };

    this.emit('workflow:started', run);
    return run;
  }

  async getWorkflowRuns(workflowId?: string, status?: string): Promise<WorkflowRun[]> {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub Actions not configured');
    }

    let url = `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs`;
    const params = new URLSearchParams();
    if (workflowId) params.append('workflow_id', workflowId);
    if (status) params.append('status', status);
    if (params.toString()) url += `?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get workflow runs: ${response.statusText}`);
    }

    const data = await response.json() as any;
    return (data.workflow_runs || []).map((run: any) => ({
      id: String(run.id),
      workflowId: String(run.workflow_id),
      status: run.status,
      conclusion: run.conclusion,
      startedAt: new Date(run.created_at),
      completedAt: run.completed_at ? new Date(run.completed_at) : undefined,
      url: run.html_url,
    }));
  }

  async cancelRun(runId: string): Promise<void> {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub Actions not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${runId}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to cancel run: ${response.statusText}`);
    }

    this.emit('run:cancelled', runId);
  }

  async getRunLogs(runId: string): Promise<string> {
    if (!this.token || !this.owner || !this.repo) {
      throw new Error('GitHub Actions not configured');
    }

    const response = await fetch(
      `https://api.github.com/repos/${this.owner}/${this.repo}/actions/runs/${runId}/logs`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get logs: ${response.statusText}`);
    }

    // Returns a redirect URL to download logs
    return response.url;
  }

  getConfig(): CICDConfig {
    return { ...this.config };
  }
}

export default GitHubActionsManager;
