import { EventEmitter } from 'events';
import log from 'electron-log';
import { 
  AgentDefinition, 
  AgentGuardrail, 
  AgentExecutionContext, 
  AgentHandler,
  Agent,
  AgentMessage 
} from '../../shared/types';
import { AIProviderManager } from '../providers/AIProviderManager';

export class AgentSDK extends EventEmitter {
  private handlers: Map<string, AgentHandler> = new Map();
  private guardrails: AgentGuardrail[] = [];
  private providerManager: AIProviderManager;
  private agentDefinitions: Map<string, AgentDefinition> = new Map();

  constructor(providerManager: AIProviderManager) {
    super();
    this.providerManager = providerManager;
  }

  // Register a custom agent definition
  registerAgent(definition: AgentDefinition): void {
    this.agentDefinitions.set(definition.id, definition);
    this.emit('agent:registered', definition);
    log.info(`Registered agent: ${definition.name} (${definition.id})`);
  }

  // Unregister an agent
  unregisterAgent(agentId: string): boolean {
    const deleted = this.agentDefinitions.delete(agentId);
    if (deleted) {
      this.emit('agent:unregistered', agentId);
    }
    return deleted;
  }

  // Get all registered agents
  getAgents(): AgentDefinition[] {
    return Array.from(this.agentDefinitions.values());
  }

  // Get agent by ID
  getAgent(agentId: string): AgentDefinition | undefined {
    return this.agentDefinitions.get(agentId);
  }

  // Register a custom handler (tool)
  registerHandler(handler: AgentHandler): void {
    this.handlers.set(handler.name, handler);
    this.emit('handler:registered', handler);
    log.info(`Registered handler: ${handler.name}`);
  }

  // Unregister a handler
  unregisterHandler(name: string): boolean {
    const deleted = this.handlers.delete(name);
    if (deleted) {
      this.emit('handler:unregistered', name);
    }
    return deleted;
  }

  // Get all handlers
  getHandlers(): AgentHandler[] {
    return Array.from(this.handlers.values());
  }

  // Add guardrail
  addGuardrail(guardrail: AgentGuardrail): void {
    this.guardrails.push(guardrail);
    this.emit('guardrail:added', guardrail);
    log.info(`Added guardrail: ${guardrail.type}`);
  }

  // Remove guardrail
  removeGuardrail(type: string): boolean {
    const index = this.guardrails.findIndex(g => g.type === type);
    if (index > -1) {
      const removed = this.guardrails.splice(index, 1)[0];
      this.emit('guardrail:removed', removed);
      return true;
    }
    return false;
  }

  // Execute agent with custom handler
  async executeWithHandler(
    agent: Agent,
    handlerName: string,
    params: Record<string, any>
  ): Promise<any> {
    const handler = this.handlers.get(handlerName);
    if (!handler) {
      throw new Error(`Handler not found: ${handlerName}`);
    }

    const context: AgentExecutionContext = {
      agentId: agent.id,
      sessionId: agent.id,
      messages: agent.messages,
      metadata: agent.metadata,
    };

    // Apply input guardrails
    for (const guardrail of this.guardrails) {
      if (guardrail.type === 'input_filter' && guardrail.enabled) {
        const filtered = await this.applyGuardrail(guardrail, params);
        params = filtered;
      }
    }

    // Execute handler
    const result = await handler.execute(context, params);

    // Apply output guardrails
    for (const guardrail of this.guardrails) {
      if (guardrail.type === 'output_filter' && guardrail.enabled) {
        const filtered = await this.applyGuardrail(guardrail, result);
        return filtered;
      }
    }

    return result;
  }

  private async applyGuardrail(guardrail: AgentGuardrail, data: any): Promise<any> {
    switch (guardrail.type) {
      case 'input_filter':
        // Apply input filtering
        return this.filterInput(data, guardrail.config);
      case 'output_filter':
        // Apply output filtering
        return this.filterOutput(data, guardrail.config);
      case 'tool_restriction':
        // Check tool permissions
        this.checkToolRestriction(data, guardrail.config);
        return data;
      default:
        return data;
    }
  }

  private filterInput(data: any, config: Record<string, any>): any {
    // Simple input filtering - in production would be more sophisticated
    const blockedPatterns = config.blockedPatterns || [];
    
    if (typeof data === 'string') {
      for (const pattern of blockedPatterns) {
        if (data.includes(pattern)) {
          throw new Error(`Input blocked: contains "${pattern}"`);
        }
      }
    }
    
    return data;
  }

  private filterOutput(data: any, config: Record<string, any>): any {
    // Simple output filtering
    const requiredPatterns = config.requiredPatterns || [];
    const blockedPatterns = config.blockedPatterns || [];

    if (typeof data === 'string') {
      for (const pattern of blockedPatterns) {
        if (data.includes(pattern)) {
          data = data.replace(pattern, '[BLOCKED]');
        }
      }

      if (requiredPatterns.length > 0) {
        const hasRequired = requiredPatterns.some(p => data.includes(p));
        if (!hasRequired) {
          log.warn('Output does not contain required patterns');
        }
      }
    }
    
    return data;
  }

  private checkToolRestriction(action: any, config: Record<string, any>): void {
    const allowedTools = config.allowedTools;
    const deniedTools = config.deniedTools || [];
    const toolName = action.toolName || action.type;

    if (allowedTools && !allowedTools.includes(toolName)) {
      throw new Error(`Tool not allowed: ${toolName}`);
    }

    if (deniedTools.includes(toolName)) {
      throw new Error(`Tool denied: ${toolName}`);
    }
  }

  // Create agent from definition
  async createAgentFromDefinition(
    definitionId: string,
    options: {
      projectPath: string;
      providerId?: string;
      model?: string;
    }
  ): Promise<Partial<Agent>> {
    const definition = this.agentDefinitions.get(definitionId);
    if (!definition) {
      throw new Error(`Agent definition not found: ${definitionId}`);
    }

    const agent: Partial<Agent> = {
      id: `agent_${Date.now()}`,
      name: definition.name,
      projectPath: options.projectPath,
      providerId: options.providerId || definition.provider || 'openai',
      model: options.model || definition.model || 'gpt-4o',
      skills: definition.skills || [],
      messages: [],
      tasks: [],
      metadata: {
        definitionId: definition.id,
        version: definition.version,
        author: definition.author,
      },
    };

    // Add system prompt from definition
    if (definition.systemPrompt) {
      agent.messages = [{
        id: `msg_${Date.now()}`,
        role: 'system',
        content: definition.systemPrompt,
        timestamp: new Date(),
      }];
    }

    this.emit('agent:created', agent);
    return agent;
  }

  // Build system prompt from handlers
  buildHandlerSystemPrompt(): string {
    const parts: string[] = ['## Available Tools'];

    for (const handler of this.handlers.values()) {
      const paramsDesc = handler.parameters
        ? Object.entries(handler.parameters)
            .map(([key, val]) => `- ${key}: ${(val as any).type || 'any'}`)
            .join('\n')
        : 'No parameters';

      parts.push(`### ${handler.name}`);
      parts.push(handler.description);
      parts.push(`Parameters:\n${paramsDesc}`);
    }

    return parts.join('\n\n');
  }

  cleanup(): void {
    this.handlers.clear();
    this.guardrails = [];
    this.agentDefinitions.clear();
    this.removeAllListeners();
  }
}

export default AgentSDK;
