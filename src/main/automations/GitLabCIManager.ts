import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch, { RequestInit } from 'node-fetch';

export interface GitLabCIConfig {
  url: string;
  token: string;
  projectId: string;
  defaultBranch: string;
}

export interface GitLabPipeline {
  id: number;
  status: 'created' | 'waiting_for_resource' | 'preparing' | 'pending' | 'running' | 'success' | 'failed' | 'canceled' | 'skipped' | 'manual' | 'scheduled';
  ref: string;
  sha: string;
  webUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitLabJob {
  id: number;
  name: string;
  status: string;
  stage: string;
  pipeline: { id: number };
  webUrl: string;
  artifacts?: { size: number };
}

export class GitLabCIManager extends EventEmitter {
  private config: GitLabCIConfig | null = null;

  constructor() {
    super();
  }

  async configure(config: GitLabCIConfig): Promise<void> {
    this.config = config;
    log.info('GitLab CI configured', { project: config.projectId, url: config.url });
  }

  private getApiUrl(): string {
    if (!this.config) throw new Error('GitLab CI not configured');
    return `${this.config.url}/api/v4`;
  }

  private async request(endpoint: string, method: string = 'GET', body?: string): Promise<any> {
    if (!this.config) throw new Error('GitLab CI not configured');

    const options: RequestInit = {
      method,
      headers: {
        'PRIVATE-TOKEN': this.config.token,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = body;
    }

    const response = await fetch(`${this.getApiUrl()}${endpoint}`, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async listPipelines(options?: {
    ref?: string;
    status?: string;
    orderBy?: 'id' | 'updated_at';
    perPage?: number;
  }): Promise<GitLabPipeline[]> {
    const params = new URLSearchParams();
    if (options?.ref) params.append('ref', options.ref);
    if (options?.status) params.append('status', options.status);
    if (options?.orderBy) params.append('order_by', options.orderBy);
    if (options?.perPage) params.append('per_page', String(options.perPage));

    return this.request(`/projects/${encodeURIComponent(this.config!.projectId)}/pipelines?${params}`) as Promise<GitLabPipeline[]>;
  }

  async getPipeline(pipelineId: number): Promise<GitLabPipeline> {
    return this.request(`/projects/${encodeURIComponent(this.config!.projectId)}/pipelines/${pipelineId}`) as Promise<GitLabPipeline>;
  }

  async triggerPipeline(options: {
    ref: string;
    variables?: Record<string, string>;
  }): Promise<GitLabPipeline> {
    if (!this.config) throw new Error('GitLab CI not configured');

    const body = JSON.stringify({
      ref: options.ref,
      variables: options.variables
        ? Object.entries(options.variables).map(([key, value]) => ({ key, value }))
        : undefined,
    });

    return this.request(
      `/projects/${encodeURIComponent(this.config.projectId)}/pipeline`,
      'POST',
      body
    ) as Promise<GitLabPipeline>;
  }

  async cancelPipeline(pipelineId: number): Promise<GitLabPipeline> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/pipelines/${pipelineId}/cancel`,
      'POST'
    ) as Promise<GitLabPipeline>;
  }

  async retryPipeline(pipelineId: number): Promise<GitLabPipeline> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/pipelines/${pipelineId}/retry`,
      'POST'
    ) as Promise<GitLabPipeline>;
  }

  async getPipelineJobs(pipelineId: number): Promise<GitLabJob[]> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/pipelines/${pipelineId}/jobs`
    ) as Promise<GitLabJob[]>;
  }

  async getJobTrace(jobId: number): Promise<string> {
    if (!this.config) throw new Error('GitLab CI not configured');

    const response = await fetch(
      `${this.getApiUrl()}/projects/${encodeURIComponent(this.config.projectId)}/jobs/${jobId}/trace`,
      {
        headers: {
          'PRIVATE-TOKEN': this.config.token,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get job trace: ${response.statusText}`);
    }

    return response.text();
  }

  async playJob(jobId: number): Promise<GitLabJob> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/jobs/${jobId}/play`,
      'POST'
    ) as Promise<GitLabJob>;
  }

  async cancelJob(jobId: number): Promise<GitLabJob> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/jobs/${jobId}/cancel`,
      'POST'
    ) as Promise<GitLabJob>;
  }

  async listMergeRequestPipelines(mrIid: number): Promise<GitLabPipeline[]> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/merge_requests/${mrIid}/pipelines`
    ) as Promise<GitLabPipeline[]>;
  }

  async getPipelineVariables(pipelineId: number): Promise<Array<{ key: string; value: string }>> {
    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/pipelines/${pipelineId}/variables`
    ) as Promise<Array<{ key: string; value: string }>>;
  }

  async createPipelineSchedule(options: {
    ref: string;
    description: string;
    cron?: string;
  }): Promise<any> {
    const body = JSON.stringify({
      description: options.description,
      ref: options.ref,
      cron: options.cron,
    });

    return this.request(
      `/projects/${encodeURIComponent(this.config!.projectId)}/pipeline_schedules`,
      'POST',
      body
    );
  }

  getConfig(): GitLabCIConfig | null {
    return this.config ? { ...this.config } : null;
  }

  cleanup(): void {
    this.config = null;
    this.removeAllListeners();
  }
}

export default GitLabCIManager;
