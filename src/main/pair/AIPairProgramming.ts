import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { AgentOrchestrator } from '../agents/AgentOrchestrator';
import { AIProviderManager } from '../providers/AIProviderManager';
import { SmartCodeAssistant } from '../assistant/SmartCodeAssistant';
import { Agent, AgentMessage } from '../../shared/types';

interface PairSession {
  id: string;
  agentId: string;
  userId: string;
  status: 'active' | 'paused' | 'ended';
  context: {
    currentFile: string;
    cursorPosition: { line: number; column: number };
    selectedCode?: string;
    openFiles: string[];
  };
  mode: 'collaborative' | 'teacher' | 'reviewer';
  suggestions: Array<{
    id: string;
    type: 'completion' | 'fix' | 'refactor' | 'question';
    content: string;
    accepted: boolean;
  }>;
}

export class AIPairProgramming extends EventEmitter {
  private sessions: Map<string, PairSession> = new Map();
  private agentOrchestrator: AgentOrchestrator;
  private aiProviderManager: AIProviderManager;
  private smartAssistant: SmartCodeAssistant;

  constructor(
    agentOrchestrator: AgentOrchestrator,
    aiProviderManager: AIProviderManager
  ) {
    super();
    this.agentOrchestrator = agentOrchestrator;
    this.aiProviderManager = aiProviderManager;
    this.smartAssistant = new SmartCodeAssistant(aiProviderManager);
  }

  async startSession(
    projectPath: string,
    mode: PairSession['mode'] = 'collaborative',
    userId: string
  ): Promise<PairSession> {
    const sessionId = uuidv4();

    // Create AI pair programmer agent
    const agent = await this.agentOrchestrator.createAgent({
      name: `Pair Programmer - ${mode}`,
      projectPath,
      providerId: 'openai',
      model: 'gpt-4o',
      skills: ['refactoring', 'testing', 'code-review'],
    });

    // Configure agent based on mode
    const systemPrompt = this.getSystemPromptForMode(mode);
    await this.agentOrchestrator.sendMessage(agent.id, systemPrompt);

    const session: PairSession = {
      id: sessionId,
      agentId: agent.id,
      userId,
      status: 'active',
      context: {
        currentFile: '',
        cursorPosition: { line: 0, column: 0 },
        openFiles: [],
      },
      mode,
      suggestions: [],
    };

    this.sessions.set(sessionId, session);
    this.emit('session:started', session);

    log.info(`AI Pair Programming session started: ${sessionId} (${mode})`);
    return session;
  }

  private getSystemPromptForMode(mode: PairSession['mode']): string {
    const prompts = {
      collaborative: `You are a collaborative pair programmer. Work with the user as an equal partner:
- Suggest improvements and alternatives
- Ask clarifying questions
- Challenge assumptions constructively
- Share knowledge and explain your reasoning
- Help debug issues together`,

      teacher: `You are a programming mentor. Help the user learn and improve:
- Explain concepts clearly
- Suggest best practices
- Provide learning resources
- Break down complex problems
- Encourage good habits`,

      reviewer: `You are a code reviewer. Help improve code quality:
- Identify potential issues
- Suggest optimizations
- Check for security concerns
- Ensure test coverage
- Maintain consistency`,
    };

    return prompts[mode];
  }

  async updateContext(
    sessionId: string,
    context: Partial<PairSession['context']>
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.context = { ...session.context, ...context };

    // Trigger proactive suggestions
    if (context.selectedCode) {
      await this.provideProactiveSuggestion(session);
    }
  }

  private async provideProactiveSuggestion(session: PairSession): Promise<void> {
    if (!session.context.selectedCode) return;

    try {
      const prompt = `The user has selected this code:

\`\`\`
${session.context.selectedCode}
\`\`\`

Current file: ${session.context.currentFile}

As a ${session.mode} pair programmer, provide a brief, helpful suggestion or insight. Keep it concise (1-2 sentences).`;

      const provider = this.aiProviderManager.getActiveProviderInstance();
      if (!provider) return;

      const response = await provider.sendMessage('gpt-4o-mini', [
        { role: 'system', content: 'You are a helpful pair programmer.' },
        { role: 'user', content: prompt },
      ] as Array<{ role: string; content: string }>);

      const suggestion = {
        id: uuidv4(),
        type: 'question' as const,
        content: response.content,
        accepted: false,
      };

      session.suggestions.push(suggestion);
      this.emit('suggestion:available', { sessionId: session.id, suggestion });
    } catch (error) {
      log.error('Failed to provide proactive suggestion:', error);
    }
  }

  async chat(sessionId: string, message: string): Promise<AgentMessage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    // Enhance message with context
    const enhancedMessage = this.enhanceMessageWithContext(message, session);

    const response = await this.agentOrchestrator.sendMessage(
      session.agentId,
      enhancedMessage
    );

    this.emit('message:received', { sessionId, message: response });
    return response;
  }

  private enhanceMessageWithContext(
    message: string,
    session: PairSession
  ): string {
    let context = '';

    if (session.context.currentFile) {
      context += `\n\nCurrent file: ${session.context.currentFile}`;
      context += `\nCursor position: Line ${session.context.cursorPosition.line}, Column ${session.context.cursorPosition.column}`;
    }

    if (session.context.selectedCode) {
      context += `\n\nSelected code:\n\`\`\`\n${session.context.selectedCode}\n\`\`\``;
    }

    return message + context;
  }

  async requestInlineCompletion(
    sessionId: string,
    filePath: string,
    content: string,
    position: { line: number; column: number }
  ): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return this.smartAssistant.provideInlineCompletion(
      filePath,
      content,
      position
    ).then(result => result?.text || null);
  }

  async suggestRefactoring(
    sessionId: string,
    code: string,
    goal: string
  ): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    return this.smartAssistant.refactorSuggestion(
      session.context.currentFile,
      code,
      goal
    );
  }

  async explainSelectedCode(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    if (!session.context.selectedCode) {
      return 'No code selected. Please select some code first.';
    }

    return this.smartAssistant.explainCode(
      session.context.selectedCode,
      'detailed'
    );
  }

  acceptSuggestion(sessionId: string, suggestionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const suggestion = session.suggestions.find(s => s.id === suggestionId);
    if (suggestion) {
      suggestion.accepted = true;
      this.emit('suggestion:accepted', { sessionId, suggestionId });
    }
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'ended';
    await this.agentOrchestrator.deleteAgent(session.agentId);

    // Generate session summary
    const summary = await this.generateSessionSummary(session);

    this.sessions.delete(sessionId);
    this.emit('session:ended', { sessionId, summary });

    log.info(`AI Pair Programming session ended: ${sessionId}`);
  }

  private async generateSessionSummary(session: PairSession): Promise<string> {
    const accepted = session.suggestions.filter(s => s.accepted).length;
    const total = session.suggestions.length;

    return `Session Summary:
- Mode: ${session.mode}
- Duration: Active
- Suggestions: ${accepted}/${total} accepted
- Files worked on: ${session.context.openFiles.join(', ') || 'None'}`;
  }

  getSession(sessionId: string): PairSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(): PairSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === 'active'
    );
  }
}