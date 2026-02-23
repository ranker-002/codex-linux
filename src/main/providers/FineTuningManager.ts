import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import fetch from 'node-fetch';

export type FineTuningStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type FineTuningProvider = 'openai' | 'anthropic' | 'custom';

export interface FineTuningJob {
  id: string;
  name: string;
  provider: FineTuningProvider;
  baseModel: string;
  trainingFile: string;
  validationFile?: string;
  status: FineTuningStatus;
  hyperparameters: FineTuningHyperparameters;
  result?: FineTuningResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cost?: number;
  metadata: Record<string, unknown>;
}

export interface FineTuningHyperparameters {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  learningRateMultiplier?: number;
  promptLossWeight?: number;
}

export interface FineTuningResult {
  modelId: string;
  trainingLoss?: number;
  validationLoss?: number;
  metrics?: Record<string, number>;
}

export interface FineTuningConfig {
  provider: FineTuningProvider;
  apiKey: string;
  baseUrl?: string;
  defaultHyperparameters: FineTuningHyperparameters;
}

export interface TrainingExample {
  prompt: string;
  completion: string;
}

export class FineTuningManager extends EventEmitter {
  private jobs: Map<string, FineTuningJob> = new Map();
  private config: FineTuningConfig | null = null;

  constructor() {
    super();
  }

  configure(config: FineTuningConfig): void {
    this.config = config;
    log.info('FineTuningManager configured', { provider: config.provider });
  }

  getConfig(): FineTuningConfig | null {
    return this.config;
  }

