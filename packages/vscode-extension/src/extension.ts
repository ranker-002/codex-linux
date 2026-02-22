import * as vscode from 'vscode';
import { CodexAPI } from './api';
import { AgentsProvider } from './providers/agentsProvider';
import { ChatPanel } from './panels/chatPanel';
import { CreateAgentPanel } from './panels/createAgentPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Codex Linux extension is now active');

  // Initialize API client
  const config = vscode.workspace.getConfiguration('codex');
  const api = new CodexAPI(
    config.get('api.host', 'localhost'),
    config.get('api.port', 3001),
    config.get('api.key', '')
  );

  // Tree data provider for agents
  const agentsProvider = new AgentsProvider(api);
  vscode.window.registerTreeDataProvider('codex.agents', agentsProvider);

  // Register commands
  const disposables = [
    // Start Codex
    vscode.commands.registerCommand('codex.start', async () => {
      const terminal = vscode.window.createTerminal('Codex Linux');
      terminal.sendText('codex');
      terminal.show();
      
      // Check if server is running
      const isHealthy = await api.checkHealth();
      if (!isHealthy) {
        vscode.window.showWarningMessage('Codex server is not running. Please start it first.');
      }
    }),

    // Refresh agents
    vscode.commands.registerCommand('codex.refreshAgents', () => {
      agentsProvider.refresh();
    }),

    // Create agent
    vscode.commands.registerCommand('codex.createAgent', () => {
      CreateAgentPanel.createOrShow(context.extensionUri, api, () => {
        agentsProvider.refresh();
      });
    }),

    // Chat with agent
    vscode.commands.registerCommand('codex.chat', async () => {
      const agents = await api.getAgents();
      if (agents.length === 0) {
        vscode.window.showInformationMessage('No agents found. Create one first.');
        return;
      }
      
      const items = agents.map(a => ({ label: a.name, id: a.id }));
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an agent to chat with'
      });
      
      if (selected) {
        ChatPanel.createOrShow(context.extensionUri, api, selected.id);
      }
    }),

    // Open agent chat from tree
    vscode.commands.registerCommand('codex.openAgent', (agentId: string) => {
      ChatPanel.createOrShow(context.extensionUri, api, agentId);
    }),

    // Explain selected code
    vscode.commands.registerCommand('codex.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage('No code selected');
        return;
      }

      const agents = await api.getAgents();
      if (agents.length === 0) {
        vscode.window.showInformationMessage('Create an agent first to use this feature.');
        return;
      }

      const panel = ChatPanel.createOrShow(context.extensionUri, api, agents[0].id);
      panel.sendMessage(`Explain this code:\n\n${selection}`);
    }),

    // Refactor selected code
    vscode.commands.registerCommand('codex.refactor', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.document.getText(editor.selection);
      if (!selection) {
        vscode.window.showWarningMessage('No code selected');
        return;
      }

      const agents = await api.getAgents();
      if (agents.length === 0) {
        vscode.window.showInformationMessage('Create an agent first to use this feature.');
        return;
      }

      const panel = ChatPanel.createOrShow(context.extensionUri, api, agents[0].id);
      panel.sendMessage(`Refactor this code to improve readability and performance:\n\n${selection}`);
    }),

    // Generate tests
    vscode.commands.registerCommand('codex.test', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const document = editor.document;
      const fileName = document.fileName;
      const language = document.languageId;

      const agents = await api.getAgents();
      if (agents.length === 0) {
        vscode.window.showInformationMessage('Create an agent first to use this feature.');
        return;
      }

      const panel = ChatPanel.createOrShow(context.extensionUri, api, agents[0].id);
      panel.sendMessage(`Generate comprehensive tests for the code in ${fileName} (${language})`);
    }),

    // Delete agent
    vscode.commands.registerCommand('codex.deleteAgent', async (agentId: string) => {
      const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this agent?',
        'Yes',
        'No'
      );
      
      if (confirm === 'Yes') {
        try {
          await api.deleteAgent(agentId);
          agentsProvider.refresh();
          vscode.window.showInformationMessage('Agent deleted successfully');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete agent: ${error}`);
        }
      }
    })
  ];

  context.subscriptions.push(...disposables);

  // Set context
  vscode.commands.executeCommand('setContext', 'codex.enabled', true);
}

export function deactivate() {
  console.log('Codex Linux extension is now deactivated');
}