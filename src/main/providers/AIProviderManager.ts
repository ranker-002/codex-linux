import { EventEmitter } from 'events';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import log from 'electron-log';
import { AIProvider, ProviderConfig, ProviderModel } from '../../shared/types';
import { SettingsManager } from '../SettingsManager';

interface AIProviderInterface {
  sendMessage(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
      extendedThinking?: boolean;
      reasoningEffort?: 'low' | 'medium' | 'high';
    }
  ): Promise<{ content: string; metadata?: Record<string, any> }>;
  sendMessageStream?(
    model: string,
    messages: Array<{ role: string; content: string }>,
    callbacks?: {
      onChunk?: (chunk: string) => void;
      onComplete?: () => void;
      onError?: (error: Error) => void;
    }
  ): Promise<{ content: string }>;
  listModels(): ProviderModel[];
  testConnection(): Promise<boolean>;
}

class OpenAIProvider implements AIProviderInterface {
  private client: OpenAI;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
      defaultHeaders: config.customHeaders
    });
  }

  async sendMessage(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
      extendedThinking?: boolean;
      reasoningEffort?: 'low' | 'medium' | 'high';
    }
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    const openaiMessages = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content
    }));

    const requestParams: any = {
      model,
      messages: openaiMessages,
      stream: false
    };

    // Add reasoning_effort for models that support it
    if (options?.extendedThinking && model.startsWith('o1')) {
      requestParams.reasoning_effort = options.reasoningEffort || 'medium';
    }

    const response = await this.client.chat.completions.create(requestParams, {
      signal: options?.signal
    });

    const content = response.choices[0]?.message?.content || '';
    const reasoning = (response.choices[0]?.message as any)?.reasoning_content;
    
    return {
      content,
      metadata: {
        model: response.model,
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
        reasoning: reasoning || null,
        extendedThinking: options?.extendedThinking || false,
        reasoningEffort: options?.reasoningEffort
      }
    };
  }

  listModels(): ProviderModel[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable multimodal model',
        maxTokens: 4096,
        contextWindow: 128000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 5.00, output: 15.00 }
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast and affordable',
        maxTokens: 4096,
        contextWindow: 128000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 0.15, output: 0.60 }
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        description: 'Latest flagship model',
        maxTokens: 8192,
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 10.00, output: 30.00 }
      },
      {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        description: 'Optimized for coding tasks',
        maxTokens: 8192,
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 15.00, output: 45.00 }
      }
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }
}

class AnthropicProvider implements AIProviderInterface {
  private client: Anthropic;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3
    });
  }

  async sendMessage(
    model: string,
    messages: Array<{ role: string; content: string }>,
    options?: {
      signal?: AbortSignal;
      onProgress?: (progress: number) => void;
    }
  ): Promise<{ content: string; metadata?: Record<string, any> }> {
    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages
    }, {
      signal: options?.signal
    });

    const content = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map(c => c.text)
      .join('');

    return {
      content,
      metadata: {
        model: response.model,
        usage: response.usage,
        stopReason: response.stop_reason
      }
    };
  }

  listModels(): ProviderModel[] {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Best balance of performance and speed',
        maxTokens: 8192,
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 3.00, output: 15.00 }
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most capable model',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: true,
        pricing: { input: 15.00, output: 75.00 }
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast and cost-effective',
        maxTokens: 4096,
        contextWindow: 200000,
        supportsTools: true,
        supportsVision: false,
        pricing: { input: 0.25, output: 1.25 }
      }
    ];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }]
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export class AIProviderManager extends EventEmitter {
  private providers: Map<string, AIProvider> = new Map();
  private providerInstances: Map<string, AIProviderInterface> = new Map();
  private activeProviderId: string = 'openai';

  constructor(private settingsManager: SettingsManager) {
    super();
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Default providers configuration
    const defaultProviders: AIProvider[] = [
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'Access to GPT-4, GPT-4o, and Codex models',
        enabled: true,
        config: {
          apiKey: this.settingsManager.getAny('openai.apiKey') as string || '',
          baseUrl: 'https://api.openai.com/v1',
          timeout: 60000,
          maxRetries: 3
        },
        models: []
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Access to Claude models',
        enabled: true,
        config: {
          apiKey: this.settingsManager.getAny('anthropic.apiKey') as string || '',
          baseUrl: 'https://api.anthropic.com',
          timeout: 60000,
          maxRetries: 3
        },
        models: []
      }
    ];

    for (const provider of defaultProviders) {
      this.providers.set(provider.id, provider);
      this.createProviderInstance(provider);
    }

    // Load active provider from settings
    const savedActiveProvider = this.settingsManager.getAny('activeProvider') as string;
    if (savedActiveProvider && this.providers.has(savedActiveProvider)) {
      this.activeProviderId = savedActiveProvider;
    }
  }

  private createProviderInstance(provider: AIProvider): void {
    switch (provider.id) {
      case 'openai':
        this.providerInstances.set(provider.id, new OpenAIProvider(provider.config));
        break;
      case 'anthropic':
        this.providerInstances.set(provider.id, new AnthropicProvider(provider.config));
        break;
      default:
        log.warn(`Unknown provider: ${provider.id}`);
    }
  }

  listProviders(): AIProvider[] {
    return Array.from(this.providers.values()).map(p => ({
      ...p,
      models: this.providerInstances.get(p.id)?.listModels() || []
    }));
  }

  getActiveProvider(): AIProvider | null {
    return this.providers.get(this.activeProviderId) || null;
  }

  getActiveProviderInstance(): AIProviderInterface | null {
    return this.providerInstances.get(this.activeProviderId) || null;
  }

  setActiveProvider(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} not found`);
    }
    
    this.activeProviderId = providerId;
    this.settingsManager.setAny('activeProvider', providerId);
    this.emit('provider:changed', providerId);
  }

  getProvider(providerId: string): AIProviderInterface | null {
    return this.providerInstances.get(providerId) || null;
  }

  configureProvider(providerId: string, config: ProviderConfig): void {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    provider.config = { ...provider.config, ...config };
    
    // Save API key to settings
    if (config.apiKey) {
      this.settingsManager.setAny(`${providerId}.apiKey`, config.apiKey);
    }

    // Recreate provider instance with new config
    this.createProviderInstance(provider);
    
    this.emit('provider:configured', providerId);
  }

  async testProvider(providerId: string): Promise<boolean> {
    const instance = this.providerInstances.get(providerId);
    if (!instance) {
      throw new Error(`Provider ${providerId} not found`);
    }

    return await instance.testConnection();
  }
}