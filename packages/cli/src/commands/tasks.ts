import chalk from 'chalk';
import ora from 'ora';
import { getAPIClient } from '../utils/api';

export const TaskCommands = {
  execute: async (agentId: string, task: string, options: any) => {
    try {
      const spinner = ora('Creating task...').start();
      const api = getAPIClient(options);
      
      const response = await api.post(`/agents/${agentId}/tasks`, { task });
      const taskData = response.data;
      
      spinner.succeed(`Task created: ${taskData.id}`);
      
      if (options.watch) {
        console.log(chalk.cyan('\nWatching task progress...'));
        
        // Poll for updates
        const interval = setInterval(async () => {
          try {
            const statusRes = await api.get(`/agents/${agentId}`);
            const taskInfo = statusRes.data.tasks.find((t: any) => t.id === taskData.id);
            
            if (taskInfo) {
              process.stdout.write(`\rProgress: ${taskInfo.progress}%`);
              
              if (taskInfo.status === 'completed') {
                clearInterval(interval);
                console.log(chalk.green('\n✓ Task completed'));
                if (taskInfo.result) {
                  console.log(chalk.cyan('\nResult:'));
                  console.log(taskInfo.result);
                }
              } else if (taskInfo.status === 'failed') {
                clearInterval(interval);
                console.log(chalk.red('\n✗ Task failed'));
                if (taskInfo.error) {
                  console.log(chalk.red('Error:'), taskInfo.error);
                }
              }
            }
          } catch (error) {
            clearInterval(interval);
            console.error(chalk.red('\nFailed to get task status:'), (error as Error).message);
          }
        }, 1000);
        
        // Stop after 5 minutes
        setTimeout(() => {
          clearInterval(interval);
          console.log(chalk.yellow('\nTimeout: Stopping progress monitoring'));
        }, 5 * 60 * 1000);
      } else {
        console.log(chalk.gray('Use --watch to monitor progress'));
      }
    } catch (error) {
      console.error(chalk.red('Failed to execute task:'), (error as Error).message);
    }
  },
};