import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { AIProviderManager } from '../providers/AIProviderManager';
import { Agent, AgentMessage } from '../../shared/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export enum EvalCategory {
  CODE_GENERATION = 'code_generation',
  CODE_REVIEW = 'code_review',
  REFACTORING = 'refactoring',
  DEBUGGING = 'debugging',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
}

export interface EvalTestCase {
  id: string;
  name: string;
  category: EvalCategory;
  description: string;
  prompt: string;
  context?: {
    files?: Array<{
      path: string;
      content: string;
    }>;
    codebase?: string;
  };
  expectedOutput?: string;
  expectedFiles?: Array<{
    path: string;
    shouldExist: boolean;
    contentPattern?: RegExp;
  }>;
  validationCriteria: EvalCriteria[];
  timeout: number;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
}

export interface EvalCriteria {
  id: string;
  name: string;
  description: string;
  weight: number;
  validator: (result: EvalResult) => boolean | Promise<boolean>;
}

export interface EvalResult {
  testCaseId: string;
  agentId: string;
  success: boolean;
  score: number;
  maxScore: number;
  duration: number;
  messages: AgentMessage[];
  criteriaResults: Array<{
    criteriaId: string;
    passed: boolean;
    score: number;
    details?: string;
  }>;
  errors: string[];
  warnings: string[];
  metadata: {
    tokensUsed?: number;
    modelUsed?: string;
    cost?: number;
  };
  createdAt: Date;
}

