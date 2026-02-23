import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

export type GenerationProvider = 'openai' | 'anthropic' | 'stability' | 'runway' | 'custom';
export type GenerationType = 'image' | 'video';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  width?: number;
  height?: number;
  numImages?: number;
  style?: string;
  quality?: 'standard' | 'hd';
}

export interface VideoGenerationRequest {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  numFrames?: number;
}

export interface GenerationJob {
  id: string;
  type: GenerationType;
  provider: GenerationProvider;
  status: GenerationStatus;
  request: ImageGenerationRequest | VideoGenerationRequest;
  result?: GenerationResult;
  progress: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  cost?: number;
  metadata: Record<string, unknown>;
}

export interface GenerationResult {
  urls: string[];
  localPaths?: string[];
  metadata: Record<string, unknown>;
}

export interface GenerationConfig {
  provider: GenerationProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  outputDirectory?: string;
}

export class ImageVideoGenerationManager extends EventEmitter {
  private jobs: Map<string, GenerationJob> = new Map();
  private config: GenerationConfig | null = null;

  constructor() {
    super();
  }

  configure(config: GenerationConfig): void {
    const outputDir = config.outputDirectory || './generated';
    this.config = {
      ...config,
      outputDirectory: outputDir,
    };
    log.info('ImageVideoGenerationManager configured', {
      provider: config.provider,
      outputDirectory: outputDir,
    });

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  getConfig(): GenerationConfig | null {
    return this.config;
  }

  async generateImage(request: ImageGenerationRequest): Promise<GenerationJob> {
    if (!this.config) {
      throw new Error('ImageVideoGenerationManager not configured');
    }

    const job: GenerationJob = {
      id: uuidv4(),
      type: 'image',
      provider: this.config.provider,
      status: 'pending',
      request,
      progress: 0,
      createdAt: new Date(),
      metadata: {},
    };

    this.jobs.set(job.id, job);
    this.emit('job:created', job);
    log.info(`Image generation job created: ${job.id}`);

    this.processImageJob(job);
    return job;
  }

  async generateVideo(request: VideoGenerationRequest): Promise<GenerationJob> {
    if (!this.config) {
      throw new Error('ImageVideoGenerationManager not configured');
    }

    const job: GenerationJob = {
      id: uuidv4(),
      type: 'video',
      provider: this.config.provider,
      status: 'pending',
      request,
      progress: 0,
      createdAt: new Date(),
      metadata: {},
    };

    this.jobs.set(job.id, job);
    this.emit('job:created', job);
    log.info(`Video generation job created: ${job.id}`);

    this.processVideoJob(job);
    return job;
  }

  private async processImageJob(job: GenerationJob): Promise<void> {
    job.status = 'processing';
    job.startedAt = new Date();
    this.emit('job:started', job);

    try {
      let result: GenerationResult;

      switch (job.provider) {
        case 'openai':
          result = await this.generateWithOpenAI(job.request as ImageGenerationRequest);
          break;
        case 'stability':
          result = await this.generateWithStability(job.request as ImageGenerationRequest);
          break;
        case 'custom':
          result = await this.generateWithCustom(job.request as ImageGenerationRequest);
          break;
        default:
          result = await this.mockImageGeneration(job.request as ImageGenerationRequest);
      }

      job.result = result;
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      job.cost = this.estimateCost('image', job.request as ImageGenerationRequest);

      if (result.urls.length > 0 && this.config?.outputDirectory) {
        const localPaths = await this.downloadAssets(result.urls, job.id);
        job.result.localPaths = localPaths;
      }

      this.emit('job:completed', job);
      log.info(`Image generation completed: ${job.id}`);
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      this.emit('job:failed', { job, error });
      log.error(`Image generation failed: ${job.id}`, error);
    }
  }

  private async processVideoJob(job: GenerationJob): Promise<void> {
    job.status = 'processing';
    job.startedAt = new Date();
    this.emit('job:started', job);

    try {
      let result: GenerationResult;

      switch (job.provider) {
        case 'runway':
          result = await this.generateWithRunway(job.request as VideoGenerationRequest);
          break;
        case 'custom':
          result = await this.generateCustomVideo(job.request as VideoGenerationRequest);
          break;
        default:
          result = await this.mockVideoGeneration(job.request as VideoGenerationRequest);
      }

      job.result = result;
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      job.cost = this.estimateCost('video', job.request as VideoGenerationRequest);

      if (result.urls.length > 0 && this.config?.outputDirectory) {
        const localPaths = await this.downloadAssets(result.urls, job.id);
        job.result.localPaths = localPaths;
      }

      this.emit('job:completed', job);
      log.info(`Video generation completed: ${job.id}`);
    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date();
      this.emit('job:failed', { job, error });
      log.error(`Video generation failed: ${job.id}`, error);
    }
  }

  private async generateWithOpenAI(request: ImageGenerationRequest): Promise<GenerationResult> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'dall-e-3',
        prompt: request.prompt,
        n: request.numImages || 1,
        size: `${request.width || 1024}x${request.height || 1024}`,
        quality: request.quality || 'standard',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json() as { data: Array<{ url: string; revised_prompt: string }> };
    
    return {
      urls: data.data.map((d) => d.url),
      metadata: {
        revisedPrompt: data.data[0]?.revised_prompt,
      },
    };
  }

