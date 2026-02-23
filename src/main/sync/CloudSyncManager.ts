import { EventEmitter } from 'events';
import log from 'electron-log';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Agent, AgentMessage, AgentStatus } from '../../shared/types';

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any> | null;
  old: Record<string, any> | null;
}

interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseKey: string;
  userId: string;
  deviceId: string;
  syncInterval: number;
  enabled: boolean;
}

interface SyncedThread {
  id: string;
  agentId: string;
  userId: string;
  deviceId: string;
  projectPath: string;
  messages: AgentMessage[];
  status: AgentStatus;
  lastModified: number;
  version: number;
  isDeleted: boolean;
}

interface SyncConflict {
  threadId: string;
  localVersion: SyncedThread;
  remoteVersion: SyncedThread;
  resolution: 'local' | 'remote' | 'merge';
}

export class CloudSyncManager extends EventEmitter {
  private supabase: SupabaseClient | null = null;
  private config: CloudSyncConfig;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingChanges: Map<string, SyncedThread> = new Map();
  private lastSyncTime: number = 0;
  private isSyncing: boolean = false;
  private realtimeSubscription: any = null;

  constructor(config: CloudSyncConfig) {
    super();
    this.config = config;
    
    if (config.enabled) {
      this.initializeSupabase();
    }
  }

  private initializeSupabase(): void {
    try {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
      log.info('Cloud Sync: Supabase client initialized');
    } catch (error) {
      log.error('Cloud Sync: Failed to initialize Supabase:', error);
      this.emit('error', { type: 'init', error });
    }
  }

  async enable(): Promise<void> {
    if (!this.supabase) {
      this.initializeSupabase();
    }
    
    this.config.enabled = true;
    await this.startSync();
    this.setupRealtimeSubscription();
    
    log.info('Cloud Sync: Enabled');
    this.emit('enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.stopSync();
    this.removeRealtimeSubscription();
    
    log.info('Cloud Sync: Disabled');
    this.emit('disabled');
  }

  private setupRealtimeSubscription(): void {
    if (!this.supabase) return;

    this.realtimeSubscription = this.supabase
      .channel('threads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
          filter: `user_id=eq.${this.config.userId}`,
        },
        (payload) => {
          this.handleRealtimeChange(payload);
        }
      )
      .subscribe();

    log.info('Cloud Sync: Realtime subscription active');
  }

  private removeRealtimeSubscription(): void {
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
  }

