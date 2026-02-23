import { EventEmitter } from 'events';
import log from 'electron-log';
import { AIProviderManager } from '../providers/AIProviderManager';
import {
  PromptAnalysis,
  PromptImprovement,
  PromptTemplate,
  PromptOptimizationOptions,
  PromptTestResult,
  PromptVersion
} from '../../shared/types';

const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Comprehensive code review with best practices',
    category: 'Development',
    template: `Review the following code for the {{language}} project:

Context: {{context}}
Code to review:
\`\`\`
{{code}}
\`\`\`

Please evaluate:
1. Code quality and readability
2. Performance considerations
3. Security vulnerabilities
4. Best practices adherence
5. Potential bugs or edge cases
6. Documentation quality

Provide specific, actionable feedback with line numbers where applicable.`,
    variables: ['language', 'context', 'code'],
    tags: ['code-review', 'development', 'quality'],
  },
  {
    id: 'refactor',
    name: 'Code Refactoring',
    description: 'Suggest improvements and refactoring options',
    category: 'Development',
    template: `Refactor the following {{language}} code:

Current implementation:
\`\`\`
{{code}}
\`\`\`

Goals:
{{goals}}

Provide:
1. Explanation of current issues
2. Refactored code with improvements
3. Explanation of changes made
4. Trade-offs considered`,
    variables: ['language', 'code', 'goals'],
    tags: ['refactoring', 'development', 'improvement'],
  },
  {
    id: 'test-generation',
    name: 'Test Generation',
    description: 'Generate comprehensive test cases',
    category: 'Testing',
    template: `Generate tests for the following {{language}} code:

Code to test:
\`\`\`
{{code}}
\`\`\`

Requirements:
- Test framework: {{framework}}
- Coverage goal: {{coverage}}

Include:
1. Unit tests for main functions
2. Edge case tests
3. Error handling tests
4. Integration tests if applicable`,
    variables: ['language', 'code', 'framework', 'coverage'],
    tags: ['testing', 'development', 'quality'],
  },
  {
    id: 'bug-fix',
    name: 'Bug Fix',
    description: 'Analyze and fix bugs with root cause analysis',
    category: 'Development',
    template: `Analyze and fix the following bug:

Error message:
{{error}}

Problematic code:
\`\`\`
{{code}}
\`\`\`

Stack trace:
\`\`\`
{{stackTrace}}
\`\`\`

Provide:
1. Root cause analysis
2. Fixed code
3. Explanation of the fix
4. Prevention recommendations`,
    variables: ['error', 'code', 'stackTrace'],
    tags: ['bug', 'debugging', 'fix'],
  },
  {
    id: 'documentation',
    name: 'Documentation Generation',
    description: 'Generate comprehensive documentation',
    category: 'Documentation',
    template: `Generate documentation for:

Code to document:
\`\`\`
{{code}}
\`\`\`

Documentation type: {{docType}}
Audience: {{audience}}

Include:
1. Overview/purpose
2. Function/class descriptions
3. Parameter descriptions
4. Return values
5. Usage examples
6. Edge cases and limitations`,
    variables: ['code', 'docType', 'audience'],
    tags: ['documentation', 'api', 'reference'],
  },
  {
    id: 'architecture',
    name: 'Architecture Design',
    description: 'Design system architecture',
    category: 'Architecture',
    template: `Design architecture for: {{system}}

Requirements:
{{requirements}}

Constraints:
{{constraints}}

Provide:
1. High-level architecture diagram (text-based)
2. Component breakdown
3. Data flow
4. Technology recommendations
5. Scalability considerations`,
    variables: ['system', 'requirements', 'constraints'],
    tags: ['architecture', 'design', 'system'],
  },
];

interface PromptVariant {
  id: string;
  name: string;
  prompt: string;
  usage: number;
  success: number;
  avgResponseLength: number;
}

interface PromptTest {
  id: string;
  originalPrompt: string;
  variants: PromptVariant[];
  testCases: string[];
  winner?: string;
}

