import { EventEmitter } from 'events';
import log from 'electron-log';
import fetch from 'node-fetch';

export interface LinearConfig {
  apiKey: string;
  organizationId?: string;
}

export interface LinearIssue {
  id: string;
  title: string;
  description?: string;
  state: { name: string; type: string };
  priority: number;
  assignee?: { name: string; email: string };
  labels: Array<{ name: string; color: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface LinearComment {
  id: string;
  body: string;
  user: { name: string };
  createdAt: string;
}

export class LinearManager extends EventEmitter {
  private config: LinearConfig | null = null;
  private baseUrl = 'https://api.linear.app/graphql';

  constructor() {
    super();
  }

  async configure(config: LinearConfig): Promise<void> {
    this.config = config;
    log.info('Linear configured', { organizationId: config.organizationId });
  }

  private async graphqlRequest(query: string, variables?: Record<string, any>): Promise<any> {
    if (!this.config) throw new Error('Linear not configured');

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.config.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Linear API error: ${response.statusText}`);
    }

    const jsonData = await response.json() as any;

    if (jsonData.errors) {
      throw new Error(`Linear GraphQL error: ${jsonData.errors[0].message}`);
    }

    return jsonData.data;
  }

  async listIssues(options?: {
    teamId?: string;
    assigneeId?: string;
    labels?: string[];
    limit?: number;
  }): Promise<LinearIssue[]> {
    const query = `
      query Issues($first: Int, $filter: IssueFilter) {
        issues(first: $first, filter: $filter) {
          nodes {
            id
            title
            description
            priority
            createdAt
            updatedAt
            state { name type }
            assignee { name email }
            labels { nodes { name color } }
          }
        }
      }
    `;

    const variables: Record<string, any> = {
      first: options?.limit || 50,
      filter: {},
    };

    if (options?.teamId) {
      variables.filter.team = { id: { eq: options.teamId } };
    }
    if (options?.assigneeId) {
      variables.filter.assignee = { id: { eq: options.assigneeId } };
    }

    const data = await this.graphqlRequest(query, variables);
    return data.issues.nodes.map((issue: any) => ({
      ...issue,
      labels: issue.labels?.nodes || [],
    }));
  }

  async getIssue(issueId: string): Promise<LinearIssue> {
    const query = `
      query Issue($id: String!) {
        issue(id: $id) {
          id
          title
          description
          priority
          createdAt
          updatedAt
          state { name type }
          assignee { name email }
          labels { nodes { name color } }
        }
      }
    `;

    const data = await this.graphqlRequest(query, { id: issueId });
    const issue = data.issue;
    return {
      ...issue,
      labels: issue.labels?.nodes || [],
    };
  }

  async createIssue(options: {
    teamId: string;
    title: string;
    description?: string;
    priority?: number;
    assigneeId?: string;
    labels?: string[];
  }): Promise<LinearIssue> {
    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            title
            description
            priority
            createdAt
            updatedAt
            state { name type }
            assignee { name email }
          }
        }
      }
    `;

    const variables = {
      input: {
        teamId: options.teamId,
        title: options.title,
        description: options.description,
        priority: options.priority || 0,
        assigneeId: options.assigneeId,
        labelIds: options.labels,
      },
    };

    const data = await this.graphqlRequest(mutation, variables);

    if (!data.issueCreate.success) {
      throw new Error('Failed to create issue');
    }

    return data.issueCreate.issue;
  }

  async updateIssue(issueId: string, updates: {
    title?: string;
    description?: string;
    priority?: number;
    assigneeId?: string;
    stateId?: string;
  }): Promise<LinearIssue> {
    const mutation = `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
          issue {
            id
            title
            description
            priority
            updatedAt
            state { name type }
          }
        }
      }
    `;

    const variables = {
      id: issueId,
      input: updates,
    };

    const data = await this.graphqlRequest(mutation, variables);

    if (!data.issueUpdate.success) {
      throw new Error('Failed to update issue');
    }

    return data.issueUpdate.issue;
  }

  async addComment(issueId: string, body: string): Promise<LinearComment> {
    const mutation = `
      mutation CreateComment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
          comment {
            id
            body
            user { name }
            createdAt
          }
        }
      }
    `;

    const variables = {
      input: {
        issueId,
        body,
      },
    };

    const data = await this.graphqlRequest(mutation, variables);

    if (!data.commentCreate.success) {
      throw new Error('Failed to add comment');
    }

    return data.commentCreate.comment;
  }

  async listComments(issueId: string): Promise<LinearComment[]> {
    const query = `
      query Comments($issueId: ID!) {
        comments(filter: { issue: { id: { eq: $issueId } } }) {
          nodes {
            id
            body
            user { name }
            createdAt
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query, { issueId });
    return data.comments.nodes;
  }

  async archiveIssue(issueId: string): Promise<void> {
    const mutation = `
      mutation ArchiveIssue($id: String!) {
        issueArchive(id: $id) {
          success
        }
      }
    `;

    const data = await this.graphqlRequest(mutation, { id: issueId });

    if (!data.issueArchive.success) {
      throw new Error('Failed to archive issue');
    }
  }

  async listTeams(): Promise<Array<{ id: string; name: string; key: string }>> {
    const query = `
      query Teams {
        teams {
          nodes {
            id
            name
            key
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query);
    return data.teams.nodes;
  }

  async listLabels(): Promise<Array<{ id: string; name: string; color: string }>> {
    const query = `
      query Labels {
        labels {
          nodes {
            id
            name
            color
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query);
    return data.labels.nodes;
  }

  getConfig(): LinearConfig | null {
    return this.config ? { ...this.config, apiKey: '***' } : null;
  }

  cleanup(): void {
    this.config = null;
    this.removeAllListeners();
  }
}

export default LinearManager;
