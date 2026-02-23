import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import log from 'electron-log';
import { SlashCommand, SlashCommandResult, Hook, HookExecution } from '../../shared/types';

const DEFAULT_COMMANDS: SlashCommand[] = [
  {
    id: 'new',
    name: 'new',
    description: 'Create a new agent',
    usage: '/new [name] [--model gpt-4o] [--provider openai]',
    aliases: ['create', 'n'],
    execute: async (args: string) => {
      return {
        success: true,
        message: `Creating new agent: ${args}`,
      };
    },
  },
  {
    id: 'list',
    name: 'list',
    description: 'List all agents',
    usage: '/list [--status running]',
    aliases: ['ls', 'l'],
    execute: async () => {
      return { success: true, message: 'Listing agents...' };
    },
  },
  {
    id: 'kill',
    name: 'kill',
    description: 'Stop an agent',
    usage: '/kill <agent-id>',
    aliases: ['stop', 'k'],
    execute: async (args: string) => {
      return { success: true, message: `Killing agent: ${args}` };
    },
  },
  {
    id: 'switch',
    name: 'switch',
    description: 'Switch to a different agent',
    usage: '/switch <agent-id>',
    aliases: ['sw', 's'],
    execute: async (args: string) => {
      return { success: true, message: `Switching to: ${args}` };
    },
  },
  {
    id: 'status',
    name: 'status',
    description: 'Show current agent status',
    usage: '/status',
    aliases: ['st'],
    execute: async () => {
      return { success: true, message: 'Agent status: running' };
    },
  },
  {
    id: 'run',
    name: 'run',
    description: 'Run a shell command in agent context',
    usage: '/run <command>',
    aliases: ['exec', '!'],
    execute: async (args: string) => {
      return { success: true, output: `Would execute: ${args}` };
    },
  },
  {
    id: 'read',
    name: 'read',
    description: 'Read a file',
    usage: '/read <filepath>',
    aliases: ['cat', 'r'],
    execute: async (args: string) => {
      return { success: true, message: `Reading file: ${args}` };
    },
  },
  {
    id: 'edit',
    name: 'edit',
    description: 'Edit a file',
    usage: '/edit <filepath> [--line N] [--insert-before/after]',
    aliases: ['e'],
    execute: async (args: string) => {
      return { success: true, message: `Editing file: ${args}` };
    },
  },
  {
    id: 'mcp',
    name: 'mcp',
    description: 'Manage MCP servers',
    usage: '/mcp [list|add|remove|start|stop] [args...]',
    execute: async (args: string) => {
      return { success: true, message: `MCP: ${args}` };
    },
  },
  {
    id: 'skills',
    name: 'skills',
    description: 'Manage skills',
    usage: '/skills [list|add|remove] [args...]',
    execute: async (args: string) => {
      return { success: true, message: `Skills: ${args}` };
    },
  },
  {
    id: 'context',
    name: 'context',
    description: 'Manage context',
    usage: '/context [compact|clear|stats]',
    aliases: ['ctx'],
    execute: async (args: string) => {
      return { success: true, message: `Context: ${args}` };
    },
  },
  {
    id: 'review',
    name: 'review',
    description: 'Review changes',
    usage: '/review [--diff] [--approve|--reject]',
    execute: async (args: string) => {
      return { success: true, message: `Review: ${args}` };
    },
  },
];

export class SlashCommandManager extends EventEmitter {
  private commands: Map<string, SlashCommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private hooks: Map<string, Hook> = new Map();
  private hookHistory: HookExecution[] = [];
  private customCommandsPath: string;

  constructor(customCommandsPath?: string) {
    super();
    this.customCommandsPath = customCommandsPath || path.join(process.cwd(), 'commands');
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    for (const command of DEFAULT_COMMANDS) {
      this.registerCommand(command);
    }
    log.info(`Registered ${DEFAULT_COMMANDS.length} default slash commands`);
  }

  registerCommand(command: SlashCommand): void {
    this.commands.set(command.name, command);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }

