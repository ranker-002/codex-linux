import { EventEmitter } from 'events';
import { app, Tray, Menu } from 'electron';
import log from 'electron-log';

export class BackgroundModeManager extends EventEmitter {
  private tray: Tray | null = null;
  private isRunning: boolean = false;
  private backgroundAgents: Set<string> = new Set();

  constructor() {
    super();
  }

  async enable(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.setupTray();
    
    log.info('Background mode enabled');
    this.emit('enabled');
  }

  disable(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    log.info('Background mode disabled');
    this.emit('disabled');
  }

  private setupTray(): void {
    // Create tray icon (would need actual icon path)
    // this.tray = new Tray(path.join(__dirname, 'assets/tray-icon.png'));
    
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          this.emit('show-app');
        }
      },
      {
        label: 'Background Agents',
        submenu: [
          {
            label: `Active: ${this.backgroundAgents.size}`,
            enabled: false
          },
          { type: 'separator' },
          {
            label: 'View All',
            click: () => {
              this.emit('view-agents');
            }
          }
        ]
      },
      { type: 'separator' },
      {
        label: 'Disable Background Mode',
        click: () => {
          this.disable();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setToolTip('Codex Linux - Running in background');
    this.tray.setContextMenu(contextMenu);

    this.tray.on('click', () => {
      this.emit('show-app');
    });
  }

  registerBackgroundAgent(agentId: string): void {
    this.backgroundAgents.add(agentId);
    this.emit('agent:registered', agentId);
    log.debug(`Background agent registered: ${agentId}`);
  }

  unregisterBackgroundAgent(agentId: string): void {
    this.backgroundAgents.delete(agentId);
    this.emit('agent:unregistered', agentId);
    log.debug(`Background agent unregistered: ${agentId}`);
  }

  showNotification(title: string, body: string): void {
    if (!this.tray) return;

    // On Linux, tray can show balloon notifications
    // this.tray.displayBalloon({ iconType: 'info', title, content: body });
    
    // Or use native notifications
    // new Notification({ title, body }).show();
  }

  getStatus(): {
    enabled: boolean;
    backgroundAgents: number;
  } {
    return {
      enabled: this.isRunning,
      backgroundAgents: this.backgroundAgents.size
    };
  }

  cleanup(): void {
    this.disable();
    this.backgroundAgents.clear();
    this.removeAllListeners();
  }
}

export default BackgroundModeManager;
