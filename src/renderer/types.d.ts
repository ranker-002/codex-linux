export interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  dialog: {
    selectFolder: () => Promise<string | null>;
    selectFile: (filters?: any[]) => Promise<string | null>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
    openPath: (path: string) => Promise<void>;
  };
  agent: {
    create: (config: any) => Promise<any>;
    list: () => Promise<any[]>;
    get: (agentId: string) => Promise<any>;
    sendMessage: (agentId: string, message: string) => Promise<any>;
    sendMessageStream: (agentId: string, message: string) => Promise<any>;
    executeTask: (agentId: string, task: string) => Promise<any>;
    pause: (agentId: string) => Promise<any>;
    resume: (agentId: string) => Promise<any>;
    stop: (agentId: string) => Promise<any>;
    delete: (agentId: string) => Promise<any>;
  };
  cowork: {
    create: (name: string, objective: string, projectPath: string, options?: any) => Promise<any>;
    start: (sessionId: string) => Promise<any>;
    pause: (sessionId: string) => Promise<any>;
    stop: (sessionId: string) => Promise<any>;
    list: () => Promise<any[]>;
  };
  pair: {
    start: (projectPath: string, mode: string, userId: string) => Promise<any>;
    chat: (sessionId: string, message: string) => Promise<any>;
    end: (sessionId: string) => Promise<any>;
  };
  assistant: {
    inlineCompletion: (filePath: string, content: string, position: any) => Promise<any>;
    suggestFixes: (filePath: string, content: string) => Promise<any>;
    explain: (code: string) => Promise<any>;
  };
  metrics: {
    get: () => Promise<any>;
    export: () => Promise<any>;
  };
  worktree: {
    create: (repoPath: string, name: string) => Promise<any>;
    list: (repoPath: string) => Promise<any[]>;
    remove: (repoPath: string, name: string) => Promise<any>;
  };
  skills: {
    list: () => Promise<any[]>;
    get: (skillId: string) => Promise<any>;
    create: (config: any) => Promise<any>;
    update: (skillId: string, config: any) => Promise<any>;
    delete: (skillId: string) => Promise<any>;
    applyToAgent: (agentId: string, skillIds: string[]) => Promise<any>;
  };
  automation: {
    list: () => Promise<any[]>;
    create: (config: any) => Promise<any>;
    update: (automationId: string, config: any) => Promise<any>;
    delete: (automationId: string) => Promise<any>;
    toggle: (automationId: string, enabled: boolean) => Promise<any>;
  };
  settings: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    getAll: () => Promise<any>;
  };
  providers: {
    list: () => Promise<any[]>;
    getActive: () => Promise<any>;
    setActive: (providerId: string) => Promise<void>;
    configure: (providerId: string, config: any) => Promise<void>;
    test: (providerId: string) => Promise<boolean>;
  };
  fs: {
    readdir: (path: string, options?: any) => Promise<any[]>;
    readFile: (path: string, encoding?: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    stat: (path: string) => Promise<any>;
  };
  terminal: {
    execute: (params: { command: string; cwd: string }) => Promise<any>;
    kill: () => Promise<void>;
  };
  changes: {
    list: (agentId?: string) => Promise<any[]>;
    approve: (changeId: string) => Promise<void>;
    reject: (changeId: string, comment?: string) => Promise<void>;
    apply: (changeId: string) => Promise<void>;
  };
  git: {
    status: (repoPath: string) => Promise<any>;
    commit: (params: { repoPath: string; message: string; files?: string[] }) => Promise<any>;
    diff: (params: { repoPath: string; filePath?: string }) => Promise<string>;
  };
  search: {
    files: (params: { query: string; path: string; pattern?: string }) => Promise<any[]>;
  };
  notification: {
    show: (params: { title: string; body: string }) => Promise<void>;
  };
  data: {
    export: (exportPath: string) => Promise<void>;
    import: (importPath: string) => Promise<void>;
  };
  on: (channel: string, callback: (...args: any[]) => void) => void;
  removeListener: (channel: string, callback: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
