import { EventEmitter } from 'events';
import log from 'electron-log';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface ContinueInOptions {
  target: 'web' | 'ide';
  sessionId: string;
  projectPath: string;
}

export interface IDETarget {
  id: string;
  name: string;
  command: string;
  args?: string[];
}

const IDE_TARGETS: IDETarget[] = [
  { id: 'vscode', name: 'Visual Studio Code', command: 'code', args: ['.'] },
  { id: 'vscode-insiders', name: 'VS Code Insiders', command: 'code-insiders', args: ['.'] },
  { id: 'webstorm', name: 'WebStorm', command: 'webstorm', args: ['.'] },
  { id: 'idea', name: 'IntelliJ IDEA', command: 'idea', args: ['.'] },
  { id: 'pycharm', name: 'PyCharm', command: 'pycharm', args: ['.'] },
  { id: 'sublime', name: 'Sublime Text', command: 'subl', args: ['.'] },
  { id: 'vim', name: 'Vim', command: 'vim', args: ['.'] },
];

export class ContinueInManager extends EventEmitter {
  private availableIDEs: IDETarget[] = [];

  constructor() {
    super();
    this.detectAvailableIDEs();
  }

  private async detectAvailableIDEs(): Promise<void> {
    this.availableIDEs = [];

    for (const ide of IDE_TARGETS) {
      try {
        const isAvailable = await this.checkCommand(ide.command);
        if (isAvailable) {
          this.availableIDEs.push(ide);
        }
      } catch (error) {
        log.warn(`IDE ${ide.name} not available:`, error);
      }
    }

    log.info(`Detected available IDEs:`, this.availableIDEs.map(i => i.name));
  }

  private checkCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const process = exec(`which ${command}`, (error) => {
        resolve(!error);
      });
      process.on('error', () => resolve(false));
    });
  }

  async continueInWeb(sessionId: string): Promise<string> {
    const webUrl = `https://claude.ai/code?session=${sessionId}`;
    
    this.emit('continue:web', { sessionId, url: webUrl });
    log.info(`Continuing session ${sessionId} in web at ${webUrl}`);
    
    return webUrl;
  }

  async continueInIDE(sessionId: string, ideId?: string): Promise<boolean> {
    let targetIDE: IDETarget | undefined;

    if (ideId) {
      targetIDE = this.availableIDEs.find(i => i.id === ideId);
    } else {
      targetIDE = this.availableIDEs[0];
    }

    if (!targetIDE) {
      throw new Error('No IDE available. Please install VS Code or another supported IDE.');
    }

    try {
      const args = [...(targetIDE.args || []), `--folder-uri=vscode-remote://codex-session/${sessionId}`];
      
      return new Promise((resolve, reject) => {
        const childProcess = exec(
          `${targetIDE!.command} ${args.join(' ')}`,
          { cwd: process.cwd() },
          (error) => {
            if (error) {
              log.error(`Failed to open IDE:`, error);
              reject(error);
            } else {
              this.emit('continue:ide', { sessionId, ide: targetIDE });
              log.info(`Continuing session ${sessionId} in ${targetIDE!.name}`);
              resolve(true);
            }
          }
        );
      });
    } catch (error) {
      log.error(`Failed to continue in IDE:`, error);
      throw error;
    }
  }

  async exportSessionForWeb(sessionId: string, projectPath: string): Promise<string> {
    const exportPath = path.join(projectPath, '.codex', 'sessions', `${sessionId}.json`);
    
    try {
      const dir = path.dirname(exportPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const sessionData = {
        sessionId,
        exportedAt: new Date().toISOString(),
        projectPath,
        summary: 'Session exported for web continuation',
      };

      fs.writeFileSync(exportPath, JSON.stringify(sessionData, null, 2));
      
      log.info(`Session exported to ${exportPath}`);
      return exportPath;
    } catch (error) {
      log.error(`Failed to export session:`, error);
      throw error;
    }
  }

  getAvailableIDEs(): IDETarget[] {
    return this.availableIDEs;
  }

  async openInIDE(projectPath: string, ideId?: string): Promise<boolean> {
    let targetIDE: IDETarget | undefined;

    if (ideId) {
      targetIDE = this.availableIDEs.find(i => i.id === ideId);
    } else {
      targetIDE = this.availableIDEs[0];
    }

    if (!targetIDE) {
      throw new Error('No IDE available');
    }

    try {
      return new Promise((resolve, reject) => {
        const args = [...(targetIDE!.args || []), projectPath];
        
        exec(
          `${targetIDE!.command} ${args.join(' ')}`,
          (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(true);
            }
          }
        );
      });
    } catch (error) {
      log.error(`Failed to open project in IDE:`, error);
      throw error;
    }
  }

  cleanup(): void {
    this.removeAllListeners();
  }
}

export default ContinueInManager;
