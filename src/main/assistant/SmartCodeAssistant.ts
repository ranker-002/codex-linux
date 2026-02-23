import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import log from 'electron-log';
import { AIProviderManager } from '../providers/AIProviderManager';

interface CodeSuggestion {
  id: string;
  type: 'completion' | 'fix' | 'refactor' | 'explain';
  code: string;
  description: string;
  confidence: number;
  line: number;
  column: number;
  file: string;
}

interface InlineCompletion {
  text: string;
  position: {
    line: number;
    column: number;
  };
}

export class SmartCodeAssistant extends EventEmitter {
  private aiProviderManager: AIProviderManager;
  private currentFile: string = '';
  private currentContent: string = '';
  private cursorPosition: { line: number; column: number } = { line: 0, column: 0 };

  constructor(aiProviderManager: AIProviderManager) {
    super();
    this.aiProviderManager = aiProviderManager;
  }

  async provideInlineCompletion(
    filePath: string,
    content: string,
    position: { line: number; column: number }
  ): Promise<InlineCompletion | null> {
    try {
      this.currentFile = filePath;
      this.currentContent = content;
      this.cursorPosition = position;

      const lines = content.split('\n');
      const currentLine = lines[position.line] || '';
      const contextLines = lines.slice(Math.max(0, position.line - 10), position.line + 1);

      const prompt = `Complete the code at the cursor position. File: ${path.basename(filePath)}

Context:
\`\`\`
${contextLines.join('\n')}
\`\`\`

Current line: "${currentLine}"
Cursor position: column ${position.column}

Provide ONLY the completion text that should be inserted at the cursor. Be concise and context-aware.`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return null;

      const response = await provider.sendMessage('gpt-4o-mini', [
        { role: 'system', content: 'You are a code completion assistant. Provide only the code completion, no explanations.' },
        { role: 'user', content: prompt },
      ] as Array<{ role: string; content: string }>);

      const completion = response.content.trim();
      
      if (completion && completion.length > 0 && completion.length < 100) {
        return {
          text: completion,
          position,
        };
      }

      return null;
    } catch (error) {
      log.error('Failed to provide inline completion:', error);
      return null;
    }
  }

  async suggestFixes(filePath: string, content: string): Promise<CodeSuggestion[]> {
    const suggestions: CodeSuggestion[] = [];

    try {
      const prompt = `Analyze this code and suggest improvements:

File: ${path.basename(filePath)}
\`\`\`
${content}
\`\`\`

Identify:
1. Syntax errors or potential bugs
2. Code smells or anti-patterns
3. Performance improvements
4. Security issues

Return a JSON array of suggestions with: type, line, description, and suggested code fix.`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return suggestions;

      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are a code reviewer. Provide suggestions in JSON format.' },
        { role: 'user', content: prompt },
      ] as Array<{ role: string; content: string }>);

      // Parse JSON response
      try {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          parsed.forEach((suggestion: any, index: number) => {
            suggestions.push({
              id: `suggestion-${index}`,
              type: suggestion.type || 'fix',
              code: suggestion.code || '',
              description: suggestion.description,
              confidence: suggestion.confidence || 0.8,
              line: suggestion.line || 1,
              column: suggestion.column || 0,
              file: filePath,
            });
          });
        }
      } catch (parseError) {
        log.warn('Failed to parse suggestions JSON:', parseError);
      }
    } catch (error) {
      log.error('Failed to suggest fixes:', error);
    }

    return suggestions;
  }

  async generateDocumentation(
    filePath: string,
    code: string,
    selection?: { start: number; end: number }
  ): Promise<string> {
    try {
      const codeToDocument = selection
        ? code.split('\n').slice(selection.start - 1, selection.end).join('\n')
        : code;

      const prompt = `Generate comprehensive documentation for this code:

\`\`\`
${codeToDocument}
\`\`\`

Provide:
1. Function/class documentation (JSDoc/TSDoc style)
2. Parameter descriptions
3. Return value description
4. Usage examples
5. Any important notes or warnings`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return '';

      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are a technical documentation writer.' },
        { role: 'user', content: prompt },
      ] as Array<{ role: string; content: string }>);

      return response.content;
    } catch (error) {
      log.error('Failed to generate documentation:', error);
      return '';
    }
  }

  async explainCode(code: string, detailLevel: 'simple' | 'detailed' = 'simple'): Promise<string> {
    try {
      const prompt = `Explain this code in ${detailLevel} terms:

\`\`\`
${code}
\`\`\`

${detailLevel === 'simple' ? 'Explain it simply for a beginner.' : 'Provide a detailed technical explanation.'}`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return '';

      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are a programming teacher.' },
        { role: 'user', content: prompt },
      ]);

      return response.content;
    } catch (error) {
      log.error('Failed to explain code:', error);
      return '';
    }
  }

  async refactorSuggestion(
    filePath: string,
    code: string,
    goal: string
  ): Promise<string> {
    try {
      const prompt = `Refactor this code to: ${goal}

Original code:
\`\`\`
${code}
\`\`\`

Provide the refactored code with explanations of what changed and why.`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return '';

      const response = await provider.sendMessage('gpt-4o', [
        { role: 'system', content: 'You are an expert code refactorer.' },
        { role: 'user', content: prompt },
      ] as Array<{ role: string; content: string }>);

      return response.content;
    } catch (error) {
      log.error('Failed to suggest refactor:', error);
      return '';
    }
  }
}