import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export interface Prediction {
  id: string;
  type: PredictionType;
  confidence: number;
  content: string;
  reasoning?: string;
  context: PredictionContext;
  alternatives: PredictionAlternative[];
  createdAt: Date;
  usedAt?: Date;
}

export type PredictionType =
  | 'code_completion'
  | 'command_suggestion'
  | 'file_action'
  | 'refactoring'
  | 'test_generation'
  | 'documentation'
  | 'error_fix'
  | 'import_suggestion';

export interface PredictionContext {
  filePath?: string;
  language?: string;
  cursorPosition?: { line: number; column: number };
  recentActions?: string[];
  projectType?: string;
}

export interface PredictionAlternative {
  content: string;
  confidence: number;
}

export interface PredictionConfig {
  maxPredictions: number;
  confidenceThreshold: number;
  predictionTimeout: number;
  enableAlternatives: boolean;
  contextWindowSize: number;
}

export class PredictedOutputManager extends EventEmitter {
  private predictions: Map<string, Prediction> = new Map();
  private config: PredictionConfig;
  private contextHistory: PredictionContext[] = [];

  constructor(config?: Partial<PredictionConfig>) {
    super();
    this.config = {
      maxPredictions: config?.maxPredictions || 5,
      confidenceThreshold: config?.confidenceThreshold || 0.7,
      predictionTimeout: config?.predictionTimeout || 30000,
      enableAlternatives: config?.enableAlternatives ?? true,
      contextWindowSize: config?.contextWindowSize || 10,
    };
  }

  configure(config: Partial<PredictionConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('PredictedOutputManager configured', this.config);
  }

  getConfig(): PredictionConfig {
    return { ...this.config };
  }

  addContext(context: PredictionContext): void {
    this.contextHistory.push(context);
    if (this.contextHistory.length > this.config.contextWindowSize) {
      this.contextHistory.shift();
    }
    this.emit('context:added', context);
  }

  getRecentContext(): PredictionContext[] {
    return [...this.contextHistory];
  }

  createPrediction(
    type: PredictionType,
    content: string,
    context: PredictionContext,
    options: {
      confidence?: number;
      reasoning?: string;
      alternatives?: PredictionAlternative[];
    } = {}
  ): Prediction {
    const prediction: Prediction = {
      id: uuidv4(),
      type,
      confidence: options.confidence || 0.5,
      content,
      reasoning: options.reasoning,
      context,
      alternatives: options.alternatives || [],
      createdAt: new Date(),
    };

    this.predictions.set(prediction.id, prediction);
    this.emit('prediction:created', prediction);
    log.debug(`Prediction created: ${type} (${prediction.confidence})`);

    return prediction;
  }

  createPredictions(
    type: PredictionType,
    contents: string[],
    context: PredictionContext,
    options: {
      reasoning?: string;
    } = {}
  ): Prediction[] {
    const predictions: Prediction[] = [];

    contents.forEach((content, index) => {
      const confidence = 1.0 - index * 0.15;
      const alternatives: PredictionAlternative[] = [];

      if (this.config.enableAlternatives) {
        contents.forEach((alt, altIndex) => {
          if (altIndex !== index) {
            alternatives.push({
              content: alt,
              confidence: 1.0 - altIndex * 0.15,
            });
          }
        });
      }

      const prediction = this.createPrediction(type, content, context, {
        confidence,
        reasoning: options.reasoning,
        alternatives: alternatives.slice(0, 3),
      });

      predictions.push(prediction);
    });

    return predictions;
  }

  getPrediction(id: string): Prediction | undefined {
    return this.predictions.get(id);
  }

  getActivePredictions(): Prediction[] {
    const now = new Date();
    return Array.from(this.predictions.values())
      .filter((p) => {
        const age = now.getTime() - p.createdAt.getTime();
        return age < this.config.predictionTimeout;
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxPredictions);
  }

  getPredictionsByType(type: PredictionType): Prediction[] {
    return this.getActivePredictions().filter((p) => p.type === type);
  }

  markAsUsed(predictionId: string): boolean {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) return false;

    prediction.usedAt = new Date();
    this.emit('prediction:used', prediction);
    log.info(`Prediction used: ${prediction.type}`);
    return true;
  }

  dismissPrediction(predictionId: string): boolean {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) return false;

    this.predictions.delete(predictionId);
    this.emit('prediction:dismissed', prediction);
    return true;
  }

  clearStalePredictions(): number {
    const now = new Date();
    let cleared = 0;

    for (const [id, prediction] of this.predictions) {
      const age = now.getTime() - prediction.createdAt.getTime();
      if (age >= this.config.predictionTimeout) {
        this.predictions.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      log.debug(`Cleared ${cleared} stale predictions`);
    }

    return cleared;
  }

  getBestPrediction(type?: PredictionType): Prediction | null {
    const predictions = type
      ? this.getPredictionsByType(type)
      : this.getActivePredictions();

    const filtered = predictions.filter(
      (p) => p.confidence >= this.config.confidenceThreshold
    );

    return filtered.length > 0 ? filtered[0] : null;
  }

  getStats(): {
    totalPredictions: number;
    activePredictions: number;
    usedPredictions: number;
    averageConfidence: number;
    byType: Record<PredictionType, number>;
  } {
    const all = Array.from(this.predictions.values());
    const active = this.getActivePredictions();
    const used = all.filter((p) => p.usedAt !== undefined);

    const byType: Record<PredictionType, number> = {
      code_completion: 0,
      command_suggestion: 0,
      file_action: 0,
      refactoring: 0,
      test_generation: 0,
      documentation: 0,
      error_fix: 0,
      import_suggestion: 0,
    };

    all.forEach((p) => {
      byType[p.type]++;
    });

    return {
      totalPredictions: all.length,
      activePredictions: active.length,
      usedPredictions: used.length,
      averageConfidence:
        active.length > 0
          ? active.reduce((sum, p) => sum + p.confidence, 0) / active.length
          : 0,
      byType,
    };
  }

  cleanup(): void {
    this.predictions.clear();
    this.contextHistory = [];
    this.removeAllListeners();
    log.info('PredictedOutputManager cleaned up');
  }
}

export default PredictedOutputManager;