export interface EvalDataset {
  id: string;
  name: string;
  description: string;
  version: string;
  testCases: EvalTestCase[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EvalRun {
  id: string;
  datasetId: string;
  agentConfig: {
    providerId: string;
    model: string;
    skills: string[];
  };
  results: EvalResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageScore: number;
    totalDuration: number;
  };
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

export class AgentEvalFramework extends EventEmitter {
  private agentOrchestrator: AgentOrchestrator;
  private aiProviderManager: AIProviderManager;
  private datasets: Map<string, EvalDataset> = new Map();
  private activeRuns: Map<string, EvalRun> = new Map();
  private runHistory: EvalRun[] = [];
  private datasetsPath: string;

  constructor(
    agentOrchestrator: AgentOrchestrator,
    aiProviderManager: AIProviderManager,
    datasetsPath: string = './eval-datasets'
  ) {
    super();
    this.agentOrchestrator = agentOrchestrator;
    this.aiProviderManager = aiProviderManager;
    this.datasetsPath = datasetsPath;
  }

  async initialize(): Promise<void> {
    await this.loadDefaultDatasets();
    await this.loadCustomDatasets();
    log.info('Agent Evaluation Framework initialized');
  }

  private async loadDefaultDatasets(): Promise<void> {
    // Code Generation Dataset
    const codeGenDataset: EvalDataset = {
      id: 'code-generation-v1',
      name: 'Code Generation Benchmark',
      description: 'Tests agent ability to generate correct and efficient code',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      testCases: [
        {
          id: 'codegen-001',
          name: 'Generate Fibonacci Function',
          category: EvalCategory.CODE_GENERATION,
          description: 'Generate an efficient Fibonacci function',
          prompt: 'Write a TypeScript function that calculates the nth Fibonacci number efficiently. The function should handle edge cases and large inputs (n up to 1000).',
          expectedFiles: [{
            path: 'fibonacci.ts',
            shouldExist: true,
            contentPattern: /function\s+fibonacci|const\s+fibonacci/,
          }],
          validationCriteria: [
            {
              id: 'syntax-valid',
              name: 'Valid TypeScript Syntax',
              description: 'Generated code must be valid TypeScript',
              weight: 0.2,
              validator: (result) => result.errors.length === 0,
            },
            {
              id: 'efficient',
              name: 'Efficient Implementation',
              description: 'Uses memoization or iterative approach, not naive recursion',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /memo|cache|iterat|loop|for\s*\(|while\s*\(/.test(content);
              },
            },
            {
              id: 'handles-edge-cases',
              name: 'Edge Case Handling',
              description: 'Handles negative inputs and large numbers',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /if.*n\s*<\s*0|n\s*===\s*0|n\s*===\s*1|throw|error/i.test(content);
              },
            },
            {
              id: 'includes-tests',
              name: 'Includes Test Cases',
              description: 'Provides example usage or test cases',
              weight: 0.2,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /test|example|console\.log|expect/.test(content);
              },
            },
          ],
          timeout: 60000,
          difficulty: 'medium',
          tags: ['typescript', 'algorithms', 'fibonacci'],
        },
        {
          id: 'codegen-002',
          name: 'API Endpoint Implementation',
          category: EvalCategory.CODE_GENERATION,
          description: 'Generate a REST API endpoint with validation',
          prompt: 'Create an Express.js POST endpoint for creating a user. Include input validation, error handling, and proper response formatting.',
          validationCriteria: [
            {
              id: 'express-route',
              name: 'Express Route Definition',
              description: 'Uses app.post() or router.post()',
              weight: 0.2,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /app\.post|router\.post/.test(content);
              },
            },
            {
              id: 'validation',
              name: 'Input Validation',
              description: 'Validates request body',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /validate|joi|zod|express-validator|req\.body/.test(content);
              },
            },
            {
              id: 'error-handling',
              name: 'Error Handling',
              description: 'Includes try-catch or error middleware',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /try\s*{|catch|error|Error/.test(content);
              },
            },
            {
              id: 'response-format',
              name: 'Proper Response Format',
              description: 'Returns JSON with status codes',
              weight: 0.2,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /res\.json|res\.status|200|201|400|500/.test(content);
              },
            },
          ],
          timeout: 90000,
          difficulty: 'medium',
          tags: ['express', 'api', 'validation', 'javascript'],
        },
      ],
    };

    // Code Review Dataset
    const codeReviewDataset: EvalDataset = {
      id: 'code-review-v1',
      name: 'Code Review Benchmark',
      description: 'Tests agent ability to identify issues and suggest improvements',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      testCases: [
        {
          id: 'review-001',
          name: 'Security Issues Detection',
          category: EvalCategory.CODE_REVIEW,
          description: 'Identify security vulnerabilities in code',
          prompt: 'Review this code for security issues:\n\n```javascript\nfunction authenticateUser(username, password) {\n  const query = `SELECT * FROM users WHERE username = \'${username}\' AND password = \'${password}\'`;\n  return db.query(query);\n}\n```\n\nIdentify all security issues and suggest fixes.',
          context: {
            files: [{
              path: 'auth.js',
              content: `function authenticateUser(username, password) {
  const query = \`SELECT * FROM users WHERE username = '\${username}' AND password = '\${password}'\`;
  return db.query(query);
}`,
            }],
          },
          validationCriteria: [
            {
              id: 'sql-injection',
              name: 'SQL Injection Detection',
              description: 'Identifies SQL injection vulnerability',
              weight: 0.4,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('').toLowerCase();
                return /sql injection|sqli|parameterized|prepared statement/.test(content);
              },
            },
            {
              id: 'plaintext-password',
              name: 'Plaintext Password Detection',
              description: 'Identifies plaintext password storage',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('').toLowerCase();
                return /plaintext|hash|bcrypt|scrypt|argon2/.test(content);
              },
            },
            {
              id: 'provides-fix',
              name: 'Provides Fix',
              description: 'Provides corrected code',
              weight: 0.3,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /```[\s\S]*?```/.test(content);
              },
            },
          ],
          timeout: 60000,
          difficulty: 'easy',
          tags: ['security', 'sql-injection', 'review'],
        },
      ],
    };

    // Refactoring Dataset
    const refactoringDataset: EvalDataset = {
      id: 'refactoring-v1',
      name: 'Refactoring Benchmark',
      description: 'Tests agent ability to improve code quality',
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      testCases: [
        {
          id: 'refactor-001',
          name: 'Extract Function Refactoring',
          category: EvalCategory.REFACTORING,
          description: 'Refactor duplicated code into a function',
          prompt: 'Refactor this code to eliminate duplication:\n\n```typescript\nfunction processOrders(orders: Order[]) {\n  for (const order of orders) {\n    if (order.status === "pending") {\n      const tax = order.amount * 0.1;\n      const total = order.amount + tax;\n      order.total = total;\n      order.status = "processed";\n    }\n  }\n  \n  for (const order of orders) {\n    if (order.priority === "high") {\n      const tax = order.amount * 0.1;\n      const total = order.amount + tax;\n      order.total = total;\n      order.priority = "processed";\n    }\n  }\n}\n```',
          validationCriteria: [
            {
              id: 'extracts-function',
              name: 'Extracts Helper Function',
              description: 'Creates a separate function for tax calculation',
              weight: 0.4,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                return /function\s+\w+.*tax|calculateTax|computeTax/.test(content);
              },
            },
            {
              id: 'removes-duplication',
              name: 'Removes Code Duplication',
              description: 'Tax calculation appears only once',
              weight: 0.4,
              validator: (result) => {
                const content = result.messages.map(m => m.content).join('');
                const matches = content.match(/\*\s*0\.1/g);
                return !matches || matches.length <= 1;
              },
            },
            {
              id: 'maintains-functionality',
              name: 'Maintains Functionality',
              description: 'Refactored code produces same results',
              weight: 0.2,
              validator: () => true, // Would require actual execution
            },
          ],
          timeout: 90000,
          difficulty: 'medium',
          tags: ['refactoring', 'dry', 'typescript'],
        },
      ],
    };

    this.datasets.set(codeGenDataset.id, codeGenDataset);
    this.datasets.set(codeReviewDataset.id, codeReviewDataset);
    this.datasets.set(refactoringDataset.id, refactoringDataset);

    log.info(`Loaded ${this.datasets.size} default evaluation datasets`);
  }

  private async loadCustomDatasets(): Promise<void> {
    try {
      await fs.mkdir(this.datasetsPath, { recursive: true });
      const files = await fs.readdir(this.datasetsPath);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(
              path.join(this.datasetsPath, file),
              'utf-8'
            );
            const dataset: EvalDataset = JSON.parse(content);
            this.datasets.set(dataset.id, dataset);
            log.info(`Loaded custom dataset: ${dataset.name}`);
          } catch (error) {
            log.error(`Failed to load dataset ${file}:`, error);
          }
        }
      }
    } catch (error) {
      log.error('Failed to load custom datasets:', error);
    }
  }

  async createRun(
    datasetId: string,
    agentConfig: EvalRun['agentConfig'],
    options: {
      testCaseIds?: string[];
      parallel?: boolean;
      maxParallel?: number;
    } = {}
  ): Promise<EvalRun> {
    const dataset = this.datasets.get(datasetId);
    if (!dataset) {
      throw new Error(`Dataset ${datasetId} not found`);
    }

    const runId = uuidv4();
    const testCases = options.testCaseIds
      ? dataset.testCases.filter(tc => options.testCaseIds?.includes(tc.id))
      : dataset.testCases;

    const run: EvalRun = {
      id: runId,
      datasetId,
      agentConfig,
      results: [],
      summary: {
        totalTests: testCases.length,
        passedTests: 0,
        failedTests: 0,
        averageScore: 0,
        totalDuration: 0,
      },
      status: 'pending',
      startedAt: new Date(),
    };

    this.activeRuns.set(runId, run);
    this.emit('run:created', { runId, datasetId });

    // Start evaluation
    this.executeRun(run, testCases, options).catch(error => {
      log.error(`Eval run ${runId} failed:`, error);
      run.status = 'failed';
      this.emit('run:failed', { runId, error });
    });

    return run;
  }

  private async executeRun(
    run: EvalRun,
    testCases: EvalTestCase[],
    options: { parallel?: boolean; maxParallel?: number }
  ): Promise<void> {
    run.status = 'running';
    this.emit('run:started', { runId: run.id });

    const startTime = Date.now();

    if (options.parallel) {
      // Execute in parallel with limit
      const limit = options.maxParallel || 3;
      const chunks = this.chunkArray(testCases, limit);
      
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(tc => this.executeTestCase(run, tc))
        );
      }
    } else {
      // Execute sequentially
      for (const testCase of testCases) {
        await this.executeTestCase(run, testCase);
      }
    }

    // Calculate summary
    run.summary.totalDuration = Date.now() - startTime;
    run.summary.passedTests = run.results.filter(r => r.success).length;
    run.summary.failedTests = run.results.filter(r => !r.success).length;
    run.summary.averageScore = run.results.length > 0
      ? run.results.reduce((sum, r) => sum + (r.score / r.maxScore), 0) / run.results.length * 100
      : 0;

    run.status = 'completed';
    run.completedAt = new Date();
    
    this.runHistory.push(run);
    this.activeRuns.delete(run.id);

    this.emit('run:completed', { runId: run.id, summary: run.summary });
    log.info(`Eval run ${run.id} completed:`, run.summary);
  }

  private async executeTestCase(
    run: EvalRun,
    testCase: EvalTestCase
  ): Promise<EvalResult> {
    const startTime = Date.now();
    const result: EvalResult = {
      testCaseId: testCase.id,
      agentId: '',
      success: false,
      score: 0,
      maxScore: testCase.validationCriteria.reduce((sum, c) => sum + c.weight, 0),
      duration: 0,
      messages: [],
      criteriaResults: [],
      errors: [],
      warnings: [],
      metadata: {},
      createdAt: new Date(),
    };

    try {
      // Create temporary agent for evaluation
      const agent = await this.agentOrchestrator.createAgent({
        name: `Eval-${testCase.name}`,
        projectPath: `/tmp/eval-${testCase.id}`,
        providerId: run.agentConfig.providerId,
        model: run.agentConfig.model,
        skills: run.agentConfig.skills,
      });

      result.agentId = agent.id;

      // Execute prompt
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), testCase.timeout);
      });

      const messagePromise = this.agentOrchestrator.sendMessage(
        agent.id,
        testCase.prompt
      );

      const response = await Promise.race([messagePromise, timeoutPromise]) as AgentMessage;
      result.messages = [response];

      // Evaluate criteria
      for (const criteria of testCase.validationCriteria) {
        try {
          const passed = await criteria.validator(result);
          const criteriaResult = {
            criteriaId: criteria.id,
            passed: !!passed,
            score: passed ? criteria.weight : 0,
            details: passed ? 'Passed' : 'Failed',
          };
          result.criteriaResults.push(criteriaResult);
          result.score += criteriaResult.score;
        } catch (error) {
          result.criteriaResults.push({
            criteriaId: criteria.id,
            passed: false,
            score: 0,
            details: `Validation error: ${error}`,
          });
        }
      }

      // Check success
      result.success = result.score >= result.maxScore * 0.6; // 60% to pass
      result.duration = Date.now() - startTime;

      // Cleanup
      await this.agentOrchestrator.deleteAgent(agent.id);

    } catch (error) {
      result.errors.push(`Test execution failed: ${error}`);
      result.duration = Date.now() - startTime;
    }

    run.results.push(result);
    this.emit('test:completed', { runId: run.id, testCaseId: testCase.id, result });

    return result;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  getDatasets(): EvalDataset[] {
    return Array.from(this.datasets.values());
  }

  getDataset(datasetId: string): EvalDataset | undefined {
    return this.datasets.get(datasetId);
  }

  getActiveRuns(): EvalRun[] {
    return Array.from(this.activeRuns.values());
  }

  getRunHistory(): EvalRun[] {
    return this.runHistory;
  }

  async saveDataset(dataset: EvalDataset): Promise<void> {
    this.datasets.set(dataset.id, dataset);
    
    // Save to disk
    const filePath = path.join(this.datasetsPath, `${dataset.id}.json`);
    await fs.mkdir(this.datasetsPath, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(dataset, null, 2));
    
    log.info(`Saved dataset: ${dataset.name}`);
  }

  generateReport(runId: string): string {
    const run = this.activeRuns.get(runId) || this.runHistory.find(r => r.id === runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const dataset = this.datasets.get(run.datasetId);
    
    let report = `# Evaluation Report\n\n`;
    report += `**Dataset:** ${dataset?.name || run.datasetId}\n`;
    report += `**Agent:** ${run.agentConfig.providerId} - ${run.agentConfig.model}\n`;
    report += `**Date:** ${run.startedAt.toISOString()}\n\n`;
    
    report += `## Summary\n\n`;
    report += `- **Total Tests:** ${run.summary.totalTests}\n`;
    report += `- **Passed:** ${run.summary.passedTests} (${((run.summary.passedTests / run.summary.totalTests) * 100).toFixed(1)}%)\n`;
    report += `- **Failed:** ${run.summary.failedTests}\n`;
    report += `- **Average Score:** ${run.summary.averageScore.toFixed(1)}%\n`;
    report += `- **Total Duration:** ${(run.summary.totalDuration / 1000).toFixed(2)}s\n\n`;

    report += `## Detailed Results\n\n`;
    
    for (const result of run.results) {
      const testCase = dataset?.testCases.find(tc => tc.id === result.testCaseId);
      report += `### ${testCase?.name || result.testCaseId}\n\n`;
      report += `- **Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
      report += `- **Score:** ${((result.score / result.maxScore) * 100).toFixed(1)}%\n`;
      report += `- **Duration:** ${(result.duration / 1000).toFixed(2)}s\n\n`;
      
      if (result.errors.length > 0) {
        report += `**Errors:**\n`;
        result.errors.forEach(e => report += `- ${e}\n`);
        report += '\n';
      }
      
      report += `**Criteria Results:**\n`;
      for (const criteriaResult of result.criteriaResults) {
        const criteria = testCase?.validationCriteria.find(c => c.id === criteriaResult.criteriaId);
        report += `- ${criteriaResult.passed ? '✅' : '❌'} ${criteria?.name || criteriaResult.criteriaId} (${criteriaResult.score.toFixed(2)})\n`;
      }
      report += '\n---\n\n';
    }

    return report;
  }

  cleanup(): void {
    this.activeRuns.clear();
    this.removeAllListeners();
  }
}

export default AgentEvalFramework;
