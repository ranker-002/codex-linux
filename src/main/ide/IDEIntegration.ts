import { EventEmitter } from 'events';
import * as child_process from 'child_process';
import * as path from 'path';
import log from 'electron-log';

interface IDEConfig {
  name: string;
  command: string;
  args: string[];
  windowsCommand?: string;
  macosCommand?: string;
  linuxCommand?: string;
}

interface IDESession {
  ide: string;
  projectPath: string;
  process?: child_process.ChildProcess;
}

const supportedIDEs: IDEConfig[] = [
  {
    name: 'VS Code',
    command: 'code',
    args: ['.'],
    windowsCommand: 'code.cmd',
    macosCommand: 'code',
    linuxCommand: 'code'
  },
  {
    name: 'WebStorm',
    command: 'webstorm',
    args: ['.'],
    windowsCommand: 'webstorm64.exe',
    macosCommand: 'webstorm',
    linuxCommand: 'webstorm.sh'
  },
  {
    name: 'IntelliJ IDEA',
    command: 'idea',
    args: ['.'],
    windowsCommand: 'idea64.exe',
    macosCommand: 'idea',
    linuxCommand: 'idea.sh'
  },
  {
    name: 'Cursor',
    command: 'cursor',
    args: ['.'],
    windowsCommand: 'Cursor.exe',
    macosCommand: 'cursor',
    linuxCommand: 'cursor'
  },
  {
    name: 'Sublime Text',
    command: 'subl',
    args: ['.'],
    windowsCommand: 'subl.exe',
    macosCommand: 'subl',
    linuxCommand: 'subl'
  },
  {
    name: 'Vim',
    command: 'vim',
    args: ['.'],
    linuxCommand: 'vim',
    macosCommand: 'vim'
  },
  {
    name: 'Neovim',
    command: 'nvim',
    args: ['.'],
    linuxCommand: 'nvim',
    macosCommand: 'nvim'
  }
];

export class IDEIntegration extends EventEmitter {
  private activeSessions: Map<string, IDESession> = new Map();
  private platform: string;

  constructor() {
    super();
    this.platform = process.platform;
  }

  async detectAvailableIDEs(): Promise<IDEConfig[]> {
    const available: IDEConfig[] = [];

    for (const ide of supportedIDEs) {
      try {
        const command = this.getPlatformCommand(ide);
        if (await this.isCommandAvailable(command)) {
          available.push(ide);
        }
      } catch (error) {
        log.debug(`${ide.name} not found`);
      }
    }

    return available;
  }

  async openInIDE(projectPath: string, ideName: string): Promise<void> {
    const ide = supportedIDEs.find(i => i.name === ideName);
    if (!ide) {
      throw new Error(`IDE ${ideName} not supported`);
    }

    const command = this.getPlatformCommand(ide);
    const args = ide.args.map(arg => 
      arg === '.' ? projectPath : arg
    );

    try {
      const process = child_process.spawn(command, args, {
        cwd: projectPath,
        detached: true,
        stdio: 'ignore'
      });

      process.unref();

      const sessionId = `ide-${Date.now()}`;
      this.activeSessions.set(sessionId, {
        ide: ideName,
        projectPath,
        process
      });

      this.emit('ide:opened', { sessionId, ide: ideName, projectPath });
      log.info(`Opened ${ideName} at ${projectPath}`);

    } catch (error) {
      log.error(`Failed to open ${ideName}:`, error);
      throw error;
    }
  }

  async openVSCodeAtLine(filePath: string, line: number, column: number = 0): Promise<void> {
    try {
      const args = [
        '--goto',
        `${filePath}:${line}:${column}`
      ];

      const process = child_process.spawn('code', args, {
        detached: true,
        stdio: 'ignore'
      });

      process.unref();

      this.emit('ide:openedAtLine', { filePath, line, column });
      log.info(`Opened ${filePath} at line ${line} in VS Code`);

    } catch (error) {
      log.error('Failed to open file in VS Code:', error);
      throw error;
    }
  }

  async installExtension(ideName: string, extensionId: string): Promise<void> {
    if (ideName !== 'VS Code') {
      throw new Error('Extension installation only supported for VS Code');
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const process = child_process.spawn('code', ['--install-extension', extensionId], {
          stdio: 'pipe'
        });

        let output = '';
        process.stdout?.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Extension installation failed: ${output}`));
          }
        });
      });

      this.emit('ide:extensionInstalled', { ide: ideName, extensionId });
      log.info(`Installed extension ${extensionId} in VS Code`);

    } catch (error) {
      log.error('Failed to install extension:', error);
      throw error;
    }
  }

  async configureWorkspace(projectPath: string, settings: Record<string, any>): Promise<void> {
    const vscodeDir = path.join(projectPath, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');

    try {
      // Create .vscode directory if it doesn't exist
      await fs.promises.mkdir(vscodeDir, { recursive: true });

      // Read existing settings or create new
      let existingSettings = {};
      try {
        const content = await fs.promises.readFile(settingsPath, 'utf-8');
        existingSettings = JSON.parse(content);
      } catch {
        // File doesn't exist or is invalid, start fresh
      }

      // Merge settings
      const newSettings = {
        ...existingSettings,
        ...settings
      };

      // Write settings
      await fs.promises.writeFile(
        settingsPath,
        JSON.stringify(newSettings, null, 2)
      );

      this.emit('ide:workspaceConfigured', { projectPath, settings });
      log.info(`Configured VS Code workspace at ${projectPath}`);

    } catch (error) {
      log.error('Failed to configure workspace:', error);
      throw error;
    }
  }

  getActiveSessions(): IDESession[] {
    return Array.from(this.activeSessions.values());
  }

  closeSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session?.process) {
      session.process.kill();
      this.activeSessions.delete(sessionId);
      this.emit('ide:closed', { sessionId });
    }
  }

  private getPlatformCommand(ide: IDEConfig): string {
    switch (this.platform) {
      case 'win32':
        return ide.windowsCommand || ide.command;
      case 'darwin':
        return ide.macosCommand || ide.command;
      case 'linux':
        return ide.linuxCommand || ide.command;
      default:
        return ide.command;
    }
  }

  private async isCommandAvailable(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const checkCommand = this.platform === 'win32' 
        ? `where ${command}` 
        : `which ${command}`;

      child_process.exec(checkCommand, (error) => {
        resolve(!error);
      });
    });
  }

  cleanup(): void {
    // Close all active sessions
    for (const [_sessionId, session] of this.activeSessions) {
      if (session.process) {
        session.process.kill();
      }
    }
    this.activeSessions.clear();
    this.removeAllListeners();
  }
}

// Import fs at the end to avoid circular dependencies
import * as fs from 'fs';

export default IDEIntegration;
