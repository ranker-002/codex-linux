import { EventEmitter } from 'events';
import log from 'electron-log';

interface BatchJob {
  id: string;
  type: 'agent' | 'task' | 'eval';
  payload: any;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  cost?: number;
}

interface BatchConfig {
  maxConcurrent: number;
  rateLimit: number;
  costBudget?: number;
}

export class BatchProcessingSystem extends EventEmitter {
  private queue: BatchJob[] = [];
  private activeJobs: Map<string, BatchJob> = new Map();
  private completedJobs: BatchJob[] = [];
  private config: BatchConfig;
  private processingInterval: NodeJS.Timeout | null = null;
  private totalCost: number = 0;

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    this.config = {
      maxConcurrent: config.maxConcurrent || 3,
      rateLimit: config.rateLimit || 10,
      costBudget: config.costBudget
    };
  }

  start(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 1000);

    log.info('Batch processing system started');
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    log.info('Batch processing system stopped');
  }

  addJob(type: BatchJob['type'], payload: any, priority: number = 0): string {
    const jobId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BatchJob = {
      id: jobId,
      type,
      payload,
      priority,
      status: 'pending',
      createdAt: Date.now()
    };

    // Insert based on priority
    const insertIndex = this.queue.findIndex(j => j.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(job);
    } else {
      this.queue.splice(insertIndex, 0, job);
    }

    this.emit('job:added', job);
    log.debug(`Batch job added: ${jobId}`);

    return jobId;
  }

  private async processQueue(): Promise<void> {
    if (this.activeJobs.size >= this.config.maxConcurrent) return;
    if (this.queue.length === 0) return;

    // Check cost budget
    if (this.config.costBudget && this.totalCost >= this.config.costBudget) {
      log.warn('Batch processing: Cost budget exceeded');
      return;
    }

    const job = this.queue.shift();
    if (!job) return;

    job.status = 'processing';
    job.startedAt = Date.now();
    this.activeJobs.set(job.id, job);

    this.emit('job:started', job);

    try {
      // Process job based on type
      const result = await this.executeJob(job);
      
      job.status = 'completed';
      job.completedAt = Date.now();
      job.result = result;
      
      if (result.cost) {
        job.cost = result.cost;
        this.totalCost += result.cost;
      }

      this.completedJobs.push(job);
      this.emit('job:completed', job);
      
      log.debug(`Batch job completed: ${job.id}`);
    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = error instanceof Error ? error.message : String(error);
      
      this.completedJobs.push(job);
      this.emit('job:failed', job);
      
      log.error(`Batch job failed: ${job.id}`, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async executeJob(job: BatchJob): Promise<any> {
    // Simulate job execution - in real implementation, this would call actual services
    await this.delay(1000);
    
    return {
      success: true,
      jobId: job.id,
      cost: Math.random() * 0.01 // Simulated cost
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus(): {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    totalCost: number;
  } {
    return {
      pending: this.queue.length,
      active: this.activeJobs.size,
      completed: this.completedJobs.filter(j => j.status === 'completed').length,
      failed: this.completedJobs.filter(j => j.status === 'failed').length,
      totalCost: this.totalCost
    };
  }

  getJob(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId) || 
           this.queue.find(j => j.id === jobId) ||
           this.completedJobs.find(j => j.id === jobId);
  }

  cancelJob(jobId: string): boolean {
    const queueIndex = this.queue.findIndex(j => j.id === jobId);
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1);
      return true;
    }
    return false;
  }

  estimateCost(jobsCount: number): {
    min: number;
    max: number;
    average: number;
  } {
    // Simple cost estimation based on historical data
    const avgCostPerJob = this.completedJobs.length > 0
      ? this.completedJobs.reduce((sum, j) => sum + (j.cost || 0), 0) / this.completedJobs.length
      : 0.01; // Default estimate

    return {
      min: jobsCount * avgCostPerJob * 0.5,
      max: jobsCount * avgCostPerJob * 2,
      average: jobsCount * avgCostPerJob
    };
  }

  cleanup(): void {
    this.stop();
    this.queue = [];
    this.activeJobs.clear();
    this.completedJobs = [];
    this.removeAllListeners();
  }
}

export default BatchProcessingSystem;
