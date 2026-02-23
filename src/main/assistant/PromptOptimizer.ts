import { EventEmitter } from 'events';
import log from 'electron-log';

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
  private tests: Map<string, PromptTest> = new Map();

  async suggestImprovements(prompt: string): Promise<string[]> {
    const suggestions: string[] = [];

    // Check for common issues
    if (prompt.length < 50) {
      suggestions.push('Add more context to get better results');
    }

    if (!prompt.includes('example') && !prompt.includes('Example')) {
      suggestions.push('Consider adding examples to clarify expectations');
    }

    if (!prompt.includes('step') && !prompt.includes('Step')) {
      suggestions.push('Break complex tasks into numbered steps');
    }

    // Check for vagueness
    const vagueTerms = ['some', 'thing', 'stuff', 'good', 'bad', 'nice'];
    const hasVagueTerms = vagueTerms.some(term => 
      prompt.toLowerCase().includes(term)
    );
    if (hasVagueTerms) {
      suggestions.push('Replace vague terms with specific descriptions');
    }

    // Check for format specification
    if (!prompt.includes('format') && !prompt.includes('output')) {
      suggestions.push('Specify desired output format (JSON, markdown, etc.)');
    }

    return suggestions;
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
    
    // Update average response length
    variant.avgResponseLength = 
      ((variant.avgResponseLength * (variant.usage - 1)) + responseLength) / variant.usage;
  }

  getTestResults(testId: string): {
    winner?: PromptVariant;
    variants: PromptVariant[];
    confidence: number;
  } | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    // Calculate success rates
    const variantsWithRates = test.variants.map(v => ({
      ...v,
      successRate: v.usage > 0 ? v.success / v.usage : 0
    }));

    // Find winner
    const winner = variantsWithRates.reduce((best, current) => 
      current.successRate > best.successRate ? current : best
    );

    // Calculate confidence (simple statistical significance)
    const totalUsage = test.variants.reduce((sum, v) => sum + v.usage, 0);
    const confidence = Math.min(1, totalUsage / 100); // 100+ uses for full confidence

    return {
      winner: winner.successRate > 0 ? winner : undefined,
      variants: variantsWithRates,
      confidence
    };
  }

  generateOptimizedPrompt(prompt: string): string {
    let optimized = prompt;

    // Add structure if missing
    if (!optimized.includes('#') && optimized.length > 200) {
      optimized = `# Task\n${optimized}`;
    }

    // Add output format hint if missing
    if (!optimized.toLowerCase().includes('output format')) {
      optimized += '\n\n# Output Format\nPlease provide your response in a clear, structured format.';
    }

    return optimized;
  }

  cleanup(): void {
    this.tests.clear();
    this.removeAllListeners();
  }
}

export default PromptOptimizer;
