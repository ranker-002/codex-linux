import axios, { AxiosInstance } from 'axios';
import { getConfig } from './config';

export function getAPIClient(options: any): AxiosInstance {
  const config = getConfig();
  
  const client = axios.create({
    baseURL: `http://${options.host || config.host || 'localhost'}:${options.port || config.port || '3001'}`,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': options.apiKey || config.apiKey,
    },
    timeout: 30000,
  });

  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to Codex Linux server. Is it running?');
      }
      
      if (error.response?.status === 401) {
        throw new Error('Invalid API key');
      }
      
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      
      throw error;
    }
  );

  // Add request interceptor for logging
  if (options.verbose) {
    client.interceptors.request.use((request) => {
      console.log(`[API] ${request.method?.toUpperCase()} ${request.url}`);
      return request;
    });
  }

  return client;
}