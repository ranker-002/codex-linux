import { EventEmitter } from 'events';
import log from 'electron-log';
import { AIProviderManager } from '../providers/AIProviderManager';

export interface ImageAnalysisRequest {
  imagePath?: string;
  imageBase64?: string;
  imageUrl?: string;
  prompt: string;
  model?: string;
}

export interface ImageAnalysisResult {
  content: string;
  model: string;
  tokensUsed?: number;
}

export interface ScreenshotCapture {
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export class VisionManager extends EventEmitter {
  private aiProviderManager: AIProviderManager;
  private supportedModels: string[] = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229',
    'claude-3-5-haiku-20241022'
  ];

  constructor(aiProviderManager: AIProviderManager) {
    super();
    this.aiProviderManager = aiProviderManager;
  }

  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const model = request.model || 'gpt-4o';
    
    if (!this.isVisionSupported(model)) {
      throw new Error(`Model ${model} does not support vision`);
    }

    try {
      log.info('Vision: Analyzing image...');

      // Prepare image data
      let imageData: string;
      if (request.imageBase64) {
        imageData = request.imageBase64;
      } else if (request.imagePath) {
        imageData = await this.imagePathToBase64(request.imagePath);
      } else if (request.imageUrl) {
        imageData = request.imageUrl;
      } else {
        throw new Error('No image provided');
      }

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) {
        throw new Error('No AI provider available');
      }

      // Call vision API
      const messages = [{
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: request.prompt },
          {
            type: 'image_url' as const,
            image_url: {
              url: imageData.startsWith('http') ? imageData : `data:image/jpeg;base64,${imageData}`,
              detail: 'high'
            }
          }
        ]
      }];

      const response = await (provider as any).sendMessage(model, messages);

      log.info('Vision: Analysis complete');

      return {
        content: response.content,
        model: response.metadata?.model || model,
        tokensUsed: response.metadata?.usage?.total_tokens
      };
    } catch (error) {
      log.error('Vision: Analysis failed:', error);
      throw error;
    }
  }

  async analyzeScreenshot(
    screenshotData: string,
    prompt: string = 'Analyze this screenshot and describe what you see.'
  ): Promise<ImageAnalysisResult> {
    return this.analyzeImage({
      imageBase64: screenshotData,
      prompt
    });
  }

  async analyzeUI(
    screenshotData: string,
    context?: {
      currentTask?: string;
      expectedElements?: string[];
    }
  ): Promise<{
    description: string;
    issues: string[];
    suggestions: string[];
  }> {
    const prompt = context?.currentTask
      ? `Analyze this UI screenshot in the context of: ${context.currentTask}. Identify any issues, missing elements, or areas for improvement.`
      : 'Analyze this UI screenshot. Identify any visual issues, accessibility concerns, or UI/UX improvements.';

    const result = await this.analyzeScreenshot(screenshotData, prompt);

    // Parse the response to extract structured information
    const lines = result.content.split('\n');
    const issues: string[] = [];
    const suggestions: string[] = [];
    let description = '';
    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().includes('issue') || trimmed.toLowerCase().includes('problem')) {
        currentSection = 'issues';
      } else if (trimmed.toLowerCase().includes('suggestion') || trimmed.toLowerCase().includes('improvement')) {
        currentSection = 'suggestions';
      } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        if (currentSection === 'issues') {
          issues.push(trimmed.substring(1).trim());
        } else if (currentSection === 'suggestions') {
          suggestions.push(trimmed.substring(1).trim());
        }
      } else if (!currentSection) {
        description += trimmed + ' ';
      }
    }

    return {
      description: description.trim() || result.content,
      issues,
      suggestions
    };
  }

  async captureAndAnalyze(
    captureFn: () => Promise<string>,
    prompt?: string
  ): Promise<ImageAnalysisResult> {
    const screenshot = await captureFn();
    return this.analyzeScreenshot(screenshot, prompt);
  }

  private async imagePathToBase64(imagePath: string): Promise<string> {
    const fs = await import('fs/promises');
    const imageBuffer = await fs.readFile(imagePath);
    return imageBuffer.toString('base64');
  }

  private isVisionSupported(model: string): boolean {
    return this.supportedModels.some(supported => 
      model.toLowerCase().includes(supported.toLowerCase())
    );
  }

  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }

  cleanup(): void {
    this.removeAllListeners();
  }
}

export default VisionManager;
