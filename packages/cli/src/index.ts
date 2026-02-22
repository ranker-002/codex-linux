#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { AgentCommands } from './commands/agents';
import { TaskCommands } from './commands/tasks';
import { ConfigCommands } from './commands/config';

const program = new Command();

program
  .name('codex')
  .description('CLI tool for Codex Linux - Multi-agent AI coding command center')
  .version('1.0.0');

// Global options
program
  .option('-h, --host <host>', 'API host', 'localhost')
  .option('-p, --port <port>', 'API port', '3001')
  .option('-k, --api-key <key>', 'API key')
  .option('-v, --verbose', 'Enable verbose logging');

// Agent commands
program
  .command('agents')
  .description('Manage agents')
  .addCommand(AgentCommands.list)
  .addCommand(AgentCommands.create)
  .addCommand(AgentCommands.get)
  .addCommand(AgentCommands.delete)
  .addCommand(AgentCommands.chat);

// Task commands
program
  .command('task')
  .description('Execute tasks')
  .argument('<agent-id>', 'Agent ID')
  .argument('<task>', 'Task description')
  .option('-w, --watch', 'Watch task progress')
  .action(TaskCommands.execute);

// Config commands
program
  .command('config')
  .description('Manage configuration')
  .addCommand(ConfigCommands.set)
  .addCommand(ConfigCommands.get)
  .addCommand(ConfigCommands.list);

// Quick commands
program
  .command('chat <agent-id>')
  .description('Start interactive chat with agent')
  .action(async (agentId, options) => {
    await AgentCommands.chatInteractive(agentId, options);
  });

program
  .command('status')
  .description('Check server status')
  .action(async (options) => {
    try {
      const { getAPIClient } = await import('./utils/api');
      const api = getAPIClient(options);
      const response = await api.get('/health');
      
      if (response.data.status === 'ok') {
        console.log(chalk.green('✓'), 'Server is running');
        console.log(chalk.gray('  Timestamp:'), response.data.timestamp);
      } else {
        console.log(chalk.red('✗'), 'Server returned unexpected status');
      }
    } catch (error) {
      console.log(chalk.red('✗'), 'Cannot connect to server');
      console.log(chalk.gray('  Error:'), (error as Error).message);
      process.exit(1);
    }
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str)),
});

program.exitOverride();

try {
  program.parse();
} catch (err) {
  // Commander handles errors internally
}