import { app, BrowserWindow, ipcMain, dialog, shell, Notification, Tray, Menu, globalShortcut, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';
import log from 'electron-log';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { AgentOrchestrator } from './agents/AgentOrchestrator';
import { GitWorktreeManager } from './git/GitWorktreeManager';
import { SkillsManager } from './skills/SkillsManager';
import { AutomationScheduler } from './automations/AutomationScheduler';
import { DatabaseManager } from './DatabaseManager';
import { SettingsManager } from './SettingsManager';
import { AIProviderManager } from './providers/AIProviderManager';
import { SecurityManager } from './security/SecurityManager';
import { AuditLogger } from './security/AuditLogger';
import { BackupManager } from './backup/BackupManager';
import { MigrationManager } from './backup/MigrationManager';
import { APIServer } from './api/APIServer';
import { PluginManager } from './plugins/PluginManager';
import { CoworkManager } from './cowork/CoworkManager';
import { GitHubPRMonitor } from './github/GitHubPRMonitor';
import { MCPManager } from './mcp/MCPManager';
import { AIPairProgramming } from './pair/AIPairProgramming';
import { ErrorTracker } from './monitoring/ErrorTracker';
import { metrics, startSystemMetrics } from './monitoring/MetricsCollector';
import { NotificationManager } from './notifications/NotificationManager';
import { SmartCodeAssistant } from './assistant/SmartCodeAssistant';
import { z } from 'zod';

// Validation schemas
const AgentConfigSchema = z.object({
  name: z.string().min(1).max(100),
  projectPath: z.string().min(1),
  providerId: z.string(),
  model: z.string(),
  skills: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
}).strict();

const store = new Store();
let mainWindow: BrowserWindow | null = null;
let agentOrchestrator: AgentOrchestrator;
let gitWorktreeManager: GitWorktreeManager;
let skillsManager: SkillsManager;
let automationScheduler: AutomationScheduler;
let dbManager: DatabaseManager;
let settingsManager: SettingsManager;
let aiProviderManager: AIProviderManager;
let securityManager: SecurityManager;
let auditLogger: AuditLogger;
let backupManager: BackupManager;
let migrationManager: MigrationManager;
let apiServer: APIServer;
let pluginManager: PluginManager;
let coworkManager: CoworkManager;
let githubPRMonitor: GitHubPRMonitor;
let mcpManager: MCPManager;
let aiPairProgramming: AIPairProgramming;
let errorTracker: ErrorTracker;
let notificationManager: NotificationManager;
let smartCodeAssistant: SmartCodeAssistant;

log.info('Starting Codex Linux...');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false
    },
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let tray: Tray | null = null;

function createTray(): void {
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  
  try {
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Codex',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'New Agent',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('create-new-agent');
          }
        }
      },
      {
        label: 'Open Settings',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('open-settings');
          }
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
    
    tray.setToolTip('Codex Linux');
    tray.setContextMenu(contextMenu);
    
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    
    log.info('System tray initialized');
  } catch (error) {
    log.warn('Failed to create system tray:', error);
  }
}

function registerGlobalShortcuts(): void {
  try {
    globalShortcut.register('CommandOrControl+Shift+C', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    
    globalShortcut.register('CommandOrControl+Shift+N', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send('create-new-agent');
      }
    });
    
    globalShortcut.register('CommandOrControl+Shift+K', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.webContents.send('open-search');
      }
    });
    
    log.info('Global shortcuts registered');
  } catch (error) {
    log.warn('Failed to register global shortcuts:', error);
  }
}

