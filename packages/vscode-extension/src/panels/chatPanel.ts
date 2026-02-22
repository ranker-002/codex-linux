import * as vscode from 'vscode';
import { CodexAPI } from '../api';

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private _agentId: string;

  public static createOrShow(extensionUri: vscode.Uri, api: CodexAPI, agentId: string) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      ChatPanel.currentPanel._agentId = agentId;
      return ChatPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'codexChat',
      'Codex Chat',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ChatPanel.currentPanel = new ChatPanel(panel, api, agentId, extensionUri);
    return ChatPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private _api: CodexAPI,
    agentId: string,
    private readonly _extensionUri: vscode.Uri
  ) {
    this._panel = panel;
    this._agentId = agentId;
    this._panel.webview.html = this._getHtmlForWebview();
    
    // Set agent info
    this._updateAgentInfo();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'sendMessage':
            await this._sendMessage(message.text);
            return;
        }
      },
      null,
      this._disposables
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public sendMessage(text: string) {
    this._panel.webview.postMessage({ command: 'addUserMessage', text });
    this._sendMessage(text);
  }

  private async _sendMessage(text: string) {
    try {
      this._panel.webview.postMessage({ command: 'setLoading', loading: true });
      
      const response = await this._api.sendMessage(this._agentId, text);
      
      this._panel.webview.postMessage({
        command: 'addAssistantMessage',
        text: response.content
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: 'addError',
        text: `Error: ${error}`
      });
    } finally {
      this._panel.webview.postMessage({ command: 'setLoading', loading: false });
    }
  }

  private async _updateAgentInfo() {
    try {
      const agent = await this._api.getAgent(this._agentId);
      if (agent) {
        this._panel.title = `Chat: ${agent.name}`;
        this._panel.webview.postMessage({
          command: 'setAgentInfo',
          name: agent.name,
          status: agent.status
        });
      }
    } catch (error) {
      console.error('Failed to load agent info:', error);
    }
  }

  private _getHtmlForWebview() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      padding: 20px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .messages {
      height: calc(100vh - 150px);
      overflow-y: auto;
      margin-bottom: 20px;
    }
    .message {
      margin-bottom: 15px;
      padding: 10px;
      border-radius: 6px;
    }
    .user {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      margin-left: 20%;
    }
    .assistant {
      background: var(--vscode-editor-inactiveSelectionBackground);
      margin-right: 20%;
    }
    .error {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }
    .input-container {
      display: flex;
      gap: 10px;
    }
    input {
      flex: 1;
      padding: 8px;
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
    }
    button {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .loading {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2 id="agentName">Chat</h2>
    <span id="agentStatus"></span>
  </div>
  
  <div class="messages" id="messages"></div>
  
  <div class="loading" id="loading" style="display: none;">Thinking...</div>
  
  <div class="input-container">
    <input type="text" id="messageInput" placeholder="Type your message..." />
    <button id="sendButton">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingDiv = document.getElementById('loading');

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'message ' + type;
      div.textContent = text;
      messagesDiv.appendChild(div);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    sendButton.addEventListener('click', () => {
      const text = messageInput.value.trim();
      if (text) {
        addMessage(text, 'user');
        vscode.postMessage({ command: 'sendMessage', text });
        messageInput.value = '';
      }
    });

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendButton.click();
      }
    });

    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.command) {
        case 'addUserMessage':
          addMessage(message.text, 'user');
          break;
        case 'addAssistantMessage':
          addMessage(message.text, 'assistant');
          break;
        case 'addError':
          addMessage(message.text, 'error');
          break;
        case 'setLoading':
          loadingDiv.style.display = message.loading ? 'block' : 'none';
          sendButton.disabled = message.loading;
          break;
        case 'setAgentInfo':
          document.getElementById('agentName').textContent = message.name;
          document.getElementById('agentStatus').textContent = message.status;
          break;
      }
    });
  </script>
</body>
</html>`;
  }

  public dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}