    this.emit('command:registered', command);
    log.info(`Registered slash command: ${command.name}`);
  }

  unregisterCommand(name: string): boolean {
    const command = this.commands.get(name);
    if (!command) return false;

    this.commands.delete(name);
    
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.delete(alias);
      }
    }

    this.emit('command:unregistered', name);
    return true;
  }

  async execute(input: string, context: any): Promise<SlashCommandResult> {
    // Parse command and args
    const parts = input.slice(1).trim().split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = parts.slice(1).join(' ');

    if (!commandName) {
      return { success: false, error: 'No command specified' };
    }

    // Resolve alias
    const resolvedName = this.aliases.get(commandName) || commandName;
    const command = this.commands.get(resolvedName);

    if (!command) {
      return { success: false, error: `Unknown command: ${commandName}` };
    }

    // Execute pre hooks
    const preResult = await this.executeHooks('pre', command.name, { args, context });
    if (preResult && !preResult.success) {
      return preResult;
    }

    try {
      const result = await command.execute(args, context);
      
      // Execute post hooks
      await this.executeHooks('post', command.name, { args, context, result });
      
      return result;
    } catch (error: any) {
      const errorResult: SlashCommandResult = {
        success: false,
        error: error.message,
      };
      
      // Execute error hooks
      await this.executeHooks('post', command.name, { args, context, error: error.message });
      
      return errorResult;
    }
  }

  getCommand(name: string): SlashCommand | undefined {
    const resolvedName = this.aliases.get(name) || name;
    return this.commands.get(resolvedName);
  }

  getAllCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  getCommandsByCategory(): Map<string, SlashCommand[]> {
    // Group commands by first letter for now
    const categories = new Map<string, SlashCommand[]>();
    
    for (const command of this.commands.values()) {
      const letter = command.name[0].toUpperCase();
      if (!categories.has(letter)) {
        categories.set(letter, []);
      }
      categories.get(letter)!.push(command);
    }
    
    return categories;
  }

  // Hooks management
  registerHook(hook: Hook): void {
    this.hooks.set(hook.id, hook);
    this.emit('hook:registered', hook);
    log.info(`Registered hook: ${hook.name} (${hook.trigger} ${hook.event})`);
  }

  unregisterHook(hookId: string): boolean {
    const deleted = this.hooks.delete(hookId);
    if (deleted) {
      this.emit('hook:unregistered', hookId);
    }
    return deleted;
  }

  getHooks(event?: string, trigger?: 'pre' | 'post'): Hook[] {
    let hooks = Array.from(this.hooks.values());
    
    if (event) {
      hooks = hooks.filter(h => h.event === event);
    }
    
    if (trigger) {
      hooks = hooks.filter(h => h.trigger === trigger);
    }
    
    return hooks.filter(h => h.enabled);
  }

  private async executeHooks(
    trigger: 'pre' | 'post',
    event: string,
    data: { args: string; context: any; result?: any; error?: string }
  ): Promise<SlashCommandResult | null> {
    const hooks = this.getHooks(event, trigger);

    for (const hook of hooks) {
      const execution: HookExecution = {
        hookId: hook.id,
        event,
        trigger,
        startTime: new Date(),
        success: false,
      };

      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        const { stdout, stderr } = await execAsync(hook.command, {
          cwd: process.cwd(),
          timeout: hook.timeout || 30000,
          env: {
            ...process.env,
            CODEX_EVENT: event,
            CODEX_TRIGGER: trigger,
            CODEX_ARGS: data.args,
            CODEX_RESULT: JSON.stringify(data.result || {}),
            CODEX_ERROR: data.error || '',
          },
        });

        execution.success = true;
        execution.output = stdout || stderr;
        
        this.emit('hook:success', execution);
      } catch (error: any) {
        execution.success = false;
        execution.error = error.message;
        
        this.emit('hook:error', execution);
        
        // Pre hooks can block execution
        if (trigger === 'pre') {
          return {
            success: false,
            error: `Hook "${hook.name}" failed: ${error.message}`,
          };
        }
      }

      execution.endTime = new Date();
      this.hookHistory.push(execution);
    }

    return null;
  }

  getHookHistory(limit?: number): HookExecution[] {
    if (limit) {
      return this.hookHistory.slice(-limit);
    }
    return [...this.hookHistory];
  }

  // Load custom commands from file system
  async loadCustomCommands(commandsPath: string): Promise<number> {
    try {
      const files = await fs.readdir(commandsPath);
      let loaded = 0;

      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          try {
            const commandPath = path.join(commandsPath, file);
            const command = require(commandPath);
            
            if (command.default) {
              this.registerCommand(command.default);
              loaded++;
            }
          } catch (error) {
            log.warn(`Failed to load command from ${file}:`, error);
          }
        }
      }

      log.info(`Loaded ${loaded} custom commands from ${commandsPath}`);
      return loaded;
    } catch (error) {
      log.warn('No custom commands found:', error);
      return 0;
    }
  }

  cleanup(): void {
    this.commands.clear();
    this.aliases.clear();
    this.hooks.clear();
    this.hookHistory = [];
    this.removeAllListeners();
  }
}

export default SlashCommandManager;
