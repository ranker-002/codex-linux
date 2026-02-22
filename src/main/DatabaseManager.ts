import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import log from 'electron-log';
import { Agent, AgentMessage, AgentTask, CodeChange, Automation, Project } from '../shared/types';

const DB_DIR = path.join(os.homedir(), '.config', 'codex');
const DB_PATH = path.join(DB_DIR, 'codex.db');

export class DatabaseManager {
  private db: Database.Database | null = null;

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      await fs.promises.mkdir(DB_DIR, { recursive: true });

      this.db = new Database(DB_PATH);
      
      // Enable WAL mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Create tables
      this.createTables();
      
      log.info(`Database initialized at ${DB_PATH}`);
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('Database connection closed');
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // Agents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        project_path TEXT NOT NULL,
        worktree_name TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        model TEXT NOT NULL,
        skills TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_active_at INTEGER,
        metadata TEXT
      )
    `);

    // Agent messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Agent tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        progress REAL NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        result TEXT,
        error TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Code changes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_changes (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        original_content TEXT,
        new_content TEXT,
        diff TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        reviewed_at INTEGER,
        reviewed_by TEXT,
        comment TEXT
      )
    `);

    // Automations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS automations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT NOT NULL,
        actions TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_run_at INTEGER,
        run_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        git_remote TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Cowork sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cowork_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        objective TEXT NOT NULL,
        progress REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        logs TEXT NOT NULL DEFAULT '[]',
        deliverables TEXT NOT NULL DEFAULT '[]',
        auto_approve INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_agent ON agent_messages(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON agent_tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_changes_agent ON code_changes(agent_id);
      CREATE INDEX IF NOT EXISTS idx_changes_status ON code_changes(status);
    `);
  }

  // Agent operations
  async createAgent(agent: Agent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO agents (
        id, name, status, project_path, worktree_name, provider_id, model,
        skills, created_at, updated_at, last_active_at, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      agent.id,
      agent.name,
      agent.status,
      agent.projectPath,
      agent.worktreeName,
      agent.providerId,
      agent.model,
      JSON.stringify(agent.skills),
      agent.createdAt.getTime(),
      agent.updatedAt.getTime(),
      agent.lastActiveAt?.getTime() || null,
      JSON.stringify(agent.metadata)
    );
  }

  async updateAgent(agent: Agent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE agents SET
        name = ?,
        status = ?,
        provider_id = ?,
        model = ?,
        skills = ?,
        updated_at = ?,
        last_active_at = ?,
        metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      agent.name,
      agent.status,
      agent.providerId,
      agent.model,
      JSON.stringify(agent.skills),
      agent.updatedAt.getTime(),
      agent.lastActiveAt?.getTime() || null,
      JSON.stringify(agent.metadata),
      agent.id
    );
  }

  async deleteAgent(agentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?');
    stmt.run(agentId);
  }

  async getAllAgents(): Promise<Agent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => this.mapAgentRow(row));
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(agentId) as any;

    if (!row) return null;

    const agent = this.mapAgentRow(row);
    
    // Load messages
    agent.messages = await this.getAgentMessages(agentId);
    
    // Load tasks
    agent.tasks = await this.getAgentTasks(agentId);

    return agent;
  }

  // Agent messages
  async addAgentMessage(message: AgentMessage, agentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO agent_messages (id, agent_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      message.id,
      agentId,
      message.role,
      message.content,
      message.timestamp.getTime(),
      JSON.stringify(message.metadata)
    );
  }

  async getAgentMessages(agentId: string): Promise<AgentMessage[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM agent_messages WHERE agent_id = ? ORDER BY timestamp ASC
    `);
    const rows = stmt.all(agentId) as any[];

    return rows.map(row => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: new Date(row.timestamp),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // Agent tasks
  async addAgentTask(task: AgentTask, agentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO agent_tasks (
        id, agent_id, description, status, progress, started_at, completed_at, result, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      task.id,
      agentId,
      task.description,
      task.status,
      task.progress,
      task.startedAt.getTime(),
      task.completedAt?.getTime() || null,
      task.result || null,
      task.error || null
    );
  }

  async updateAgentTask(task: AgentTask): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE agent_tasks SET
        status = ?,
        progress = ?,
        completed_at = ?,
        result = ?,
        error = ?
      WHERE id = ?
    `);

    stmt.run(
      task.status,
      task.progress,
      task.completedAt?.getTime() || null,
      task.result || null,
      task.error || null,
      task.id
    );
  }

  async getAgentTasks(agentId: string): Promise<AgentTask[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      SELECT * FROM agent_tasks WHERE agent_id = ? ORDER BY started_at DESC
    `);
    const rows = stmt.all(agentId) as any[];

    return rows.map(row => ({
      id: row.id,
      description: row.description,
      status: row.status,
      progress: row.progress,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      result: row.result || undefined,
      error: row.error || undefined
    }));
  }

  // Code changes
  async createCodeChange(change: CodeChange): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO code_changes (
        id, file_path, original_content, new_content, diff,
        agent_id, task_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      change.id,
      change.filePath,
      change.originalContent,
      change.newContent,
      change.diff,
      change.agentId,
      change.taskId,
      change.status,
      change.createdAt.getTime()
    );
  }

  async updateCodeChange(change: CodeChange): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE code_changes SET
        status = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        comment = ?
      WHERE id = ?
    `);

    stmt.run(
      change.status,
      change.reviewedAt?.getTime() || null,
      change.reviewedBy || null,
      change.comment || null,
      change.id
    );
  }

  // Code changes operations
  async getCodeChanges(agentId?: string): Promise<CodeChange[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM code_changes';
    let params: any[] = [];

    if (agentId) {
      query += ' WHERE agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      filePath: row.file_path,
      originalContent: row.original_content,
      newContent: row.new_content,
      diff: row.diff,
      agentId: row.agent_id,
      taskId: row.task_id,
      status: row.status,
      createdAt: new Date(row.created_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewedBy: row.reviewed_by || undefined,
      comment: row.comment || undefined
    }));
  }

  async approveCodeChange(changeId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE code_changes SET
        status = ?,
        reviewed_at = ?,
        reviewed_by = ?
      WHERE id = ?
    `);

    stmt.run(
      ChangeStatus.APPROVED,
      Date.now(),
      'user', // In real app, would get current user
      changeId
    );
  }

  async rejectCodeChange(changeId: string, comment?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE code_changes SET
        status = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        comment = ?
      WHERE id = ?
    `);

    stmt.run(
      ChangeStatus.REJECTED,
      Date.now(),
      'user',
      comment || null,
      changeId
    );
  }

  async applyCodeChange(changeId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE code_changes SET
        status = ?
      WHERE id = ?
    `);

    stmt.run(ChangeStatus.APPLIED, changeId);
  }

  // Cowork sessions
  async getCoworkSessions(): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM cowork_sessions ORDER BY created_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      agentId: row.agent_id,
      status: row.status,
      objective: row.objective,
      progress: row.progress,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      logs: JSON.parse(row.logs || '[]'),
      deliverables: JSON.parse(row.deliverables || '[]'),
      autoApprove: Boolean(row.auto_approve)
    }));
  }

  async saveCoworkSession(session: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cowork_sessions (
        id, name, agent_id, status, objective, progress,
        created_at, updated_at, completed_at, logs, deliverables, auto_approve
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.id,
      session.name,
      session.agentId,
      session.status,
      session.objective,
      session.progress,
      session.createdAt.getTime(),
      session.updatedAt.getTime(),
      session.completedAt?.getTime() || null,
      JSON.stringify(session.logs),
      JSON.stringify(session.deliverables),
      session.autoApprove ? 1 : 0
    );
  }

  private mapAgentRow(row: any): Agent {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      projectPath: row.project_path,
      worktreeName: row.worktree_name,
      providerId: row.provider_id,
      model: row.model,
      skills: JSON.parse(row.skills),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : null,
      messages: [],
      tasks: [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}