export class PromptOptimizer extends EventEmitter {
  private aiProviderManager: AIProviderManager | null = null;
  private tests: Map<string, PromptTest> = new Map();
  private promptHistory: Map<string, PromptVersion[]> = new Map();
  private testResults: Map<string, PromptTestResult[]> = new Map();

  constructor(aiProviderManager?: AIProviderManager) {
    super();
    this.aiProviderManager = aiProviderManager || null;
  }

  setAIProvider(aiProviderManager: AIProviderManager): void {
    this.aiProviderManager = aiProviderManager;
  }

  async suggestImprovements(prompt: string): Promise<string[]> {
    // If AI provider available, use it for advanced analysis
    if (this.aiProviderManager) {
      try {
        const analysis = await this.analyzeWithAI(prompt);
        return analysis.suggestions;
      } catch (error) {
        log.warn('PromptOptimizer: AI analysis failed, using basic suggestions');
      }
    }

    // Fallback to basic suggestions
    const suggestions: string[] = [];

    if (prompt.length < 50) {
      suggestions.push('Add more context to get better results');
    }

    if (!prompt.includes('example') && !prompt.includes('Example')) {
      suggestions.push('Consider adding examples to clarify expectations');
    }

    if (!prompt.includes('step') && !prompt.includes('Step')) {
      suggestions.push('Break complex tasks into numbered steps');
    }

    const vagueTerms = ['some', 'thing', 'stuff', 'good', 'bad', 'nice'];
    const hasVagueTerms = vagueTerms.some(term => 
      prompt.toLowerCase().includes(term)
    );
    if (hasVagueTerms) {
      suggestions.push('Replace vague terms with specific descriptions');
    }

    if (!prompt.includes('format') && !prompt.includes('output')) {
      suggestions.push('Specify desired output format (JSON, markdown, etc.)');
    }

    return suggestions;
  }

  async analyzePrompt(prompt: string): Promise<PromptAnalysis> {
    if (!this.aiProviderManager) {
      return this.basicAnalysis(prompt);
    }

    return this.analyzeWithAI(prompt);
  }

