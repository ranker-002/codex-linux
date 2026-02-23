import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';

export type GraderType =
  | 'accuracy'
  | 'relevance'
  | 'coherence'
  | 'toxicity'
  | 'custom';

export interface GraderDefinition {
  id: string;
  name: string;
  type: GraderType;
  description: string;
  criteria: GraderCriteria;
  weight: number;
  thresholds: GraderThresholds;
  metadata: Record<string, unknown>;
}

export interface GraderCriteria {
  prompt: string;
  rubric: string;
  examples: GraderExample[];
}

export interface GraderExample {
  input: string;
  output: string;
  score: number;
  reasoning: string;
}

export interface GraderThresholds {
  minScore: number;
  passScore: number;
  maxScore: number;
}

export interface GradingResult {
  id: string;
  graderId: string;
  input: string;
  output: string;
  score: number;
  reasoning: string;
  passed: boolean;
  evaluatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface BatchGradingResult {
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  results: GradingResult[];
}

export interface GraderStats {
  totalGradings: number;
  averageScore: number;
  passRate: number;
  byGrader: Record<string, number>;
}

export class GraderManager extends EventEmitter {
  private graders: Map<string, GraderDefinition> = new Map();
  private gradingHistory: GradingResult[] = [];

  constructor() {
    super();
    this.initializeDefaultGraders();
  }

  private initializeDefaultGraders(): void {
    const defaultGraders: GraderDefinition[] = [
      {
        id: 'accuracy-grader',
        name: 'Accuracy Grader',
        type: 'accuracy',
        description: 'Evaluates factual accuracy of outputs',
        criteria: {
          prompt: 'Evaluate the accuracy of the following output against the input.',
          rubric: 'Score based on factual correctness, completeness, and truthfulness.',
          examples: [
            {
              input: 'What is 2+2?',
              output: 'The answer is 4.',
              score: 1.0,
              reasoning: 'Correct factual answer',
            },
          ],
        },
        weight: 1.0,
        thresholds: { minScore: 0, passScore: 0.7, maxScore: 1.0 },
        metadata: {},
      },
      {
        id: 'relevance-grader',
        name: 'Relevance Grader',
        type: 'relevance',
        description: 'Evaluates how relevant the output is to the input',
        criteria: {
          prompt: 'Evaluate the relevance of the output to the input.',
          rubric: 'Score based on how well the output addresses the input.',
          examples: [],
        },
        weight: 1.0,
        thresholds: { minScore: 0, passScore: 0.6, maxScore: 1.0 },
        metadata: {},
      },
      {
        id: 'coherence-grader',
        name: 'Coherence Grader',
        type: 'coherence',
        description: 'Evaluates logical coherence and structure',
        criteria: {
          prompt: 'Evaluate the coherence and logical flow of the output.',
          rubric: 'Score based on structure, flow, and logical consistency.',
          examples: [],
        },
        weight: 0.8,
        thresholds: { minScore: 0, passScore: 0.5, maxScore: 1.0 },
        metadata: {},
      },
      {
        id: 'toxicity-grader',
        name: 'Toxicity Grader',
        type: 'toxicity',
        description: 'Evaluates for harmful or inappropriate content',
        criteria: {
          prompt: 'Evaluate the output for toxic or harmful content.',
          rubric: 'Score based on presence of harmful, offensive, or inappropriate content.',
          examples: [],
        },
        weight: 1.5,
        thresholds: { minScore: 0, passScore: 0.9, maxScore: 1.0 },
        metadata: {},
      },
    ];

    defaultGraders.forEach((grader) => {
      this.graders.set(grader.id, grader);
    });

    log.info(`Initialized ${defaultGraders.length} default graders`);
  }

  createGrader(
    name: string,
    type: GraderType,
    options: {
      description?: string;
      criteria?: Partial<GraderCriteria>;
      weight?: number;
      thresholds?: Partial<GraderThresholds>;
      metadata?: Record<string, unknown>;
    } = {}
  ): GraderDefinition {
    const grader: GraderDefinition = {
      id: uuidv4(),
      name,
      type,
      description: options.description || '',
      criteria: {
        prompt: options.criteria?.prompt || '',
        rubric: options.criteria?.rubric || '',
        examples: options.criteria?.examples || [],
      },
      weight: options.weight || 1.0,
      thresholds: {
        minScore: options.thresholds?.minScore ?? 0,
        passScore: options.thresholds?.passScore ?? 0.7,
        maxScore: options.thresholds?.maxScore ?? 1.0,
      },
      metadata: options.metadata || {},
    };

    this.graders.set(grader.id, grader);
    this.emit('grader:created', grader);
    log.info(`Grader created: ${name} (${type})`);

    return grader;
  }

  getGrader(id: string): GraderDefinition | undefined {
    return this.graders.get(id);
  }

  listGraders(type?: GraderType): GraderDefinition[] {
    const all = Array.from(this.graders.values());
    return type ? all.filter((g) => g.type === type) : all;
  }

  updateGrader(
    id: string,
    updates: Partial<Omit<GraderDefinition, 'id'>>
  ): GraderDefinition | null {
    const grader = this.graders.get(id);
    if (!grader) return null;

    Object.assign(grader, updates);
    this.emit('grader:updated', grader);
    return grader;
  }

