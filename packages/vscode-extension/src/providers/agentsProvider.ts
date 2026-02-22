import * as vscode from 'vscode';
import { CodexAPI } from '../api';

export class AgentItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    public readonly label: string,
    public readonly status: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
    
    this.tooltip = `${label} (${status})`;
    this.description = status;
    
    // Set icon based on status
    if (status === 'running') {
      this.iconPath = new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('charts.green'));
    } else if (status === 'error') {
      this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    } else if (status === 'paused') {
      this.iconPath = new vscode.ThemeIcon('debug-pause');
    } else {
      this.iconPath = new vscode.ThemeIcon('debug-start');
    }
    
    this.command = {
      command: 'codex.openAgent',
      title: 'Open Chat',
      arguments: [id]
    };
    
    this.contextValue = 'agent';
  }
}

export class AgentsProvider implements vscode.TreeDataProvider<AgentItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgentItem | undefined | null | void> = new vscode.EventEmitter<AgentItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AgentItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(private api: CodexAPI) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<AgentItem[]> {
    try {
      const agents = await this.api.getAgents();
      
      if (agents.length === 0) {
        return [new AgentItem(
          'empty',
          'No agents found',
          '',
          vscode.TreeItemCollapsibleState.None
        )];
      }
      
      return agents.map(agent => new AgentItem(
        agent.id,
        agent.name,
        agent.status,
        vscode.TreeItemCollapsibleState.None
      ));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load agents: ${error}`);
      return [new AgentItem(
        'error',
        'Error loading agents',
        '',
        vscode.TreeItemCollapsibleState.None
      )];
    }
  }
}