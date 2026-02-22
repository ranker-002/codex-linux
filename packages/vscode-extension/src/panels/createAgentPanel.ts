import * as vscode from 'vscode';
import { CodexAPI } from '../api';

export class CreateAgentPanel {
  public static currentPanel: CreateAgentPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    api: CodexAPI,
    onCreated: () => void
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (CreateAgentPanel.currentPanel) {
      CreateAgentPanel.currentPanel._panel.reveal(column);
      return CreateAgentPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'codexCreateAgent',
      'Create Agent',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    CreateAgentPanel.currentPanel = new CreateAgentPanel(panel, api, onCreated, extensionUri);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private _api: CodexAPI,
    private _onCreated: () => void,
    private readonly _extensionUri: vscode.Uri
  ) {
    this._panel = panel;
    this._panel.webview.html = this._getHtmlForWebview();

    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'createAgent':
            await this._createAgent(message.config);
            return;
        }
      },
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  private async _createAgent(config: any) {
    try {
      this._panel.webview.postMessage({ command: 'setLoading', loading: true });
      
      await this._api.createAgent(config);
      
      vscode.window.showInformationMessage('Agent created successfully!');
      this._onCreated();
      this._panel.dispose();
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'showError',
        text: `Failed to create agent: ${error}`
      });
    } finally {
      this._panel.webview.postMessage({ command: 'setLoading', loading: false });
    }
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
    h2 {
      margin-bottom: 20px;
      color: var(--vscode-foreground);
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    input, select {
      width: 100%;
      padding: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      box-sizing: border-box;
    }
    input:focus, select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    button {
      padding: 10px 20px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      color: var(--vscode-inputValidation-errorForeground);
      background: var(--vscode-inputValidation-errorBackground);
      padding: 8px;
      border-radius: 4px;
      margin-bottom: 15px;
      display: none;
    }
  </style>
</head>
<body>
  <h2>Create New Agent</h2>
  
  <div class="error" id="error"></div>
  
  <div class="form-group">
    <label for="name">Agent Name</label>
    <input type="text" id="name" placeholder="My Coding Agent" />
  </div>
  
  <div class="form-group">
    <label for="projectPath">Project Path</label>
    <input type="text" id="projectPath" placeholder="/path/to/project" />
  </div>
  
  <div class="form-group">
    <label for="provider">AI Provider</label>
    <select id="provider">
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option>
    </select>
  </div>
  
  <div class="form-group">
    <label for="model">Model</label>
    <select id="model">
      <option value="gpt-4o">GPT-4o</option>
      <option value="gpt-4o-mini">GPT-4o Mini</option>
      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
      <option value="claude-3-opus-20240229">Claude 3 Opus</option>
    </select>
  </div>
  
  <button id="createButton">Create Agent</button>

  <script>
    const vscode = acquireVsCodeApi();
    const errorDiv = document.getElementById('error');
    const createButton = document.getElementById('createButton');

    createButton.addEventListener('click', () => {
      const name = document.getElementById('name').value;
      const projectPath = document.getElementById('projectPath').value;
      const providerId = document.getElementById('provider').value;
      const model = document.getElementById('model').value;

      if (!name || !projectPath) {
        errorDiv.textContent = 'Please fill in all required fields';
        errorDiv.style.display = 'block';
        return;
      }

      errorDiv.style.display = 'none';
      
      vscode.postMessage({
        command: 'createAgent',
        config: { name, projectPath, providerId, model }
      });
    });

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'setLoading') {
        createButton.disabled = message.loading;
        createButton.textContent = message.loading ? 'Creating...' : 'Create Agent';
      } else if (message.command === 'showError') {
        errorDiv.textContent = message.text;
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    CreateAgentPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}