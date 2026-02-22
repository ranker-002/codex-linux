import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import WebSocket from 'ws';
import { getAPIClient } from '../utils/api';

export const AgentCommands = {
  list: new Command('list')
    .description('List all agents')
    .action(async (options) => {
      const spinner = ora('Loading agents...').start();
      
      try {
        const api = getAPIClient(options);
        const response = await api.get('/agents');
        const agents = response.data;
        
        spinner.stop();
        
        if (agents.length === 0) {
          console.log(chalk.yellow('No agents found'));
          return;
        }
        
        console.log(chalk.bold('\nAgents:'));
        agents.forEach((agent: any) => {
          const statusColor = {
            idle: chalk.gray,
            running: chalk.green,
            paused: chalk.yellow,
            error: chalk.red,
          }[agent.status] || chalk.white;
          
          console.log(`  ${chalk.cyan(agent.id.slice(0, 8))} ${agent.name} ${statusColor(`[${agent.status}]`)}`);
        });
      } catch (error) {
        spinner.fail('Failed to load agents');
        console.error(chalk.red((error as Error).message));
      }
    }),

  create: new Command('create')
    .description('Create a new agent')
    .option('-n, --name <name>', 'Agent name')
    .option('-p, --project <path>', 'Project path')
    .option('--provider <provider>', 'AI provider', 'openai')
    .option('--model <model>', 'Model name', 'gpt-4o')
    .action(async (cmdOptions, program) => {
      const options = { ...program.opts(), ...cmdOptions };
      
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Agent name:',
            when: !options.name,
          },
          {
            type: 'input',
            name: 'projectPath',
            message: 'Project path:',
            when: !options.project,
          },
        ]);
        
        const config = {
          name: options.name || answers.name,
          projectPath: options.project || answers.projectPath,
          providerId: options.provider,
          model: options.model,
        };
        
        const spinner = ora('Creating agent...').start();
        const api = getAPIClient(options);
        const response = await api.post('/agents', config);
        
        spinner.succeed('Agent created successfully');
        console.log(chalk.cyan('Agent ID:'), response.data.id);
      } catch (error) {
        console.error(chalk.red('Failed to create agent:'), (error as Error).message);
      }
    }),

  get: new Command('get <id>')
    .description('Get agent details')
    .action(async (id, options) => {
      try {
        const api = getAPIClient(options);
        const response = await api.get(`/agents/${id}`);
        const agent = response.data;
        
        console.log(chalk.bold('\nAgent Details:'));
        console.log(`  ID: ${chalk.cyan(agent.id)}`);
        console.log(`  Name: ${agent.name}`);
        console.log(`  Status: ${agent.status}`);
        console.log(`  Model: ${agent.model}`);
        console.log(`  Project: ${agent.projectPath}`);
        console.log(`  Messages: ${agent.messages.length}`);
        console.log(`  Tasks: ${agent.tasks.length}`);
      } catch (error) {
        console.error(chalk.red('Failed to get agent:'), (error as Error).message);
      }
    }),

  delete: new Command('delete <id>')
    .description('Delete an agent')
    .option('-f, --force', 'Force deletion without confirmation')
    .action(async (id, cmdOptions, program) => {
      const options = { ...program.opts(), ...cmdOptions };
      
      if (!options.force) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete agent ${id}?`,
          default: false,
        }]);
        
        if (!confirm) {
          console.log(chalk.yellow('Cancelled'));
          return;
        }
      }
      
      try {
        const spinner = ora('Deleting agent...').start();
        const api = getAPIClient(options);
        await api.delete(`/agents/${id}`);
        
        spinner.succeed('Agent deleted');
      } catch (error) {
        console.error(chalk.red('Failed to delete agent:'), (error as Error).message);
      }
    }),

  chat: new Command('chat <id>')
    .description('Send a message to an agent')
    .argument('<message>', 'Message to send')
    .action(async (id, message, options) => {
      try {
        const spinner = ora('Sending message...').start();
        const api = getAPIClient(options);
        const response = await api.post(`/agents/${id}/messages`, { message });
        
        spinner.stop();
        console.log(chalk.cyan('\nAgent:'));
        console.log(response.data.content);
      } catch (error) {
        console.error(chalk.red('Failed to send message:'), (error as Error).message);
      }
    }),

  chatInteractive: async (agentId: string, options: any) => {
    console.log(chalk.cyan(`Starting chat with agent ${agentId}`));
    console.log(chalk.gray('Type "exit" to quit\n'));
    
    const api = getAPIClient(options);
    
    // Connect via WebSocket for real-time updates
    const ws = new WebSocket(`ws://${options.host}:${options.port}`);
    
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'subscribe_agent', agentId }));
    });
    
    ws.on('message', (data) => {
      const event = JSON.parse(data.toString());
      if (event.type === 'agent_message') {
        console.log(chalk.cyan('\nAgent:'), event.data.message.content);
        process.stdout.write('> ');
      }
    });
    
    const askQuestion = async () => {
      const { message } = await inquirer.prompt([{
        type: 'input',
        name: 'message',
        message: '>',
      }]);
      
      if (message.toLowerCase() === 'exit') {
        ws.close();
        process.exit(0);
      }
      
      try {
        await api.post(`/agents/${agentId}/messages`, { message });
      } catch (error) {
        console.error(chalk.red('Error:'), (error as Error).message);
      }
      
      askQuestion();
    };
    
    askQuestion();
  },
};