  private async analyzeWithAI(prompt: string): Promise<PromptAnalysis> {
    const provider = this.aiProviderManager!.getActiveProviderInstance();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const analysisPrompt = `Analyze the following prompt and provide a detailed analysis:

Prompt: "${prompt}"

Respond in JSON format:
{
  "clarity": <score 0-100>,
  "specificity": <score 0-100>,
  "context": <score 0-100>,
  "structure": <score 0-100>,
  "overall": <score 0-100>,
  "improvements": [
    {
      "type": "clarity|specificity|context|structure|examples|constraints",
      "description": "<description>",
      "before": "<original text>",
      "after": "<improved text>",
      "impact": "high|medium|low"
    }
  ],
  "suggestions": ["<suggestion1>", "<suggestion2>"],
  "estimatedTokens": <estimated token count>
}`;

    try {
      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are a prompt engineering expert. Analyze prompts and provide structured feedback in JSON format.' },
        { role: 'user', content: analysisPrompt }
      ] as Array<{ role: string; content: string }>);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        
        return {
          originalPrompt: prompt,
          optimizedPrompt: prompt,
          improvements: analysis.improvements || [],
          metrics: {
            clarity: analysis.clarity || 50,
            specificity: analysis.specificity || 50,
            context: analysis.context || 50,
            structure: analysis.structure || 50,
            overall: analysis.overall || 50,
          },
          estimatedTokens: analysis.estimatedTokens || this.estimateTokens(prompt),
          suggestions: analysis.suggestions || [],
        };
      }
    } catch (error) {
      log.error('PromptOptimizer: Analysis failed:', error);
    }

    return this.basicAnalysis(prompt);
  }

  async optimizePrompt(
    prompt: string,
    options: PromptOptimizationOptions = {}
  ): Promise<PromptAnalysis> {
    if (!this.aiProviderManager) {
      return this.basicAnalysis(prompt);
    }

    const provider = this.aiProviderManager.getActiveProviderInstance();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const styleInstructions: Record<string, string> = {
      concise: 'Be extremely concise. Use minimal words.',
      detailed: 'Provide maximum detail and thoroughness.',
      technical: 'Use technical terminology and precise language.',
      conversational: 'Write in a friendly, conversational tone.',
    };

    const optimizationPrompt = `Optimize the following prompt for better results from an AI.

Original prompt: "${prompt}"

${options.goal ? `Goal: ${options.goal}` : ''}
${options.targetModel ? `Target model: ${options.targetModel}` : ''}
${options.style ? `Style: ${styleInstructions[options.style]}` : ''}
${options.maxLength ? `Maximum length: ${options.maxLength} characters` : ''}

Requirements:
${options.addExamples ? '- Add relevant examples to clarify expectations' : ''}
${options.addConstraints ? '- Add specific constraints and requirements' : ''}
${options.improveStructure ? '- Improve the structure and organization' : ''}

Respond in JSON format:
{
  "optimizedPrompt": "<the optimized prompt>",
  "improvements": [
    {
      "type": "clarity|specificity|context|structure|examples|constraints",
      "description": "<what was improved>",
      "before": "<original text>",
      "after": "<improved text>",
      "impact": "high|medium|low"
    }
  ],
  "metrics": {
    "clarity": <0-100>,
    "specificity": <0-100>,
    "context": <0-100>,
    "structure": <0-100>,
    "overall": <0-100>
  },
  "suggestions": ["<additional suggestion>"]
}`;

    try {
      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are a prompt engineering expert. Optimize prompts to get better results from AI models.' },
        { role: 'user', content: optimizationPrompt }
      ] as Array<{ role: string; content: string }>);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        
        return {
          originalPrompt: prompt,
          optimizedPrompt: result.optimizedPrompt || prompt,
          improvements: result.improvements || [],
          metrics: result.metrics || {
            clarity: 70,
            specificity: 70,
            context: 70,
            structure: 70,
            overall: 70,
          },
          estimatedTokens: this.estimateTokens(result.optimizedPrompt || prompt),
          suggestions: result.suggestions || [],
        };
      }
    } catch (error) {
      log.error('PromptOptimizer: Optimization failed:', error);
    }

    return this.basicAnalysis(prompt);
  }

  async generatePrompt(
    templateId: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let prompt = template.template;
    for (const [key, value] of Object.entries(variables)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return prompt;
  }

  getTemplates(category?: string): PromptTemplate[] {
    if (category) {
      return PROMPT_TEMPLATES.filter(t => t.category === category);
    }
    return PROMPT_TEMPLATES;
  }

  getTemplateCategories(): string[] {
    return [...new Set(PROMPT_TEMPLATES.map(t => t.category))];
  }

  async savePromptVersion(
    promptId: string,
    prompt: string,
    tags: string[] = [],
    notes?: string
  ): Promise<PromptVersion> {
    const version: PromptVersion = {
      id: `${promptId}_${Date.now()}`,
      prompt,
      version: (this.promptHistory.get(promptId)?.length || 0) + 1,
      timestamp: new Date(),
      tags,
      notes,
    };

    if (!this.promptHistory.has(promptId)) {
      this.promptHistory.set(promptId, []);
    }
    this.promptHistory.get(promptId)!.push(version);

    log.info(`PromptOptimizer: Saved version ${version.version} for prompt ${promptId}`);
    return version;
  }

  getPromptHistory(promptId: string): PromptVersion[] {
    return this.promptHistory.get(promptId) || [];
  }

  async testPrompt(
    prompt: string,
    testInput?: string
  ): Promise<PromptTestResult> {
    if (!this.aiProviderManager) {
      throw new Error('AI provider not available for testing');
    }

    log.info('PromptOptimizer: Testing prompt...');

    const provider = this.aiProviderManager.getActiveProviderInstance();
    if (!provider) {
      throw new Error('No AI provider available');
    }

    const startTime = Date.now();
    
    try {
      const messages = testInput
        ? [
            { role: 'user' as const, content: prompt },
            { role: 'user' as const, content: testInput }
          ]
        : [{ role: 'user' as const, content: prompt }];

      const response = await provider.sendMessage('gpt-4o', messages as Array<{ role: string; content: string }>);
      
      const latency = Date.now() - startTime;
      const responseText = response.content;
      const tokenUsage = this.estimateTokens(prompt) + this.estimateTokens(responseText);

      const result: PromptTestResult = {
        prompt,
        response: responseText,
        metrics: {
          responseQuality: this.evaluateQuality(responseText),
          relevance: this.evaluateRelevance(prompt, responseText),
          completeness: this.evaluateCompleteness(prompt, responseText),
          tokenUsage,
          latency,
        },
        timestamp: new Date(),
      };

      const promptKey = this.hashString(prompt);
      if (!this.testResults.has(promptKey)) {
        this.testResults.set(promptKey, []);
      }
      this.testResults.get(promptKey)!.push(result);

      return result;
    } catch (error) {
      log.error('PromptOptimizer: Test failed:', error);
      throw error;
    }
  }

  getTestResults(prompt: string): PromptTestResult[] {
    const promptKey = this.hashString(prompt);
    return this.testResults.get(promptKey) || [];
  }

  comparePrompts(promptA: string, promptB: string): {
    winner: 'A' | 'B' | 'tie';
    metricsComparison: Record<string, number>;
  } {
    const resultsA = this.getTestResults(promptA);
    const resultsB = this.getTestResults(promptB);

    if (resultsA.length === 0 && resultsB.length === 0) {
      return { winner: 'tie', metricsComparison: {} };
    }

    const avgMetricsA = this.averageMetrics(resultsA);
    const avgMetricsB = this.averageMetrics(resultsB);

    const scores = {
      A: avgMetricsA.responseQuality + avgMetricsA.relevance + avgMetricsA.completeness - (avgMetricsA.latency / 1000),
      B: avgMetricsB.responseQuality + avgMetricsB.relevance + avgMetricsB.completeness - (avgMetricsB.latency / 1000),
    };

    return {
      winner: scores.A > scores.B ? 'A' : scores.B > scores.A ? 'B' : 'tie',
      metricsComparison: {
        responseQuality: avgMetricsA.responseQuality - avgMetricsB.responseQuality,
        relevance: avgMetricsA.relevance - avgMetricsB.relevance,
        completeness: avgMetricsA.completeness - avgMetricsB.completeness,
        latency: avgMetricsA.latency - avgMetricsB.latency,
        tokenUsage: avgMetricsA.tokenUsage - avgMetricsB.tokenUsage,
      },
    };
  }

  createABTest(originalPrompt: string, variants: string[]): string {
    const testId = `ab-test-${Date.now()}`;
    
    const test: PromptTest = {
      id: testId,
      originalPrompt,
      variants: [
        {
          id: 'original',
          name: 'Original',
          prompt: originalPrompt,
          usage: 0,
          success: 0,
          avgResponseLength: 0
        },
        ...variants.map((variant, index) => ({
          id: `variant-${index}`,
          name: `Variant ${index + 1}`,
          prompt: variant,
          usage: 0,
          success: 0,
          avgResponseLength: 0
        }))
      ],
      testCases: []
    };

    this.tests.set(testId, test);
    log.info(`Created A/B test: ${testId}`);
    
    return testId;
  }

  recordUsage(testId: string, variantId: string, success: boolean, responseLength: number): void {
    const test = this.tests.get(testId);
    if (!test) return;

    const variant = test.variants.find(v => v.id === variantId);
    if (!variant) return;

    variant.usage++;
    if (success) variant.success++;
    
    variant.avgResponseLength = 
      ((variant.avgResponseLength * (variant.usage - 1)) + responseLength) / variant.usage;
  }

  getABTestResults(testId: string): {
    winner?: PromptVariant;
    variants: PromptVariant[];
    confidence: number;
  } | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    const variantsWithRates = test.variants.map(v => ({
      ...v,
      successRate: v.usage > 0 ? v.success / v.usage : 0
    }));

    const winner = variantsWithRates.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );

    const totalUsage = test.variants.reduce((sum, v) => sum + v.usage, 0);
    const confidence = Math.min(1, totalUsage / 100);

    return {
      winner: winner.successRate > 0 ? winner : undefined,
      variants: variantsWithRates,
      confidence
    };
  }

  generateOptimizedPrompt(prompt: string): string {
    let optimized = prompt;

    if (!optimized.includes('#') && optimized.length > 200) {
      optimized = `# Task\n${optimized}`;
    }

    if (!optimized.toLowerCase().includes('output format')) {
      optimized += '\n\n# Output Format\nPlease provide your response in a clear, structured format.';
    }

    return optimized;
  }

  private basicAnalysis(prompt: string): PromptAnalysis {
    const words = prompt.split(/\s+/);
    const hasExamples = prompt.includes('example') || prompt.includes('e.g.');
    const hasContext = prompt.includes('context') || prompt.length > 200;
    const hasStructure = prompt.includes('\n') || prompt.includes('1.') || prompt.includes('•');

    const improvements: PromptImprovement[] = [];

    if (!hasExamples) {
      improvements.push({
        type: 'examples',
        description: 'Add examples to clarify expectations',
        before: prompt,
        after: prompt + '\n\nExample: [add relevant example]',
        impact: 'medium',
      });
    }

    if (!hasContext) {
      improvements.push({
        type: 'context',
        description: 'Add more context about the task',
        before: prompt,
        after: 'Context: [describe background]\n\n' + prompt,
        impact: 'high',
      });
    }

    if (!hasStructure) {
      improvements.push({
        type: 'structure',
        description: 'Structure the prompt with clear sections',
        before: prompt,
        after: `Task: ${prompt}\n\nRequirements:\n- [requirement 1]\n- [requirement 2]`,
        impact: 'medium',
      });
    }

    return {
      originalPrompt: prompt,
      optimizedPrompt: improvements.length > 0 ? improvements[0].after : prompt,
      improvements,
      metrics: {
        clarity: hasStructure ? 70 : 50,
        specificity: words.length > 10 ? 70 : 40,
        context: hasContext ? 70 : 40,
        structure: hasStructure ? 80 : 30,
        overall: 60,
      },
      estimatedTokens: this.estimateTokens(prompt),
      suggestions: improvements.map(i => i.description),
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private evaluateQuality(response: string): number {
    const hasStructure = response.includes('\n') || response.includes(':');
    const isSubstantial = response.length > 100;
    return Math.min(100, (hasStructure ? 40 : 20) + (isSubstantial ? 40 : 20) + 20);
  }

  private evaluateRelevance(prompt: string, response: string): number {
    const promptWords = prompt.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const responseLower = response.toLowerCase();
    const matchedWords = promptWords.filter(w => responseLower.includes(w));
    return Math.min(100, (matchedWords.length / promptWords.length) * 100);
  }

  private evaluateCompleteness(_prompt: string, response: string): number {
    const hasExplanation = response.includes('because') || response.includes('reason');
    const hasDetails = response.length > 200;
    return Math.min(100, (hasExplanation ? 40 : 0) + (hasDetails ? 50 : 30) + 10);
  }

  private averageMetrics(results: PromptTestResult[]): PromptTestResult['metrics'] {
    if (results.length === 0) {
      return {
        responseQuality: 0,
        relevance: 0,
        completeness: 0,
        tokenUsage: 0,
        latency: 0,
      };
    }

    return {
      responseQuality: results.reduce((sum, r) => sum + r.metrics.responseQuality, 0) / results.length,
      relevance: results.reduce((sum, r) => sum + r.metrics.relevance, 0) / results.length,
      completeness: results.reduce((sum, r) => sum + r.metrics.completeness, 0) / results.length,
      tokenUsage: results.reduce((sum, r) => sum + r.metrics.tokenUsage, 0) / results.length,
      latency: results.reduce((sum, r) => sum + r.metrics.latency, 0) / results.length,
    };
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  cleanup(): void {
    this.tests.clear();
    this.promptHistory.clear();
    this.testResults.clear();
    this.removeAllListeners();
  }
}

export default PromptOptimizer;
