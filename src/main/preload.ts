import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // Dialog operations
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
    selectFile: (filters?: Electron.FileFilter[]) => ipcRenderer.invoke('dialog:selectFile', filters),
  },

  // Shell operations
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
  },

  // Agent operations
  agent: {
    create: (config: any) => ipcRenderer.invoke('agent:create', config),
    list: () => ipcRenderer.invoke('agent:list'),
    get: (agentId: string) => ipcRenderer.invoke('agent:get', agentId),
    sendMessage: (agentId: string, message: string) => ipcRenderer.invoke('agent:sendMessage', agentId, message),
    sendMessageStream: (agentId: string, message: string) => ipcRenderer.invoke('agent:sendMessageStream', agentId, message),
    executeTask: (agentId: string, task: string) => ipcRenderer.invoke('agent:executeTask', agentId, task),
    pause: (agentId: string) => ipcRenderer.invoke('agent:pause', agentId),
    resume: (agentId: string) => ipcRenderer.invoke('agent:resume', agentId),
    stop: (agentId: string) => ipcRenderer.invoke('agent:stop', agentId),
    delete: (agentId: string) => ipcRenderer.invoke('agent:delete', agentId),
  },

  // Cowork operations
  cowork: {
    create: (name: string, objective: string, projectPath: string, options?: any) => ipcRenderer.invoke('cowork:create', name, objective, projectPath, options),
    start: (sessionId: string) => ipcRenderer.invoke('cowork:start', sessionId),
    pause: (sessionId: string) => ipcRenderer.invoke('cowork:pause', sessionId),
    stop: (sessionId: string) => ipcRenderer.invoke('cowork:stop', sessionId),
    list: () => ipcRenderer.invoke('cowork:list'),
  },

  // Pair programming operations
  pair: {
    start: (projectPath: string, mode: string, userId: string) => ipcRenderer.invoke('pair:start', projectPath, mode, userId),
    chat: (sessionId: string, message: string) => ipcRenderer.invoke('pair:chat', sessionId, message),
    end: (sessionId: string) => ipcRenderer.invoke('pair:end', sessionId),
  },

  // Smart code assistant
  assistant: {
    inlineCompletion: (filePath: string, content: string, position: any) => ipcRenderer.invoke('assistant:inlineCompletion', filePath, content, position),
    suggestFixes: (filePath: string, content: string) => ipcRenderer.invoke('assistant:suggestFixes', filePath, content),
    explain: (code: string) => ipcRenderer.invoke('assistant:explain', code),
  },

  // Metrics operations
  metrics: {
    get: () => ipcRenderer.invoke('metrics:get'),
    export: () => ipcRenderer.invoke('metrics:export'),
  },

  // Worktree operations
  worktree: {
    create: (repoPath: string, name: string) => ipcRenderer.invoke('worktree:create', repoPath, name),
    list: (repoPath: string) => ipcRenderer.invoke('worktree:list', repoPath),
    remove: (repoPath: string, name: string) => ipcRenderer.invoke('worktree:remove', repoPath, name),
  },

  // Skills operations
  skills: {
    list: () => ipcRenderer.invoke('skills:list'),
    get: (skillId: string) => ipcRenderer.invoke('skills:get', skillId),
    create: (config: any) => ipcRenderer.invoke('skills:create', config),
    update: (skillId: string, config: any) => ipcRenderer.invoke('skills:update', skillId, config),
    delete: (skillId: string) => ipcRenderer.invoke('skills:delete', skillId),
    applyToAgent: (agentId: string, skillIds: string[]) => ipcRenderer.invoke('skills:applyToAgent', agentId, skillIds),
  },

  // Automation operations
  automation: {
    list: () => ipcRenderer.invoke('automation:list'),
    create: (config: any) => ipcRenderer.invoke('automation:create', config),
    update: (automationId: string, config: any) => ipcRenderer.invoke('automation:update', automationId, config),
    delete: (automationId: string) => ipcRenderer.invoke('automation:delete', automationId),
    toggle: (automationId: string, enabled: boolean) => ipcRenderer.invoke('automation:toggle', automationId, enabled),
  },

  // Settings operations
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },

  // AI Provider operations
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    getActive: () => ipcRenderer.invoke('providers:getActive'),
    setActive: (providerId: string) => ipcRenderer.invoke('providers:setActive', providerId),
    configure: (providerId: string, config: any) => ipcRenderer.invoke('providers:configure', providerId, config),
    test: (providerId: string) => ipcRenderer.invoke('providers:test', providerId),
  },

  // File system operations
  fs: {
    readdir: (path: string, options?: { withFileTypes?: boolean }) => ipcRenderer.invoke('fs:readdir', path, options),
    readFile: (path: string, encoding?: BufferEncoding) => ipcRenderer.invoke('fs:readFile', path, encoding),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
  },

  // Terminal operations
  terminal: {
    execute: ({ command, cwd }: { command: string; cwd: string }) => ipcRenderer.invoke('terminal:execute', { command, cwd }),
    kill: () => ipcRenderer.invoke('terminal:kill'),
  },

  // Code changes operations
  changes: {
    list: (agentId?: string) => ipcRenderer.invoke('changes:list', agentId),
    approve: (changeId: string) => ipcRenderer.invoke('changes:approve', changeId),
    reject: (changeId: string, comment?: string) => ipcRenderer.invoke('changes:reject', changeId, comment),
    apply: (changeId: string) => ipcRenderer.invoke('changes:apply', changeId),
  },

  // Git operations
  git: {
    status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
    commit: ({ repoPath, message, files }: { repoPath: string; message: string; files?: string[] }) => ipcRenderer.invoke('git:commit', { repoPath, message, files }),
    diff: ({ repoPath, filePath }: { repoPath: string; filePath?: string }) => ipcRenderer.invoke('git:diff', { repoPath, filePath }),
  },

  // Search operations
  search: {
    files: ({ query, path, pattern }: { query: string; path: string; pattern?: string }) => ipcRenderer.invoke('search:files', { query, path, pattern }),
  },

  // Notifications
  notification: {
    show: ({ title, body }: { title: string; body: string }) => ipcRenderer.invoke('notification:show', { title, body }),
  },

  // Export/Import
  data: {
    export: (exportPath: string) => ipcRenderer.invoke('data:export', exportPath),
    import: (importPath: string) => ipcRenderer.invoke('data:import', importPath),
  },

  // Event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'agent:message',
      'agent:status',
      'agent:progress',
      'agent:error',
      'agent:streamChunk',
      'agent:streamEnd',
      'agent:streamError',
      'automation:triggered',
      'worktree:changed',
      'skill:applied',
      'terminal:data',
      'notification:show'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },

  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
});

export type ElectronAPI = {
  // Define the type without referencing window
};