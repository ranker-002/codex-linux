export enum PermissionMode {
  ASK = 'ask',
  AUTO_ACCEPT_EDITS = 'auto_accept_edits',
  PLAN = 'plan',
  BYPASS = 'bypass'
}

export interface ExtendedThinkingConfig {
  enabled: boolean;
  maxTokens: number;
  budgetTokens?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    reasoning?: string;
    extendedThinking?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
    tokensUsed?: number;
    [key: string]: any;
  };
}

export interface PermissionRequest {
  id: string;
  agentId: string;
  type: 'edit' | 'command' | 'tool';
  action: string;
  details: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  projectPath: string;
  worktreeName: string;
  providerId: string;
  model: string;
  skills: string[];
  permissionMode: PermissionMode;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date | null;
  messages: AgentMessage[];
  tasks: AgentTask[];
  metadata: Record<string, any>;
  version?: number;
}

export enum AgentStatus {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  COMPLETED = 'completed'
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: {
    reasoning?: string;
    extendedThinking?: boolean;
    reasoningEffort?: 'low' | 'medium' | 'high';
    tokensUsed?: number;
    [key: string]: any;
  };
}

export interface AgentTask {
  id: string;
  description: string;
  status: TaskStatus;
  progress: number;
  startedAt: Date;
  completedAt?: Date;
  result?: string;
  error?: string;
}

export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface Worktree {
  name: string;
  path: string;
  commit: string;
  branch: string;
  isMain: boolean;
  agents: string[];
  createdAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
  files: SkillFile[];
  config: SkillConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillFile {
  path: string;
  content: string;
  type: 'instruction' | 'template' | 'tool' | 'config';
}

export interface SkillConfig {
  entryPoint: string;
  parameters: SkillParameter[];
  dependencies: string[];
  permissions: string[];
}

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: any;
  description: string;
}

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  actions: AutomationAction[];
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  runCount: number;
}

export interface AutomationTrigger {
  type: 'schedule' | 'event' | 'webhook' | 'manual';
  config: Record<string, any>;
}

export interface AutomationAction {
  type: 'createAgent' | 'sendMessage' | 'executeCommand' | 'runSkill' | 'notify';
  config: Record<string, any>;
}

export interface AIProvider {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  config: ProviderConfig;
  models: ProviderModel[];
}

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  timeout?: number;
  maxRetries?: number;
  customHeaders?: Record<string, string>;
}

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  contextWindow: number;
  supportsTools: boolean;
  supportsVision: boolean;
  pricing: {
    input: number;
    output: number;
  };
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  fontFamily: string;
  autoSave: boolean;
  autoSaveInterval: number;
  defaultProvider: string;
  defaultModel: string;
  maxParallelAgents: number;
  showNotifications: boolean;
  confirmDestructiveActions: boolean;
  gitAuthorName: string;
  gitAuthorEmail: string;
  customSkillsPath: string;
  shortcuts: Record<string, string>;
  sentryDsn?: string;
  githubToken?: string;
  extendedThinking?: ExtendedThinkingConfig;
  allowBypassMode?: boolean;
}

export interface CodeChange {
  id: string;
  filePath: string;
  originalContent: string;
  newContent: string;
  diff: string;
  agentId: string;
  taskId: string;
  status: ChangeStatus;
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  comment?: string;
}

export enum ChangeStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPLIED = 'applied'
}

export interface Project {
  id: string;
  name: string;
  path: string;
  gitRemote?: string;
  agents: string[];
  worktrees: Worktree[];
  createdAt: Date;
  updatedAt: Date;
}

// Computer Using Agent (CUA) Types
export interface UIElement {
  id?: string;
  type: 'button' | 'input' | 'link' | 'text' | 'image' | 'container' | 'other';
  text?: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  attributes?: Record<string, string>;
}

export interface ComputerAction {
  type: 'click' | 'doubleClick' | 'rightClick' | 'type' | 'scroll' | 'drag' | 'wait' | 'key' | 'screenshot';
  target?: {
    element?: UIElement;
    coordinates?: { x: number; y: number };
    selector?: string;
  };
  value?: string;
  delay?: number;
  metadata?: Record<string, any>;
}

export interface ComputerTask {
  id: string;
  description: string;
  goal: string;
  maxSteps: number;
  currentStep: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  actions: ComputerAction[];
  results: string[];
  error?: string;
}

export interface ComputerUseSession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime?: Date;
  screenshots: string[];
  actions: ComputerAction[];
  currentUrl?: string;
  currentApp?: string;
}

// CLAUDE.md Configuration Types
export interface ClaudeMdConfig {
  version: string;
  project: {
    name: string;
    description?: string;
    language?: string;
    framework?: string;
  };
  codingStandards: {
    style?: string;
    linter?: string;
    formatter?: string;
    maxLineLength?: number;
    indentSize?: number;
    useTabs?: boolean;
  };
  architecture: {
    patterns?: string[];
    conventions?: string[];
    folderStructure?: string;
    designPrinciples?: string[];
  };
  libraries: {
    preferred?: string[];
    avoid?: string[];
    testing?: string[];
    utilities?: string[];
  };
  reviewChecklist: {
    required?: string[];
    recommended?: string[];
    security?: string[];
    performance?: string[];
  };
  tools: {
    build?: string;
    test?: string;
    lint?: string;
    typecheck?: string;
  };
  customPrompts: {
    systemPrompt?: string;
    beforeAction?: string;
    afterAction?: string;
    commitMessage?: string;
    prDescription?: string;
  };
  agents?: {
    defaultModel?: string;
    defaultProvider?: string;
    skills?: string[];
    permissionMode?: PermissionMode;
  };
  mcp?: {
    servers?: Array<{
      name: string;
      command?: string;
      url?: string;
      env?: Record<string, string>;
    }>;
  };
  hooks?: {
    preEdit?: string;
    postEdit?: string;
    preCommit?: string;
    postCommit?: string;
  };
  ignore?: string[];
  metadata?: Record<string, any>;
}