  private async handleRealtimeChange(payload: RealtimePayload): Promise<void> {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    // Ignore changes from this device
    if (newRecord?.device_id === this.config.deviceId) return;

    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        if (newRecord) {
          const remoteThread = this.deserializeThread(newRecord);
          await this.handleRemoteChange(remoteThread);
        }
        break;
      case 'DELETE':
        if (oldRecord?.id) {
          this.emit('thread:deleted', { threadId: oldRecord.id });
        }
        break;
    }
  }

  private async handleRemoteChange(remoteThread: SyncedThread): Promise<void> {
    const localThread = await this.getLocalThread(remoteThread.id);
    
    if (!localThread) {
      // New thread from another device
      await this.saveLocalThread(remoteThread);
      this.emit('thread:remote-created', { thread: remoteThread });
    } else if (remoteThread.version > localThread.version) {
      // Remote has newer version
      if (this.pendingChanges.has(remoteThread.id)) {
        // Conflict detected
        await this.resolveConflict(localThread, remoteThread);
      } else {
        // No local changes, accept remote
        await this.saveLocalThread(remoteThread);
        this.emit('thread:updated', { thread: remoteThread, source: 'remote' });
      }
    }
  }

  async syncThread(agent: Agent): Promise<void> {
    if (!this.config.enabled || !this.supabase) return;

    const thread: SyncedThread = {
      id: agent.id,
      agentId: agent.id,
      userId: this.config.userId,
      deviceId: this.config.deviceId,
      projectPath: agent.projectPath,
      messages: agent.messages,
      status: agent.status,
      lastModified: Date.now(),
      version: (agent.version || 0) + 1,
      isDeleted: false,
    };

    this.pendingChanges.set(agent.id, thread);
    
    // Immediate sync for important changes
    await this.performSync();
  }

  async startSync(): Promise<void> {
    if (this.syncInterval) return;

    // Initial sync
    await this.performSync();

    // Periodic sync
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.config.syncInterval);

    log.info('Cloud Sync: Started with interval', this.config.syncInterval);
  }

  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    log.info('Cloud Sync: Stopped');
  }

  private async performSync(): Promise<void> {
    if (this.isSyncing || !this.supabase || !this.config.enabled) return;

    this.isSyncing = true;
    this.emit('sync:started');

    try {
      // Upload pending changes
      for (const [threadId, thread] of this.pendingChanges) {
        await this.uploadThread(thread);
        this.pendingChanges.delete(threadId);
      }

      // Download remote changes
      const remoteThreads = await this.downloadThreads();
      
      for (const remoteThread of remoteThreads) {
        if (remoteThread.deviceId !== this.config.deviceId) {
          await this.handleRemoteChange(remoteThread);
        }
      }

      this.lastSyncTime = Date.now();
      this.emit('sync:completed', { timestamp: this.lastSyncTime });
      
    } catch (error) {
      log.error('Cloud Sync: Sync failed:', error);
      this.emit('sync:error', { error });
    } finally {
      this.isSyncing = false;
    }
  }

  private async uploadThread(thread: SyncedThread): Promise<void> {
    if (!this.supabase) return;

    const record = this.serializeThread(thread);

    const { error } = await this.supabase
      .from('threads')
      .upsert(record, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (error) {
      throw new Error(`Failed to upload thread: ${error.message}`);
    }

    log.debug('Cloud Sync: Uploaded thread', thread.id);
  }

  private async downloadThreads(): Promise<SyncedThread[]> {
    if (!this.supabase) return [];

    const { data, error } = await this.supabase
      .from('threads')
      .select('*')
      .eq('user_id', this.config.userId)
      .eq('is_deleted', false)
      .gt('last_modified', this.lastSyncTime);

    if (error) {
      throw new Error(`Failed to download threads: ${error.message}`);
    }

    return (data || []).map(record => this.deserializeThread(record));
  }

  private async resolveConflict(
    localVersion: SyncedThread,
    remoteVersion: SyncedThread
  ): Promise<void> {
    const conflict: SyncConflict = {
      threadId: localVersion.id,
      localVersion,
      remoteVersion,
      resolution: 'merge', // Default to merge
    };

    // Attempt automatic merge
    const mergedThread = this.mergeThreads(localVersion, remoteVersion);
    
    if (mergedThread) {
      // Save merged version
      mergedThread.version = Math.max(localVersion.version, remoteVersion.version) + 1;
      await this.saveLocalThread(mergedThread);
      this.pendingChanges.set(mergedThread.id, mergedThread);
      
      conflict.resolution = 'merge';
      this.emit('conflict:resolved', { conflict, mergedThread });
    } else {
      // Manual resolution required
      this.emit('conflict:detected', { conflict });
    }
  }

  private mergeThreads(
    local: SyncedThread,
    remote: SyncedThread
  ): SyncedThread | null {
    // Simple merge: combine unique messages
    const messageMap = new Map<string, AgentMessage>();
    
    [...local.messages, ...remote.messages].forEach(msg => {
      if (!messageMap.has(msg.id)) {
        messageMap.set(msg.id, msg);
      }
    });

    const mergedMessages = Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return {
      ...local,
      messages: mergedMessages,
      lastModified: Date.now(),
      version: Math.max(local.version, remote.version) + 1,
    };
  }

  async resolveConflictManually(
    threadId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> {
    const localThread = await this.getLocalThread(threadId);
    const remoteThread = await this.getRemoteThread(threadId);

    if (!localThread || !remoteThread) {
      throw new Error('Thread not found');
    }

    let resolvedThread: SyncedThread;

    switch (resolution) {
      case 'local':
        resolvedThread = localThread;
        resolvedThread.version = remoteThread.version + 1;
        break;
      case 'remote':
        resolvedThread = remoteThread;
        break;
      case 'merge':
        const merged = this.mergeThreads(localThread, remoteThread);
        if (!merged) throw new Error('Merge failed');
        resolvedThread = merged;
        break;
    }

    await this.saveLocalThread(resolvedThread);
    this.pendingChanges.set(resolvedThread.id, resolvedThread);
    await this.performSync();

    this.emit('conflict:resolved', {
      threadId,
      resolution,
      thread: resolvedThread,
    });
  }

  private serializeThread(thread: SyncedThread): any {
    return {
      id: thread.id,
      agent_id: thread.agentId,
      user_id: thread.userId,
      device_id: thread.deviceId,
      project_path: thread.projectPath,
      messages: JSON.stringify(thread.messages),
      status: thread.status,
      last_modified: thread.lastModified,
      version: thread.version,
      is_deleted: thread.isDeleted,
    };
  }

  private deserializeThread(record: Record<string, any>): SyncedThread {
    return {
      id: record.id,
      agentId: record.agent_id,
      userId: record.user_id,
      deviceId: record.device_id,
      projectPath: record.project_path,
      messages: JSON.parse(record.messages || '[]'),
      status: record.status,
      lastModified: record.last_modified,
      version: record.version,
      isDeleted: record.is_deleted,
    };
  }

  private async getLocalThread(threadId: string): Promise<SyncedThread | null> {
    // This would integrate with DatabaseManager
    this.emit('thread:request-local', { threadId });
    return null;
  }

  private async saveLocalThread(thread: SyncedThread): Promise<void> {
    // This would integrate with DatabaseManager
    this.emit('thread:save-local', { thread });
  }

  private async getRemoteThread(threadId: string): Promise<SyncedThread | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (error || !data) return null;
    return this.deserializeThread(data);
  }

  async getAllSyncedThreads(): Promise<SyncedThread[]> {
    return this.downloadThreads();
  }

  async deleteThread(threadId: string): Promise<void> {
    if (!this.supabase) return;

    const { error } = await this.supabase
      .from('threads')
      .update({ is_deleted: true, last_modified: Date.now() })
      .eq('id', threadId);

    if (error) {
      throw new Error(`Failed to delete thread: ${error.message}`);
    }

    this.emit('thread:deleted', { threadId });
  }

  getSyncStatus(): {
    enabled: boolean;
    isSyncing: boolean;
    lastSyncTime: number;
    pendingChanges: number;
    deviceId: string;
  } {
    return {
      enabled: this.config.enabled,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingChanges: this.pendingChanges.size,
      deviceId: this.config.deviceId,
    };
  }

  async forceSync(): Promise<void> {
    if (!this.config.enabled) {
      throw new Error('Cloud sync is disabled');
    }
    await this.performSync();
  }

  cleanup(): void {
    this.stopSync();
    this.removeRealtimeSubscription();
    this.pendingChanges.clear();
    this.removeAllListeners();
    log.info('Cloud Sync: Cleaned up');
  }
}

export default CloudSyncManager;
