import OpenAI from 'openai';
import log from 'electron-log';
import { AgentTools, ToolResult } from './AgentTools';

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export class NativeToolCalling {
  private client: OpenAI | null = null;
  private tools: AgentTools;
  private toolDefinitions: ToolDefinition[];

  constructor(apiKey: string | undefined, worktreePath: string) {
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        timeout: 60000,
        maxRetries: 3
      });
    }
    this.tools = new AgentTools(worktreePath);
    this.toolDefinitions = this.buildToolDefinitions();
  }

  private buildToolDefinitions(): ToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'view',
          description: 'View the contents of a file. Use offset and limit for large files.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file' },
              offset: { type: 'number', description: 'Start line number (1-based)' },
              limit: { type: 'number', description: 'Number of lines to show (max 200)' }
            },
            required: ['file_path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'edit',
          description: 'Edit a file by replacing a specific string. The old_string must match exactly and uniquely.',
          parameters: {
            type: 'object',
            properties: {
              file_path: { type: 'string', description: 'Path to the file' },
              old_string: { type: 'string', description: 'Exact string to replace' },
              new_string: { type: 'string', description: 'Replacement string' }
            },
            required: ['file_path', 'old_string', 'new_string']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'bash',
          description: 'Execute a bash command in the worktree. Use for running tests, builds, git commands, etc.',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Command to execute' },
              timeout: { type: 'number', description: 'Timeout in milliseconds (default 120000)' }
            },
            required: ['command']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'glob',
          description: 'Find files matching a glob pattern (e.g., "**/*.ts").',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Glob pattern' },
              path: { type: 'string', description: 'Directory to search in' }
            },
            required: ['pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'grep',
          description: 'Search for a pattern in file contents using grep.',
          parameters: {
            type: 'object',
            properties: {
              pattern: { type: 'string', description: 'Search pattern' },
              path: { type: 'string', description: 'Directory to search in' },
              include: { type: 'string', description: 'File pattern to include (e.g., "*.ts")' }
            },
            required: ['pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'ls',
          description: 'List the contents of a directory.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Directory path' }
            },
            required: ['path']
          }
        }
      }
    ];
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async executeWithTools(
    model: string,
    systemPrompt: string,
    userPrompt: string,
    onToolCall?: (toolCall: ToolCall, result: ToolResult) => void
  ): Promise<string> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    let iterations = 0;
    const maxIterations = 20;

    while (iterations < maxIterations) {
      iterations++;
      
      log.info(`Tool calling iteration ${iterations}`);

      const response = await this.client.chat.completions.create({
        model,
        messages,
        tools: this.toolDefinitions,
        tool_choice: 'auto',
        max_tokens: 4096
      });

      const message = response.choices[0].message;

      // If no tool calls, we're done
      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message.content || '';
      }

      // Add assistant message with tool calls
      messages.push(message);

      // Execute each tool call
      for (const toolCall of message.tool_calls) {
        const result = await this.executeToolCall(toolCall);
        
        if (onToolCall) {
          onToolCall(toolCall as ToolCall, result);
        }

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.success 
            ? result.output 
            : `Error: ${result.error || 'Unknown error'}`
        });
      }
    }

    throw new Error(`Max iterations (${maxIterations}) reached`);
  }

  private async executeToolCall(toolCall: any): Promise<ToolResult> {
    const { name, arguments: argsString } = toolCall.function;
    
    try {
      const args = JSON.parse(argsString);
      
      log.info(`Executing tool: ${name}`, args);

      switch (name) {
        case 'view':
          return await this.tools.view(args);
        case 'edit':
          return await this.tools.edit(args);
        case 'bash':
          return await this.tools.bash(args);
        case 'glob':
          return await this.tools.glob(args);
        case 'grep':
          return await this.tools.grep(args);
        case 'ls':
          return await this.tools.ls(args);
        default:
          return {
            success: false,
            output: '',
            error: `Unknown tool: ${name}`
          };
      }
    } catch (error) {
      log.error(`Failed to execute tool ${name}:`, error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
