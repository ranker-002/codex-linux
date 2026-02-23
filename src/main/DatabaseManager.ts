import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import log from 'electron-log';
import { Agent, AgentMessage, AgentTask, CodeChange, Automation, Project, ChangeStatus, Checkpoint } from '../shared/types';

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
      
      // Reset any "running" queue items from previous sessions
      this.db.prepare("UPDATE agent_queue_items SET status = 'pending' WHERE status = 'running'").run();
      
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
        permission_mode TEXT NOT NULL DEFAULT 'ask',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_active_at INTEGER,
        metadata TEXT
      )
    `);

    // Agent queue items table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_queue_items (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        error TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
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

    // Checkpoints table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        change_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        restored_at INTEGER
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_agent ON agent_messages(agent_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_agent ON agent_tasks(agent_id);
      CREATE INDEX IF NOT EXISTS idx_changes_agent ON code_changes(agent_id);
      CREATE INDEX IF NOT EXISTS idx_automations_enabled ON automations(enabled);
      CREATE INDEX IF NOT EXISTS idx_checkpoints_agent ON checkpoints(agent_id);
      CREATE INDEX IF NOT EXISTS idx_queue_agent ON agent_queue_items(agent_id);
      CREATE INDEX IF NOT EXISTS idx_queue_agent_pos ON agent_queue_items(agent_id, position);
    `);
  }

  // Agent queue
  async listAgentQueueItems(agentId: string): Promise<Array<{ id: string; agentId: string; type: 'message' | 'task'; content: string; status: 'pending' | 'running'; position: number; createdAt: Date }>> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare(
      "SELECT * FROM agent_queue_items WHERE agent_id = ? AND status IN ('pending','running') ORDER BY position ASC"
    ).all(agentId) as any[];

    return rows.map(r => ({
      id: r.id,
      agentId: r.agent_id,
      type: r.type,
      content: r.content,
      status: r.status,
      position: r.position,
      createdAt: new Date(r.created_at)
    }));
  }

  async enqueueAgentQueueItem(agentId: string, type: 'message' | 'task', content: string): Promise<{ id: string }> {
    if (!this.db) throw new Error('Database not initialized');

    const trimmed = content.trim();
    if (!trimmed) throw new Error('Queue item content cannot be empty');

    const maxPosRow = this.db.prepare('SELECT MAX(position) as maxPos FROM agent_queue_items WHERE agent_id = ?').get(agentId) as any;
    const nextPos = (maxPosRow?.maxPos ?? -1) + 1;
    const id = `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    this.db.prepare(
      'INSERT INTO agent_queue_items (id, agent_id, type, content, status, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, agentId, type, trimmed, 'pending', nextPos, Date.now());

    return { id };
  }

  async deleteAgentQueueItem(agentId: string, itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(() => {
      this.db!.prepare('DELETE FROM agent_queue_items WHERE id = ? AND agent_id = ?').run(itemId, agentId);

      const rows = this.db!.prepare('SELECT id FROM agent_queue_items WHERE agent_id = ? ORDER BY position ASC').all(agentId) as any[];
      const update = this.db!.prepare('UPDATE agent_queue_items SET position = ? WHERE id = ?');
      rows.forEach((r, idx) => update.run(idx, r.id));
    });

    tx();
  }

  async moveAgentQueueItemUp(agentId: string, itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare('SELECT id, position FROM agent_queue_items WHERE id = ? AND agent_id = ?').get(itemId, agentId) as any;
    if (!row) return;
    if (row.position <= 0) return;

    const prev = this.db.prepare('SELECT id, position FROM agent_queue_items WHERE agent_id = ? AND position = ?').get(agentId, row.position - 1) as any;
    if (!prev) return;

    const tx = this.db.transaction(() => {
      this.db!.prepare('UPDATE agent_queue_items SET position = ? WHERE id = ?').run(row.position - 1, row.id);
      this.db!.prepare('UPDATE agent_queue_items SET position = ? WHERE id = ?').run(prev.position + 1, prev.id);
    });
    tx();
  }

  async claimNextAgentQueueItem(agentId: string): Promise<{ id: string; type: 'message' | 'task'; content: string } | null> {
    if (!this.db) throw new Error('Database not initialized');

    const tx = this.db.transaction(() => {
      const next = this.db!.prepare(
        "SELECT * FROM agent_queue_items WHERE agent_id = ? AND status = 'pending' ORDER BY position ASC LIMIT 1"
      ).get(agentId) as any;
      if (!next) return null;

      this.db!.prepare(
        "UPDATE agent_queue_items SET status = 'running', started_at = ? WHERE id = ?"
      ).run(Date.now(), next.id);

      return { id: next.id, type: next.type, content: next.content } as { id: string; type: 'message' | 'task'; content: string };
    });

    return tx();
  }

  async completeAgentQueueItem(agentId: string, itemId: string, outcome: 'completed' | 'failed', error?: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Mark as completed/failed with outcome and error
    this.db.prepare(
      "UPDATE agent_queue_items SET status = ?, completed_at = ?, error = ? WHERE id = ? AND agent_id = ?"
    ).run(outcome, Date.now(), error || null, itemId, agentId);
  }

  async getQueueHistory(agentId: string, limit: number = 50): Promise<Array<{ id: string; type: 'message' | 'task'; content: string; status: string; createdAt: Date; completedAt?: Date; error?: string }>> {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db.prepare(
      "SELECT * FROM agent_queue_items WHERE agent_id = ? AND status IN ('completed','failed') ORDER BY completed_at DESC LIMIT ?"
    ).all(agentId, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      type: r.type,
      content: r.content,
      status: r.status,
      createdAt: new Date(r.created_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : undefined,
      error: r.error || undefined
    }));
  }

  // Checkpoints
  async listCheckpoints(agentId?: string): Promise<Checkpoint[]> {
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM checkpoints';
    const params: any[] = [];

    if (agentId) {
      query += ' WHERE agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      changeId: row.change_id,
      filePath: row.file_path,
      content: row.content,
      createdAt: new Date(row.created_at),
      restoredAt: row.restored_at ? new Date(row.restored_at) : undefined
    }));
  }

  async restoreCheckpoint(checkpointId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const checkpointRow = this.db.prepare('SELECT * FROM checkpoints WHERE id = ?').get(checkpointId) as any;
    if (!checkpointRow) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const agentRow = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(checkpointRow.agent_id) as any;
    if (!agentRow) {
      throw new Error(`Agent ${checkpointRow.agent_id} not found for checkpoint ${checkpointId}`);
    }

    const agentMetadata = agentRow.metadata ? JSON.parse(agentRow.metadata) : {};
    const worktreePath: string | undefined = agentMetadata.worktreePath || undefined;
    if (!worktreePath || typeof worktreePath !== 'string') {
      throw new Error(`Worktree path not available for agent ${agentRow.id}`);
    }

    const relativeFilePath = String(checkpointRow.file_path || '').trim();
    if (!relativeFilePath) {
      throw new Error(`Invalid file path for checkpoint ${checkpointId}`);
    }

    const targetPath = path.resolve(worktreePath, relativeFilePath);
    const resolvedRoot = path.resolve(worktreePath);
    if (!targetPath.startsWith(resolvedRoot + path.sep) && targetPath !== resolvedRoot) {
      throw new Error('Refusing to write outside of worktree root');
    }

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, checkpointRow.content || '', 'utf-8');

    this.db.prepare('UPDATE checkpoints SET restored_at = ? WHERE id = ?').run(Date.now(), checkpointId);
    log.info(`Restored checkpoint ${checkpointId} to ${relativeFilePath}`);
  }

  async restoreLastCheckpoint(agentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db.prepare(
      'SELECT * FROM checkpoints WHERE agent_id = ? AND restored_at IS NULL ORDER BY created_at DESC LIMIT 1'
    ).get(agentId) as any;

    if (!row) {
      throw new Error('No checkpoint available');
    }

    await this.restoreCheckpoint(row.id);
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
    const params: any[] = [];

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

    const changeRow = this.db.prepare('SELECT * FROM code_changes WHERE id = ?').get(changeId) as any;
    if (!changeRow) {
      throw new Error(`Code change ${changeId} not found`);
    }

    if (changeRow.status !== ChangeStatus.APPROVED) {
      throw new Error(`Code change ${changeId} must be approved before applying`);
    }

    const agentRow = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(changeRow.agent_id) as any;
    if (!agentRow) {
      throw new Error(`Agent ${changeRow.agent_id} not found for code change ${changeId}`);
    }

    const agentMetadata = agentRow.metadata ? JSON.parse(agentRow.metadata) : {};
    const worktreePath: string | undefined = agentMetadata.worktreePath || undefined;

    if (!worktreePath || typeof worktreePath !== 'string') {
      throw new Error(`Worktree path not available for agent ${agentRow.id}`);
    }

    const relativeFilePath = String(changeRow.file_path || '').trim();
    if (!relativeFilePath) {
      throw new Error(`Invalid file path for code change ${changeId}`);
    }

    const targetPath = path.resolve(worktreePath, relativeFilePath);
    const resolvedRoot = path.resolve(worktreePath);
    if (!targetPath.startsWith(resolvedRoot + path.sep) && targetPath !== resolvedRoot) {
      throw new Error('Refusing to write outside of worktree root');
    }

    let currentContent = '';
    try {
      currentContent = await fs.promises.readFile(targetPath, 'utf-8');
    } catch {
      currentContent = '';
    }

    const checkpointId = `cp_${changeId}_${Date.now()}`;
    this.db.prepare(
      'INSERT INTO checkpoints (id, agent_id, change_id, file_path, content, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(
      checkpointId,
      changeRow.agent_id,
      changeId,
      relativeFilePath,
      currentContent,
      Date.now()
    );

    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.writeFile(targetPath, changeRow.new_content || '', 'utf-8');

    this.db.prepare('UPDATE code_changes SET status = ? WHERE id = ?').run(ChangeStatus.APPLIED, changeId);
    log.info(`Applied code change ${changeId} to ${relativeFilePath}`);
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
      permissionMode: row.permission_mode || 'ask',
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : null,
      messages: [],
      tasks: [],
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }

  // Project operations
  async createProject(project: Project): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, path, git_remote, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      project.id,
      project.name,
      project.path,
      project.gitRemote || null,
      project.createdAt.getTime(),
      project.updatedAt.getTime()
    );
  }

  async updateProject(project: Project): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE projects SET
        name = ?,
        path = ?,
        git_remote = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      project.name,
      project.path,
      project.gitRemote || null,
      project.updatedAt.getTime(),
      project.id
    );
  }

  async getProject(id: string): Promise<Project | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      gitRemote: row.git_remote || undefined,
      agents: [],
      worktrees: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async getProjectByPath(projectPath: string): Promise<Project | null> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM projects WHERE path = ?');
    const row = stmt.get(projectPath) as any;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      path: row.path,
      gitRemote: row.git_remote || undefined,
      agents: [],
      worktrees: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  async listProjects(): Promise<Project[]> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      path: row.path,
      gitRemote: row.git_remote || undefined,
      agents: [],
      worktrees: [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }
}