async function initializeServices(): Promise<void> {
  try {
    // Initialize security first
    securityManager = new SecurityManager();
    await securityManager.initialize();
    log.info('Security manager initialized');

    // Initialize database
    dbManager = new DatabaseManager();
    await dbManager.initialize();
    log.info('Database initialized');

    // Run migrations
    migrationManager = new MigrationManager(dbManager);
    await migrationManager.initialize();
    log.info('Migrations completed');

    // Initialize settings
    settingsManager = new SettingsManager(store);
    log.info('Settings manager initialized');

    // Initialize AI provider manager
    aiProviderManager = new AIProviderManager(settingsManager);
    log.info('AI provider manager initialized');

    // Initialize notification manager
    notificationManager = new NotificationManager();
    log.info('Notification manager initialized');

    // Initialize Git worktree manager
    gitWorktreeManager = new GitWorktreeManager();
    log.info('Git worktree manager initialized');

    // Initialize skills manager
    skillsManager = new SkillsManager();
    await skillsManager.initialize();
    log.info('Skills manager initialized');

    // Initialize automation scheduler
    automationScheduler = new AutomationScheduler();
    await automationScheduler.initialize();
    log.info('Automation scheduler initialized');

    // Initialize agent orchestrator
    agentOrchestrator = new AgentOrchestrator(
      aiProviderManager,
      gitWorktreeManager,
      skillsManager,
      dbManager
    );
    await agentOrchestrator.initialize();
    log.info('Agent orchestrator initialized');

    // Initialize backup manager
    backupManager = new BackupManager();
    await backupManager.initialize();
    log.info('Backup manager initialized');

    // Initialize plugin manager
    pluginManager = new PluginManager();
    await pluginManager.initialize();
    log.info('Plugin manager initialized');

    // Initialize cowork manager
    coworkManager = new CoworkManager(
      agentOrchestrator,
      dbManager,
      notificationManager
    );
    await coworkManager.initialize();
    log.info('Cowork manager initialized');

    // Initialize AI pair programming
    aiPairProgramming = new AIPairProgramming(
      agentOrchestrator,
      aiProviderManager
    );
    log.info('AI pair programming initialized');

    // Initialize smart code assistant
    smartCodeAssistant = new SmartCodeAssistant(aiProviderManager);
    log.info('Smart code assistant initialized');

    // Initialize MCP manager
    mcpManager = new MCPManager();
    await mcpManager.initialize();
    log.info('MCP manager initialized');

    // Initialize audit logger
    auditLogger = new AuditLogger();
    await auditLogger.initialize();
    log.info('Audit logger initialized');

    // Initialize error tracker
    const sentryDsn = (settingsManager as any).get('sentryDsn') as string | undefined;
    if (sentryDsn) {
      errorTracker = new ErrorTracker();
      errorTracker.initialize(sentryDsn);
      log.info('Error tracker initialized');
    }

    // Start system metrics
    startSystemMetrics();
    log.info('System metrics started');

    // Initialize API server
    apiServer = new APIServer(
      agentOrchestrator,
      securityManager,
      auditLogger
    );
    await apiServer.start();
    log.info('API server started on port 3001');

    // Initialize GitHub PR Monitor if token available
    const githubToken = (settingsManager as any).get('githubToken') as string | undefined;
    if (githubToken) {
      githubPRMonitor = new GitHubPRMonitor(
        githubToken,
        agentOrchestrator,
        gitWorktreeManager,
        notificationManager
      );
      await githubPRMonitor.initialize();
      log.info('GitHub PR monitor initialized');
    }

  } catch (error) {
    log.error('Failed to initialize services:', error);
    throw error;
  }
}

// App event handlers
app.whenReady().then(async () => {
  try {
    await initializeServices();
    createWindow();
    createTray();
    registerGlobalShortcuts();
    setupIPC();
    setupAutoUpdater();
    setupAutoUpdaterIPC();
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    log.error('Failed to start application:', error);
    dialog.showErrorBox(
      'Startup Error',
      'Failed to initialize Codex Linux. Please check the logs.'
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await cleanup();
});

function setupAutoUpdater(): void {
  if (app.isPackaged) {
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    
    autoUpdater.on('checking-for-update', () => {
      log.info('Checking for updates...');
    });
    
    autoUpdater.on('update-available', (info) => {
      log.info('Update available:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-available', info);
      }
    });
    
    autoUpdater.on('update-not-available', () => {
      log.info('No updates available');
    });
    
    autoUpdater.on('download-progress', (progress) => {
      log.info(`Download progress: ${progress.percent}%`);
      if (mainWindow) {
        mainWindow.webContents.send('update-progress', progress);
      }
    });
    
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded:', info.version);
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded', info);
      }
      
      if (Notification.isSupported()) {
        new Notification({
          title: 'Update Ready',
          body: `Codex Linux ${info.version} is ready to install. Restart to update.`
        }).show();
      }
    });
    
    autoUpdater.on('error', (error) => {
      log.error('Auto-updater error:', error);
    });
    
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      log.warn('Failed to check for updates:', err);
    });
  }
}

function setupAutoUpdaterIPC(): void {
  ipcMain.handle('update:check', async () => {
    if (!app.isPackaged) {
      return { available: false, message: 'Updates only work in packaged app' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      return { available: !!result?.updateInfo, version: result?.updateInfo?.version };
    } catch (error) {
      log.error('Update check failed:', error);
      return { available: false, message: 'Update check failed' };
    }
  });
  
  ipcMain.handle('update:download', async () => {
    if (!app.isPackaged) {
      return { success: false, message: 'Updates only work in packaged app' };
    }
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      log.error('Update download failed:', error);
      return { success: false, message: 'Update download failed' };
    }
  });
  
  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}