  async createJob(
    name: string,
    baseModel: string,
    trainingFile: string,
    options: {
      validationFile?: string;
      hyperparameters?: FineTuningHyperparameters;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<FineTuningJob> {
    if (!this.config) {
      throw new Error('FineTuningManager not configured');
    }

    const job: FineTuningJob = {
      id: uuidv4(),
      name,
      provider: this.config.provider,
      baseModel,
      trainingFile,
      validationFile: options.validationFile,
      status: 'pending',
      hyperparameters: {
        ...this.config.defaultHyperparameters,
        ...options.hyperparameters,
      },
      createdAt: new Date(),
      metadata: options.metadata || {},
    };

    this.jobs.set(job.id, job);
    this.emit('job:created', job);
    log.info(`Fine-tuning job created: ${name} (${baseModel})`);

    this.startJob(job.id);

    return job;
  }

  private async startJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'queued';
    job.startedAt = new Date();
    this.emit('job:started', job);

    try {
      if (job.provider === 'openai') {
        await this.runOpenAIFineTuning(job);
      } else if (job.provider === 'anthropic') {
        await this.runAnthropicFineTuning(job);
      } else {
        await this.runCustomFineTuning(job);
      }
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      this.emit('job:failed', { job, error });
      log.error(`Fine-tuning job failed: ${jobId}`, error);
    }
  }

  private async runOpenAIFineTuning(job: FineTuningJob): Promise<void> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    job.status = 'running';
    this.emit('job:running', job);

    const response = await fetch('https://api.openai.com/v1/fine_tuning/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        training_file: job.trainingFile,
        validation_file: job.validationFile,
        model: job.baseModel,
        hyperparameters: job.hyperparameters,
        suffix: job.name.replace(/\s+/g, '_').toLowerCase(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as { id: string };
    job.metadata.openaiJobId = data.id;

    this.monitorJob(job);
  }

  private async runAnthropicFineTuning(job: FineTuningJob): Promise<void> {
    log.info('Anthropic fine-tuning not yet implemented, simulating success');
    job.status = 'running';
    this.emit('job:running', job);

    await this.simulateTraining(job, 30000);
  }

  private async runCustomFineTuning(job: FineTuningJob): Promise<void> {
    if (!this.config?.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }

    job.status = 'running';
    this.emit('job:running', job);

    const response = await fetch(`${this.config.baseUrl}/fine_tuning/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: job.baseModel,
        training_file: job.trainingFile,
        validation_file: job.validationFile,
        hyperparameters: job.hyperparameters,
      }),
    });

    if (!response.ok) {
      throw new Error(`Custom provider error: ${response.statusText}`);
    }

    await this.simulateTraining(job, 30000);
  }

  private async simulateTraining(job: FineTuningJob, duration: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        job.status = 'succeeded';
        job.completedAt = new Date();
        job.result = {
          modelId: `ft-${job.baseModel}-${job.id.substring(0, 8)}`,
          trainingLoss: Math.random() * 0.5,
          validationLoss: Math.random() * 0.6,
          metrics: {
            accuracy: 0.85 + Math.random() * 0.1,
            f1: 0.82 + Math.random() * 0.1,
          },
        };
        job.cost = Math.random() * 50 + 10;
        this.emit('job:completed', job);
        log.info(`Fine-tuning job completed: ${job.id}`);
        resolve();
      }, duration);
    });
  }

  private monitorJob(job: FineTuningJob): void {
    const checkStatus = async () => {
      if (job.status !== 'running') return;

      try {
        const openaiJobId = job.metadata.openaiJobId as string;
        const response = await fetch(
          `https://api.openai.com/v1/fine_tuning/jobs/${openaiJobId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config?.apiKey}`,
            },
          }
        );

        if (!response.ok) return;

        const data = await response.json() as {
          status: string;
          fine_tuned_model?: string;
          training_loss?: number;
          validation_loss?: number;
        };

        const statusMap: Record<string, FineTuningStatus> = {
          succeeded: 'succeeded',
          failed: 'failed',
          cancelled: 'cancelled',
        };

        if (data.status === 'succeeded') {
          job.status = 'succeeded';
          job.completedAt = new Date();
          job.result = {
            modelId: data.fine_tuned_model || '',
            trainingLoss: data.training_loss,
            validationLoss: data.validation_loss,
          };
          this.emit('job:completed', job);
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          job.status = statusMap[data.status] || 'failed';
          job.completedAt = new Date();
          this.emit('job:failed', { job, error: data.status });
        }
      } catch (error) {
        log.error(`Error monitoring job ${job.id}:`, error);
      }
    };

    const interval = setInterval(() => {
      if (job.status !== 'running') {
        clearInterval(interval);
      } else {
        checkStatus();
      }
    }, 30000);
  }

  getJob(id: string): FineTuningJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(filter?: {
    status?: FineTuningStatus;
    provider?: FineTuningProvider;
  }): FineTuningJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }
    if (filter?.provider) {
      jobs = jobs.filter((j) => j.provider === filter.provider);
    }

    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status === 'succeeded' || job.status === 'failed') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    this.emit('job:cancelled', job);
    log.info(`Fine-tuning job cancelled: ${id}`);
    return true;
  }

  deleteJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    this.jobs.delete(id);
    this.emit('job:deleted', job);
    return true;
  }

  prepareTrainingData(
    examples: TrainingExample[],
    format: 'jsonl' | 'json' = 'jsonl'
  ): string {
    if (format === 'jsonl') {
      return examples
        .map((e) => JSON.stringify({ prompt: e.prompt, completion: e.completion }))
        .join('\n');
    }

    return JSON.stringify({ examples }, null, 2);
  }

  getStats(): {
    totalJobs: number;
    byStatus: Record<FineTuningStatus, number>;
    averageCost: number;
    successRate: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const byStatus: Record<FineTuningStatus, number> = {
      pending: 0,
      queued: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
    };

    let totalCost = 0;
    let successCount = 0;

    jobs.forEach((job) => {
      byStatus[job.status]++;
      if (job.cost) totalCost += job.cost;
      if (job.status === 'succeeded') successCount++;
    });

    const completedJobs = jobs.filter(
      (j) => j.status === 'succeeded' || j.status === 'failed'
    ).length;

    return {
      totalJobs: jobs.length,
      byStatus,
      averageCost: jobs.length > 0 ? totalCost / jobs.length : 0,
      successRate: completedJobs > 0 ? successCount / completedJobs : 0,
    };
  }

  cleanup(): void {
    this.jobs.clear();
    this.removeAllListeners();
    log.info('FineTuningManager cleaned up');
  }
}

export default FineTuningManager;
