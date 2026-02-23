import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch from 'node-fetch';
import { ConnectorConfig, ConnectorCredentials } from '../../shared/types';

export class ConnectorManager extends EventEmitter {
  private connectors: Map<string, ConnectorConfig> = new Map();
  private credentials: Map<string, ConnectorCredentials> = new Map();

  constructor() {
    super();
  }

  async registerConnector(config: ConnectorConfig): Promise<void> {
    this.connectors.set(config.id, config);
    this.emit('connector:registered', config);
    log.info(`Registered connector: ${config.type} (${config.id})`);
  }

  async removeConnector(connectorId: string): Promise<void> {
    this.connectors.delete(connectorId);
    this.credentials.delete(connectorId);
    this.emit('connector:removed', connectorId);
  }

  getConnector(connectorId: string): ConnectorConfig | undefined {
    return this.connectors.get(connectorId);
  }

  getConnectorsByType(type: string): ConnectorConfig[] {
    return Array.from(this.connectors.values()).filter(c => c.type === type);
  }

  async setCredentials(connectorId: string, creds: ConnectorCredentials): Promise<void> {
    this.credentials.set(connectorId, creds);
    log.info(`Credentials set for connector: ${connectorId}`);
  }

  private getCredentials(connectorId: string): ConnectorCredentials | undefined {
    return this.credentials.get(connectorId);
  }

  // Jira Connector
  async createJiraIssue(connectorId: string, issue: {
    project: string;
    summary: string;
    description: string;
    issueType?: string;
  }): Promise<any> {
    const creds = this.getCredentials(connectorId);
    if (!creds?.accessToken) throw new Error('No credentials for Jira');

    const connector = this.connectors.get(connectorId);
    const baseUrl = connector?.config?.baseUrl || 'https://api.atlassian.com';

    const response = await fetch(`${baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: issue.project },
          summary: issue.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: issue.description }],
            }],
          },
          issuetype: { name: issue.issueType || 'Task' },
        },
      }),
    });

    if (!response.ok) throw new Error(`Jira API error: ${response.statusText}`);
    return response.json();
  }

  // Notion Connector
  async createNotionPage(connectorId: string, page: {
    databaseId: string;
    title: string;
    content?: string;
  }): Promise<any> {
    const creds = this.getCredentials(connectorId);
    if (!creds?.accessToken) throw new Error('No credentials for Notion');

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: page.databaseId },
        properties: {
          Name: {
            title: [{ text: { content: page.title } }],
          },
        },
        children: page.content ? [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: page.content } }],
          },
        }] : undefined,
      }),
    });

    if (!response.ok) throw new Error(`Notion API error: ${response.statusText}`);
    return response.json();
  }

  // Sentry Connector
  async getSentryIssues(connectorId: string, project: string): Promise<any> {
    const creds = this.getCredentials(connectorId);
    if (!creds?.apiKey) throw new Error('No API key for Sentry');

    const connector = this.connectors.get(connectorId);
    const org = connector?.config?.organization || '';

    const response = await fetch(`https://sentry.io/api/0/projects/${org}/${project}/issues/`, {
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
      },
    });

    if (!response.ok) throw new Error(`Sentry API error: ${response.statusText}`);
    return response.json();
  }

  async createSentryIssue(connectorId: string, issue: {
    project: string;
    title: string;
    message: string;
    level?: 'error' | 'warning' | 'info';
  }): Promise<any> {
    const creds = this.getCredentials(connectorId);
    if (!creds?.apiKey) throw new Error('No API key for Sentry');

    const connector = this.connectors.get(connectorId);
    const org = connector?.config?.organization || '';

    const response = await fetch(`https://sentry.io/api/0/projects/${org}/${issue.project}/events/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_id: Math.random().toString(36).substring(2),
        title: issue.title,
        message: issue.message,
        level: issue.level || 'error',
      }),
    });

    if (!response.ok) throw new Error(`Sentry API error: ${response.statusText}`);
    return response.json();
  }

  cleanup(): void {
    this.connectors.clear();
    this.credentials.clear();
    this.removeAllListeners();
  }
}

export default ConnectorManager;
