import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import { PermissionMode, PermissionRequest } from '../../shared/types';

export type PermissionActionType = 'edit' | 'command' | 'tool';

export interface PermissionAction {
  type: PermissionActionType;
  action: string;
  details: Record<string, any>;
}

export class PermissionManager extends EventEmitter {
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private agentModes: Map<string, PermissionMode> = new Map();
  private settings: {
    allowBypassMode: boolean;
    defaultMode: PermissionMode;
  } = {
    allowBypassMode: false,
    defaultMode: PermissionMode.ASK
  };

  constructor() {
    super();
  }

  setAllowBypassMode(allowed: boolean): void {
    this.settings.allowBypassMode = allowed;
    log.info(`Bypass permission mode ${allowed ? 'enabled' : 'disabled'}`);
  }

  isBypassAllowed(): boolean {
    return this.settings.allowBypassMode;
  }

  setDefaultMode(mode: PermissionMode): void {
    this.settings.defaultMode = mode;
  }

  getDefaultMode(): PermissionMode {
    return this.settings.defaultMode;
  }

  setAgentMode(agentId: string, mode: PermissionMode): void {
    if (mode === PermissionMode.BYPASS && !this.settings.allowBypassMode) {
      throw new Error('Bypass permission mode is not enabled. Enable it in settings first.');
    }
    this.agentModes.set(agentId, mode);
    this.emit('mode:changed', { agentId, mode });
    log.info(`Permission mode set to ${mode} for agent ${agentId}`);
  }

  getAgentMode(agentId: string): PermissionMode {
    return this.agentModes.get(agentId) || this.settings.defaultMode;
  }

  async checkPermission(
    agentId: string,
    action: PermissionAction
  ): Promise<{ allowed: boolean; requestId?: string }> {
    const mode = this.getAgentMode(agentId);

    switch (mode) {
      case PermissionMode.ASK:
        // Always ask for permission
        const request = await this.createPermissionRequest(agentId, action);
        return { allowed: false, requestId: request.id };

      case PermissionMode.AUTO_ACCEPT_EDITS:
        // Auto-accept edits, ask for commands and tools
        if (action.type === 'edit') {
          return { allowed: true };
        }
        const editRequest = await this.createPermissionRequest(agentId, action);
        return { allowed: false, requestId: editRequest.id };

      case PermissionMode.PLAN:
        // In plan mode, never execute actions
        return { allowed: false };

      case PermissionMode.BYPASS:
        // Bypass all permissions
        return { allowed: true };

      default:
        return { allowed: false };
    }
  }

  private async createPermissionRequest(
    agentId: string,
    action: PermissionAction
  ): Promise<PermissionRequest> {
    const request: PermissionRequest = {
      id: uuidv4(),
      agentId,
      type: action.type,
      action: action.action,
      details: action.details,
      status: 'pending',
      createdAt: new Date()
    };

    this.pendingRequests.set(request.id, request);
    this.emit('permission:requested', request);
    
    log.info(`Permission requested for agent ${agentId}: ${action.type} - ${action.action}`);
    
    return request;
  }

  async approveRequest(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Permission request ${requestId} not found`);
    }

    request.status = 'approved';
    request.resolvedAt = new Date();
    
    this.emit('permission:approved', request);
    log.info(`Permission request ${requestId} approved`);
  }

  async rejectRequest(requestId: string): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      throw new Error(`Permission request ${requestId} not found`);
    }

    request.status = 'rejected';
    request.resolvedAt = new Date();
    
    this.pendingRequests.delete(requestId);
    this.emit('permission:rejected', request);
    log.info(`Permission request ${requestId} rejected`);
  }

  getPendingRequests(agentId?: string): PermissionRequest[] {
    const requests = Array.from(this.pendingRequests.values())
      .filter(r => r.status === 'pending');
    
    if (agentId) {
      return requests.filter(r => r.agentId === agentId);
    }
    
    return requests;
  }

  getRequest(requestId: string): PermissionRequest | undefined {
    return this.pendingRequests.get(requestId);
  }

  clearResolvedRequests(): void {
    for (const [id, request] of this.pendingRequests) {
      if (request.status !== 'pending') {
        this.pendingRequests.delete(id);
      }
    }
  }

  getPermissionModeDescription(mode: PermissionMode): string {
    switch (mode) {
      case PermissionMode.ASK:
        return 'Ask before editing files or running commands';
      case PermissionMode.AUTO_ACCEPT_EDITS:
        return 'Auto-accept file edits, ask for commands';
      case PermissionMode.PLAN:
        return 'Analyze only, no changes or commands';
      case PermissionMode.BYPASS:
        return 'Run without any permission prompts (dangerous)';
      default:
        return '';
    }
  }

  cleanup(): void {
    this.pendingRequests.clear();
    this.agentModes.clear();
    this.removeAllListeners();
  }
}
