import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';

export class CodexAPI {
  private client: AxiosInstance;
  private host: string;
  private port: number;

  constructor(host: string, port: number, apiKey: string) {
    this.host = host;
    this.port = port;

    this.client = axios.create({
      baseURL: `http://${host}:${port}/api`,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      timeout: 30000,
    });
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'ok';
    } catch {
      return false;
    }
  }

  async getAgents(): Promise<any[]> {
    const response = await this.client.get('/agents');
    return response.data;
  }

  async getAgent(agentId: string): Promise<any> {
    const response = await this.client.get(`/agents/${agentId}`);
    return response.data;
  }

  async createAgent(config: any): Promise<any> {
    const response = await this.client.post('/agents', config);
    return response.data;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.client.delete(`/agents/${agentId}`);
  }

  async sendMessage(agentId: string, message: string): Promise<any> {
    const response = await this.client.post(`/agents/${agentId}/messages`, {
      message,
    });
    return response.data;
  }

  async executeTask(agentId: string, task: string): Promise<any> {
    const response = await this.client.post(`/agents/${agentId}/tasks`, {
      task,
    });
    return response.data;
  }

  getBaseUrl(): string {
    return `http://${this.host}:${this.port}`;
  }
}