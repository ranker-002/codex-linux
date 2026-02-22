// Test setup and utilities
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { jest } = global as any;

// Mock electron modules
(global as any).jest.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/test',
    on: () => {},
    whenReady: () => Promise.resolve(),
  },
  BrowserWindow: () => {},
  ipcMain: {
    handle: () => {},
    on: () => {},
  },
  dialog: {
    showOpenDialog: () => Promise.resolve({ filePaths: [] }),
    showSaveDialog: () => Promise.resolve({ filePath: '' }),
  },
  shell: {
    openExternal: () => Promise.resolve(),
    openPath: () => Promise.resolve(''),
  },
  Notification: () => {},
}));

(global as any).jest.mock('electron-log', () => ({
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
}));

(global as any).jest.mock('electron-store', () => {
  return () => ({
    get: () => {},
    set: () => {},
    clear: () => {},
  });
});

// Global test utilities
(global as any).testUtils = {
  createMockAgent: (overrides = {}) => ({
    id: 'test-agent-1',
    name: 'Test Agent',
    status: 'idle',
    projectPath: '/tmp/test-project',
    worktreeName: 'test-worktree',
    providerId: 'openai',
    model: 'gpt-4o',
    skills: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: null,
    messages: [],
    tasks: [],
    metadata: {},
    ...overrides,
  }),

  createMockWorktree: (overrides = {}) => ({
    name: 'test-worktree',
    path: '/tmp/test-project/.codex/worktrees/test-worktree',
    commit: 'abc123',
    branch: 'codex/test-agent-1',
    isMain: false,
    agents: [],
    createdAt: new Date(),
    ...overrides,
  }),

  createMockSkill: (overrides = {}) => ({
    id: 'test-skill-1',
    name: 'Test Skill',
    description: 'A test skill',
    version: '1.0.0',
    author: 'Test Author',
    tags: ['test'],
    files: [],
    config: {
      entryPoint: 'index.md',
      parameters: [],
      dependencies: [],
      permissions: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Console suppression for cleaner test output
if (process.env.SUPPRESS_CONSOLE) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}