async function cleanup(): Promise<void> {
  log.info('Starting cleanup...');
  
  try {
    globalShortcut.unregisterAll();
    tray?.destroy();
    tray = null;
    
    await Promise.all([
      agentOrchestrator?.cleanup(),
      automationScheduler?.cleanup(),
      coworkManager?.cleanup(),
      apiServer?.stop(),
      pluginManager?.cleanup(),
      mcpManager?.cleanup(),
      githubPRMonitor?.cleanup(),
      backupManager?.cleanup?.(),
      dbManager?.close()
    ]);
    
    log.info('Cleanup completed');
  } catch (error) {
    log.error('Error during cleanup:', error);
  }
}

function setupIPC(): void {
  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  // File system operations
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle('dialog:selectFile', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle('shell:openExternal', (event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle('shell:openPath', (event, path: string) => {
    shell.openPath(path);
  });

  // Agent operations with validation
  ipcMain.handle('agent:create', async (event, config) => {
    try {
      const validatedConfig = AgentConfigSchema.parse(config);
      const result = await agentOrchestrator.createAgent(validatedConfig);
      await auditLogger.log('agent_created', { agentId: result.id });
      return result;
    } catch (error) {
      log.error('Failed to create agent:', error);
      throw error;
    }
  });

  ipcMain.handle('agent:list', async () => {
    return await agentOrchestrator.listAgents();
  });

  ipcMain.handle('agent:get', async (event, agentId: string) => {
    return await agentOrchestrator.getAgent(agentId);
  });

  ipcMain.handle('agent:sendMessage', async (event, agentId: string, message: string) => {
    try {
      return await agentOrchestrator.sendMessage(agentId, message);
    } catch (error) {
      log.error('Failed to send message:', error);
      throw error;
    }
  });

  ipcMain.handle('agent:sendMessageStream', async (event, agentId: string, message: string) => {
    try {
      const stream = await agentOrchestrator.sendMessageStream(agentId, message, {
        onChunk: (chunk: string) => {
          event.sender.send('agent:streamChunk', { agentId, chunk });
        },
        onComplete: () => {
          event.sender.send('agent:streamEnd', { agentId });
        },
        onError: (error: Error) => {
          event.sender.send('agent:streamError', { agentId, error: error.message });
        }
      });
      
      return { success: true };
    } catch (error) {
      log.error('Failed to start stream:', error);
      throw error;
    }
  });

  ipcMain.handle('agent:executeTask', async (event, agentId: string, task: string) => {
    return await agentOrchestrator.executeTask(agentId, task);
  });

  ipcMain.handle('agent:pause', async (event, agentId: string) => {
    return await agentOrchestrator.pauseAgent(agentId);
  });

  ipcMain.handle('agent:resume', async (event, agentId: string) => {
    return await agentOrchestrator.resumeAgent(agentId);
  });

  ipcMain.handle('agent:stop', async (event, agentId: string) => {
    return await agentOrchestrator.stopAgent(agentId);
  });

  ipcMain.handle('agent:delete', async (event, agentId: string) => {
    try {
      await agentOrchestrator.deleteAgent(agentId);
      await auditLogger.log('agent_deleted', { agentId });
      return { success: true };
    } catch (error) {
      log.error('Failed to delete agent:', error);
      throw error;
    }
  });

  // Worktree operations
  ipcMain.handle('worktree:create', async (event, repoPath: string, name: string) => {
    return await gitWorktreeManager.createWorktree(repoPath, name);
  });

  ipcMain.handle('worktree:list', async (event, repoPath: string) => {
    return await gitWorktreeManager.listWorktrees(repoPath);
  });

  ipcMain.handle('worktree:remove', async (event, repoPath: string, name: string) => {
    return await gitWorktreeManager.removeWorktree(repoPath, name);
  });

  // Skills operations
  ipcMain.handle('skills:list', async () => {
    return await skillsManager.listSkills();
  });

  ipcMain.handle('skills:get', async (event, skillId: string) => {
    return await skillsManager.getSkill(skillId);
  });

  ipcMain.handle('skills:create', async (event, skillConfig) => {
    return await skillsManager.createSkill(skillConfig);
  });

  ipcMain.handle('skills:update', async (event, skillId: string, skillConfig) => {
    return await skillsManager.updateSkill(skillId, skillConfig);
  });

  ipcMain.handle('skills:delete', async (event, skillId: string) => {
    return await skillsManager.deleteSkill(skillId);
  });

  ipcMain.handle('skills:applyToAgent', async (event, agentId: string, skillIds: string[]) => {
    return await agentOrchestrator.applySkills(agentId, skillIds);
  });

  // Automation operations
  ipcMain.handle('automation:list', async () => {
    return await automationScheduler.listAutomations();
  });

  ipcMain.handle('automation:create', async (event, config) => {
    return await automationScheduler.createAutomation(config);
  });

  ipcMain.handle('automation:update', async (event, automationId: string, config) => {
    return await automationScheduler.updateAutomation(automationId, config);
  });

  ipcMain.handle('automation:delete', async (event, automationId: string) => {
    return await automationScheduler.deleteAutomation(automationId);
  });

  ipcMain.handle('automation:toggle', async (event, automationId: string, enabled: boolean) => {
    return await automationScheduler.toggleAutomation(automationId, enabled);
  });

  // Settings operations
  ipcMain.handle('settings:get', (event, key: string) => {
    return (settingsManager as any).get(key);
  });

  ipcMain.handle('settings:set', (event, key: string, value: any) => {
    (settingsManager as any).set(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    return settingsManager.getAll();
  });

  // AI Provider operations
  ipcMain.handle('providers:list', () => {
    return aiProviderManager.listProviders();
  });

  ipcMain.handle('providers:getActive', () => {
    return aiProviderManager.getActiveProvider();
  });

  ipcMain.handle('providers:setActive', (event, providerId: string) => {
    return aiProviderManager.setActiveProvider(providerId);
  });

  ipcMain.handle('providers:configure', (event, providerId: string, config: any) => {
    return aiProviderManager.configureProvider(providerId, config);
  });

  ipcMain.handle('providers:test', async (event, providerId: string) => {
    return await aiProviderManager.testProvider(providerId);
  });

  // File system operations
  ipcMain.handle('fs:readdir', async (event, dirPath: string, options?: { withFileTypes?: boolean }) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map((entry: any) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile()
      }));
    } catch (error) {
      log.error('Failed to read directory:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:readFile', async (event, filePath: string, encoding?: BufferEncoding) => {
    try {
      const content = await fs.readFile(filePath, encoding || 'utf-8');
      return content;
    } catch (error) {
      log.error('Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:writeFile', async (event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      log.error('Failed to write file:', error);
      throw error;
    }
  });

  ipcMain.handle('fs:stat', async (event, filePath: string) => {
    try {
      const stats = await fs.stat(filePath);
      return {
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime
      };
    } catch (error) {
      log.error('Failed to stat file:', error);
      throw error;
    }
  });

  // Terminal operations
  let currentTerminalProcess: ChildProcess | null = null;

  ipcMain.handle('terminal:execute', async (event, { command, cwd }: { command: string; cwd: string }) => {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      
      currentTerminalProcess = spawn(cmd, args, {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
      });

      let stdout = '';
      let stderr = '';

      currentTerminalProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      currentTerminalProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      currentTerminalProcess.on('close', (code) => {
        currentTerminalProcess = null;
        resolve({
          stdout,
          stderr,
          exitCode: code,
          error: code !== 0 ? `Process exited with code ${code}` : null
        });
      });

      currentTerminalProcess.on('error', (error) => {
        currentTerminalProcess = null;
        resolve({
          stdout,
          stderr,
          exitCode: -1,
          error: error.message
        });
      });
    });
  });

  ipcMain.handle('terminal:kill', () => {
    if (currentTerminalProcess) {
      currentTerminalProcess.kill();
      currentTerminalProcess = null;
    }
  });

  // Code changes operations
  ipcMain.handle('changes:list', async (event, agentId?: string) => {
    return await dbManager.getCodeChanges(agentId);
  });

  ipcMain.handle('changes:approve', async (event, changeId: string) => {
    return await dbManager.approveCodeChange(changeId);
  });

  ipcMain.handle('changes:reject', async (event, changeId: string, comment?: string) => {
    return await dbManager.rejectCodeChange(changeId, comment);
  });

  ipcMain.handle('changes:apply', async (event, changeId: string) => {
    return await dbManager.applyCodeChange(changeId);
  });

  // Git operations
  ipcMain.handle('git:status', async (event, repoPath: string) => {
    return await gitWorktreeManager.getChanges(repoPath);
  });

  ipcMain.handle('git:commit', async (event, { repoPath, message, files }: { repoPath: string; message: string; files?: string[] }) => {
    return await gitWorktreeManager.commitChanges(repoPath, message, files);
  });

  ipcMain.handle('git:diff', async (event, { repoPath, filePath }: { repoPath: string; filePath?: string }) => {
    return await gitWorktreeManager.getDiff(repoPath, filePath);
  });

  // Search operations
  ipcMain.handle('search:files', async (event, { query, path, pattern }: { query: string; path: string; pattern?: string }) => {
    try {
      const results: Array<{ path: string; matches: Array<{ line: number; content: string }> }> = [];
      
      async function searchDir(dirPath: string) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = `${dirPath}/${entry.name}`;
          
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' && 
                entry.name !== 'build') {
              await searchDir(fullPath);
            }
          } else if (entry.isFile()) {
            if (pattern && !entry.name.match(pattern)) continue;
            
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const lines = content.split('\n');
              const matches: Array<{ line: number; content: string }> = [];
              
              lines.forEach((line, index) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                  matches.push({ line: index + 1, content: line.trim() });
                }
              });
              
              if (matches.length > 0) {
                results.push({ path: fullPath, matches });
              }
            } catch {
              // Skip binary or unreadable files
            }
          }
        }
      }
      
      await searchDir(path);
      return results;
    } catch (error) {
      log.error('Search failed:', error);
      throw error;
    }
  });

  // Notifications
  ipcMain.handle('notification:show', (event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({
        title,
        body,
        icon: path.join(__dirname, '../../assets/icon.png')
      }).show();
    }
  });

  // Export/Import
  ipcMain.handle('data:export', async (event, exportPath: string) => {
    try {
      const data = {
        agents: await dbManager.getAllAgents(),
        automations: await automationScheduler.listAutomations(),
        skills: await skillsManager.listSkills(),
        settings: settingsManager.getAll(),
        exportedAt: new Date().toISOString()
      };
      
      await fs.writeFile(exportPath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (error) {
      log.error('Export failed:', error);
      throw error;
    }
  });

  ipcMain.handle('data:import', async (event, importPath: string) => {
    try {
      const content = await fs.readFile(importPath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.agents) {
        for (const agent of data.agents) {
          await dbManager.createAgent(agent);
        }
      }
      
      if (data.automations) {
        for (const automation of data.automations) {
          await automationScheduler.createAutomation(automation);
        }
      }
      
      if (data.settings) {
        for (const [key, value] of Object.entries(data.settings)) {
          settingsManager.set(key as any, value);
        }
      }
      
      return true;
    } catch (error) {
      log.error('Import failed:', error);
      throw error;
    }
  });

  // Cowork operations
  ipcMain.handle('cowork:create', async (event, name: string, objective: string, projectPath: string, options: any) => {
    return await coworkManager.createSession(name, objective, projectPath, options);
  });

  ipcMain.handle('cowork:start', async (event, sessionId: string) => {
    return await coworkManager.startSession(sessionId);
  });

  ipcMain.handle('cowork:pause', async (event, sessionId: string) => {
    return await coworkManager.pauseSession(sessionId);
  });

  ipcMain.handle('cowork:stop', async (event, sessionId: string) => {
    return await coworkManager.stopSession(sessionId);
  });

  ipcMain.handle('cowork:list', async () => {
    return coworkManager.getSessions();
  });

  // Pair programming operations
  ipcMain.handle('pair:start', async (event, projectPath: string, mode: string, userId: string) => {
    return await aiPairProgramming.startSession(projectPath, mode as any, userId);
  });

  ipcMain.handle('pair:chat', async (event, sessionId: string, message: string) => {
    return await aiPairProgramming.chat(sessionId, message);
  });

  ipcMain.handle('pair:end', async (event, sessionId: string) => {
    return await aiPairProgramming.endSession(sessionId);
  });

  // Smart code assistant
  ipcMain.handle('assistant:inlineCompletion', async (event, filePath: string, content: string, position: any) => {
    return await smartCodeAssistant.provideInlineCompletion(filePath, content, position);
  });

  ipcMain.handle('assistant:suggestFixes', async (event, filePath: string, content: string) => {
    return await smartCodeAssistant.suggestFixes(filePath, content);
  });

  ipcMain.handle('assistant:explain', async (event, code: string) => {
    return await smartCodeAssistant.explainCode(code, 'detailed');
  });

  // Metrics
  ipcMain.handle('metrics:get', () => {
    return metrics.getStats();
  });

  ipcMain.handle('metrics:export', () => {
    return metrics.exportMetrics();
  });

  log.info('IPC handlers setup completed');
}