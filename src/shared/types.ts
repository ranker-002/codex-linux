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
  worktreePath?: string;
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

export interface Checkpoint {
  id: string;
  agentId: string;
  changeId: string;
  filePath: string;
  content: string;
  createdAt: Date;
  restoredAt?: Date;
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

// MCP Advanced Types
export type MCPTransportType = 'stdio' | 'http' | 'streamable-http' | 'sse' | 'websocket';
export type MCPScope = 'local' | 'project' | 'user' | 'managed';

export interface MCPServerDefinition {
  id: string;
  name: string;
  description?: string;
  transport: MCPTransportType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
  oauth?: {
    clientId?: string;
    clientSecret?: string;
    callbackPort?: number;
  };
  scope: MCPScope;
  disabled?: boolean;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
    homepage?: string;
  };
}

export interface MCPRegistryEntry {
  id: string;
  name: string;
  description: string;
  publisher: string;
  version: string;
  transport: MCPTransportType[];
  categories: string[];
  tags: string[];
  installs: number;
  rating: number;
  documentation?: string;
  repository?: string;
  command?: string;
  packages?: Array<{
    registryType: 'npm' | 'pip' | 'docker';
    identifier: string;
  }>;
  remotes?: Array<{
    type: 'streamable-http' | 'sse' | 'websocket';
    url: string;
  }>;
  environmentVariables?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverId?: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId?: string;
}

export interface MCPConfiguration {
  mcpServers: Record<string, MCPServerDefinition>;
  settings?: {
    maxOutputTokens?: number;
    timeout?: number;
    enableToolSearch?: boolean | 'auto' | string;
    allowedServers?: string[];
    deniedServers?: string[];
  };
}

export interface MCPSearchResult {
  query: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export interface MCPAuthToken {
  serverId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string[];
}

// Prompt Optimizer Types
export interface PromptAnalysis {
  originalPrompt: string;
  optimizedPrompt: string;
  improvements: PromptImprovement[];
  metrics: {
    clarity: number;
    specificity: number;
    context: number;
    structure: number;
    overall: number;
  };
  estimatedTokens: number;
  suggestions: string[];
}

export interface PromptImprovement {
  type: 'clarity' | 'specificity' | 'context' | 'structure' | 'examples' | 'constraints';
  description: string;
  before: string;
  after: string;
  impact: 'high' | 'medium' | 'low';
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  template: string;
  variables: string[];
  exampleInput?: string;
  exampleOutput?: string;
  tags: string[];
}

export interface PromptOptimizationOptions {
  goal?: string;
  targetModel?: string;
  maxLength?: number;
  style?: 'concise' | 'detailed' | 'technical' | 'conversational';
  addExamples?: boolean;
  addConstraints?: boolean;
  improveStructure?: boolean;
}

export interface PromptTestResult {
  prompt: string;
  response: string;
  metrics: {
    responseQuality: number;
    relevance: number;
    completeness: number;
    tokenUsage: number;
    latency: number;
  };
  timestamp: Date;
}

export interface PromptVersion {
  id: string;
  prompt: string;
  version: number;
  timestamp: Date;
  tags: string[];
  testResults?: PromptTestResult[];
  notes?: string;
}

// Cloud Sync Types
export type SyncProvider = 'supabase' | 'custom' | 'none';

export interface CloudSyncConfig {
  provider: SyncProvider;
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // in seconds
  lastSyncAt?: Date;
  syncDirection: 'upload' | 'download' | 'bidirectional';
  excludedPaths?: string[];
}

export interface SyncStatus {
  status: 'idle' | 'syncing' | 'error' | 'offline';
  progress?: number;
  lastSync?: Date;
  error?: string;
  pendingChanges: number;
}

export interface SyncItem {
  id: string;
  path: string;
  type: 'file' | 'directory' | 'setting' | 'agent' | 'project';
  action: 'create' | 'update' | 'delete';
  localVersion: string;
  remoteVersion?: string;
  status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error';
  timestamp: Date;
  deviceId: string;
}

export interface CloudSession {
  id: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  lastActiveAt: Date;
  currentProject?: string;
  status: 'active' | 'idle' | 'disconnected';
}

export interface TeleportRequest {
  id: string;
  sourceDeviceId: string;
  targetDeviceId: string;
  projectPath: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

// Realtime API Types (Voice/Audio)
export interface RealtimeConfig {
  provider: 'openai' | 'custom';
  apiKey?: string;
  voice?: string;
  model?: string;
  language?: string;
  enableSTT: boolean;
  enableTTS: boolean;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface SpeechSynthesisOptions {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface AudioStream {
  data: string; // base64
  format: 'mp3' | 'wav' | 'opus';
  sampleRate: number;
  channels: number;
}

// Agent SDK Types
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  tools?: string[];
  skills?: string[];
  guardrails?: AgentGuardrail[];
}

export interface AgentGuardrail {
  type: 'input_filter' | 'output_filter' | 'tool_restriction';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AgentExecutionContext {
  agentId: string;
  sessionId: string;
  messages: AgentMessage[];
  metadata: Record<string, any>;
}

export interface AgentHandler {
  name: string;
  description: string;
  parameters?: Record<string, any>;
  execute: (context: AgentExecutionContext, params: any) => Promise<any>;
}

// Slash Commands Types
export interface SlashCommand {
  id: string;
  name: string;
  description: string;
  usage: string;
  aliases?: string[];
  execute: (args: string, context: any) => Promise<SlashCommandResult>;
}

export interface SlashCommandResult {
  success: boolean;
  message?: string;
  output?: any;
  error?: string;
}

// Hook Types
export interface Hook {
  id: string;
  name: string;
  trigger: 'pre' | 'post';
  event: string;
  command: string;
  enabled: boolean;
  timeout?: number;
}

export interface HookExecution {
  hookId: string;
  event: string;
  trigger: 'pre' | 'post';
  startTime: Date;
  endTime?: Date;
  success: boolean;
  output?: string;
  error?: string;
}

// GitHub Actions / CI-CD Types
export interface CICDConfig {
  provider: 'github' | 'gitlab' | 'custom';
  enabled: boolean;
  workflowPath?: string;
  triggers?: string[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  conclusion?: 'success' | 'failure' | 'cancelled';
  logs?: string;
  startedAt: Date;
  completedAt?: Date;
  url?: string;
}

export interface CIAction {
  type: 'run_workflow' | 'cancel_run' | 'get_logs' | 'get_status';
  workflowId?: string;
  runId?: string;
}

// Context Optimization Types
export interface ContextCompactionConfig {
  enabled: boolean;
  threshold: number; // tokens
  strategy: 'summarize' | 'prune' | 'hybrid';
}

export interface PromptCacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // entries
}

export interface CompactionResult {
  originalTokens: number;
  compactedTokens: number;
  removedMessages: number;
  summary?: string;
}

// Enterprise Types
export interface SSOConfig {
  provider: 'okta' | 'azure-ad' | 'google' | 'custom';
  enabled: boolean;
  metadataUrl?: string;
  clientId?: string;
}

export interface RBACRole {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
}

export interface RBACUser {
  id: string;
  email: string;
  roles: string[];
  lastLogin?: Date;
}

// Connector Types
export interface ConnectorConfig {
  id: string;
  type: 'jira' | 'notion' | 'sentry' | 'linear' | 'slack';
  enabled: boolean;
  config: Record<string, any>;
}

export interface ConnectorCredentials {
  connectorId: string;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
}