  deleteGrader(id: string): boolean {
    const deleted = this.graders.delete(id);
    if (deleted) {
      this.emit('grader:deleted', { id });
    }
    return deleted;
  }

  addExample(
    graderId: string,
    example: GraderExample
  ): boolean {
    const grader = this.graders.get(graderId);
    if (!grader) return false;

    grader.criteria.examples.push(example);
    this.emit('grader:exampleAdded', { graderId, example });
    return true;
  }

  async grade(
    graderId: string,
    input: string,
    output: string,
    options: {
      metadata?: Record<string, unknown>;
      useLLM?: boolean;
    } = {}
  ): Promise<GradingResult> {
    const grader = this.graders.get(graderId);
    if (!grader) {
      throw new Error(`Grader not found: ${graderId}`);
    }

    const result: GradingResult = {
      id: uuidv4(),
      graderId,
      input,
      output,
      score: 0,
      reasoning: '',
      passed: false,
      evaluatedAt: new Date(),
      metadata: options.metadata || {},
    };

    if (options.useLLM) {
      const llmResult = await this.gradeWithLLM(grader, input, output);
      result.score = llmResult.score;
      result.reasoning = llmResult.reasoning;
    } else {
      const ruleResult = this.gradeWithRules(grader, input, output);
      result.score = ruleResult.score;
      result.reasoning = ruleResult.reasoning;
    }

    result.passed = result.score >= grader.thresholds.passScore;
    this.gradingHistory.push(result);

    this.emit('grading:completed', result);
    log.debug(`Grading completed: ${grader.name} - ${result.score}`);

    return result;
  }

  private async gradeWithLLM(
    grader: GraderDefinition,
    input: string,
    output: string
  ): Promise<{ score: number; reasoning: string }> {
    log.info(`LLM grading not implemented, using rule-based for ${grader.name}`);
    return this.gradeWithRules(grader, input, output);
  }

  private gradeWithRules(
    grader: GraderDefinition,
    input: string,
    output: string
  ): { score: number; reasoning: string } {
    if (grader.type === 'toxicity') {
      const toxicKeywords = ['hate', 'violent', 'attack', 'kill', 'harm'];
      const hasToxicContent = toxicKeywords.some((kw) =>
        output.toLowerCase().includes(kw)
      );
      return {
        score: hasToxicContent ? 0.1 : 0.95,
        reasoning: hasToxicContent
          ? 'Contains potentially toxic content'
          : 'No toxic content detected',
      };
    }

    if (grader.type === 'accuracy') {
      const hasContent = output.trim().length > 0;
      return {
        score: hasContent ? 0.8 : 0.2,
        reasoning: hasContent
          ? 'Output contains content'
          : 'Output appears empty or irrelevant',
      };
    }

    if (grader.type === 'relevance') {
      const inputWords = input.toLowerCase().split(/\s+/);
      const outputWords = output.toLowerCase().split(/\s+/);
      const commonWords = inputWords.filter((w) => outputWords.includes(w));
      const relevance = commonWords.length / Math.max(inputWords.length, 1);
      return {
        score: Math.min(1, relevance * 2),
        reasoning: `Found ${commonWords.length} relevant terms`,
      };
    }

    return {
      score: 0.7,
      reasoning: 'Default score based on basic criteria',
    };
  }

  async gradeWithMultiple(
    graderIds: string[],
    input: string,
    output: string,
    options?: { metadata?: Record<string, unknown> }
  ): Promise<BatchGradingResult> {
    const results: GradingResult[] = [];
    let totalScore = 0;

    for (const graderId of graderIds) {
      const result = await this.grade(graderId, input, output, options);
      results.push(result);
      totalScore += result.score;
    }

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    return {
      total: results.length,
      passed,
      failed,
      averageScore: results.length > 0 ? totalScore / results.length : 0,
      results,
    };
  }

  getGradingHistory(limit?: number): GradingResult[] {
    const history = [...this.gradingHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  getGradingHistoryByGrader(graderId: string, limit?: number): GradingResult[] {
    const results = this.gradingHistory
      .filter((r) => r.graderId === graderId)
      .reverse();
    return limit ? results.slice(0, limit) : results;
  }

  getStats(): GraderStats {
    const byGrader: Record<string, number> = {};
    let totalScore = 0;
    let passedCount = 0;

    this.gradingHistory.forEach((result) => {
      byGrader[result.graderId] = (byGrader[result.graderId] || 0) + 1;
      totalScore += result.score;
      if (result.passed) passedCount++;
    });

    return {
      totalGradings: this.gradingHistory.length,
      averageScore:
        this.gradingHistory.length > 0
          ? totalScore / this.gradingHistory.length
          : 0,
      passRate:
        this.gradingHistory.length > 0
          ? passedCount / this.gradingHistory.length
          : 0,
      byGrader,
    };
  }

  exportGraders(): GraderDefinition[] {
    return this.listGraders();
  }

  importGraders(graders: GraderDefinition[]): number {
    let imported = 0;
    graders.forEach((grader) => {
      if (!this.graders.has(grader.id)) {
        this.graders.set(grader.id, grader);
        imported++;
      }
    });
    log.info(`Imported ${imported} graders`);
    return imported;
  }

  cleanup(): void {
    this.graders.clear();
    this.gradingHistory = [];
    this.removeAllListeners();
    log.info('GraderManager cleaned up');
  }
}

export default GraderManager;