  private async generateWithStability(request: ImageGenerationRequest): Promise<GenerationResult> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch('https://api.stability.ai/v2beta/image generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        negative_prompt: request.negativePrompt,
        model: request.model || 'stable-diffusion-xl-1024-v1-0',
        width: request.width || 1024,
        height: request.height || 1024,
        samples: request.numImages || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Stability AI API error: ${error}`);
    }

    const data = await response.json() as { artifacts: Array<{ base64: string }> };
    
    return {
      urls: [],
      metadata: {
        artifacts: data.artifacts,
      },
    };
  }

  private async generateWithCustom(request: ImageGenerationRequest): Promise<GenerationResult> {
    if (!this.config?.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }

    const response = await fetch(`${this.config.baseUrl}/generate/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Custom provider error: ${response.statusText}`);
    }

    const data = await response.json() as { urls: string[] };
    return { urls: data.urls, metadata: {} };
  }

  private async mockImageGeneration(request: ImageGenerationRequest): Promise<GenerationResult> {
    await this.simulateDelay(3000);
    
    const numImages = request.numImages || 1;
    const urls: string[] = [];
    
    for (let i = 0; i < numImages; i++) {
      const seed = Math.floor(Math.random() * 100000);
      urls.push(`https://picsum.photos/seed/${seed}/1024/1024`);
    }

    return { urls, metadata: { mock: true, prompt: request.prompt } };
  }

  private async generateWithRunway(request: VideoGenerationRequest): Promise<GenerationResult> {
    if (!this.config?.apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch('https://api.runwayml.com/v1/generation/video', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'gen3a',
        prompt: request.prompt,
        duration: request.duration || 5,
        aspect_ratio: request.aspectRatio || '16:9',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Runway API error: ${error}`);
    }

    const data = await response.json() as { id: string; status: string };
    
    return {
      urls: [],
      metadata: { jobId: data.id, status: data.status },
    };
  }

  private async generateCustomVideo(request: VideoGenerationRequest): Promise<GenerationResult> {
    if (!this.config?.baseUrl) {
      throw new Error('Custom provider requires baseUrl');
    }

    const response = await fetch(`${this.config.baseUrl}/generate/video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Custom provider error: ${response.statusText}`);
    }

    const data = await response.json() as { urls: string[] };
    return { urls: data.urls, metadata: {} };
  }

  private async mockVideoGeneration(request: VideoGenerationRequest): Promise<GenerationResult> {
    await this.simulateDelay(10000);
    
    return {
      urls: ['https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'],
      metadata: { mock: true, prompt: request.prompt, duration: request.duration || 5 },
    };
  }

  private async downloadAssets(urls: string[], jobId: string): Promise<string[]> {
    if (!this.config?.outputDirectory) return [];

    const localPaths: string[] = [];
    const outputDir = path.join(this.config.outputDirectory, jobId);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const ext = path.extname(new URL(url).pathname) || '.jpg';
      const filename = `asset_${i}${ext}`;
      const localPath = path.join(outputDir, filename);

      try {
        const response = await fetch(url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          fs.writeFileSync(localPath, Buffer.from(buffer));
          localPaths.push(localPath);
        }
      } catch (error) {
        log.debug(`Failed to download ${url}:`, error);
      }
    }

    return localPaths;
  }

  private estimateCost(
    type: GenerationType,
    request: ImageGenerationRequest | VideoGenerationRequest
  ): number {
    if (type === 'image') {
      const req = request as ImageGenerationRequest;
      const size = (req.width || 1024) * (req.height || 1024);
      const baseCost = size > 1024 * 1024 ? 0.08 : 0.04;
      return (req.numImages || 1) * baseCost;
    } else {
      const req = request as VideoGenerationRequest;
      return (req.duration || 5) * 0.5;
    }
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getJob(id: string): GenerationJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(filter?: {
    type?: GenerationType;
    provider?: GenerationProvider;
    status?: GenerationStatus;
  }): GenerationJob[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.type) {
      jobs = jobs.filter((j) => j.type === filter.type);
    }
    if (filter?.provider) {
      jobs = jobs.filter((j) => j.provider === filter.provider);
    }
    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }

    return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'pending' && job.status !== 'processing') {
      return false;
    }

    job.status = 'failed';
    job.completedAt = new Date();
    this.emit('job:cancelled', job);
    log.info(`Generation job cancelled: ${id}`);
    return true;
  }

  deleteJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.result?.localPaths) {
      const outputDir = path.dirname(job.result.localPaths[0]);
      try {
        fs.rmSync(outputDir, { recursive: true, force: true });
      } catch (error) {
        log.debug(`Failed to clean up job files: ${outputDir}`, error);
      }
    }

    this.jobs.delete(id);
    this.emit('job:deleted', { id });
    return true;
  }

  getStats(): {
    totalJobs: number;
    completed: number;
    failed: number;
    byType: Record<GenerationType, number>;
    totalCost: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const byType: Record<GenerationType, number> = { image: 0, video: 0 };
    let totalCost = 0;

    jobs.forEach((job) => {
      byType[job.type]++;
      if (job.cost) totalCost += job.cost;
    });

    return {
      totalJobs: jobs.length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      byType,
      totalCost,
    };
  }

  cleanup(): void {
    this.jobs.clear();
    this.removeAllListeners();
    log.info('ImageVideoGenerationManager cleaned up');
  }
}

export default ImageVideoGenerationManager;
