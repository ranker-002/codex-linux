import { EventEmitter } from 'events';
import log from 'electron-log';
import { MCPManager } from '../mcp/MCPManager';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
  favicon?: string;
  publishedDate?: string;
}

export interface WebSearchOptions {
  maxResults?: number;
  includeImages?: boolean;
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
  safeSearch?: boolean;
}

export class WebSearchIntegration extends EventEmitter {
  private mcpManager: MCPManager;
  private braveServerId: string = 'brave-search';
  private isEnabled: boolean = false;

  constructor(mcpManager: MCPManager) {
    super();
    this.mcpManager = mcpManager;
  }

  async initialize(): Promise<void> {
    // Check if Brave API key is configured
    const braveApiKey = process.env.BRAVE_API_KEY || '';
    
    if (braveApiKey) {
      // Enable the Brave Search MCP server
      await this.enableBraveSearch(braveApiKey);
    } else {
      log.info('Web Search: Brave API key not configured, search disabled');
    }
  }

  private async enableBraveSearch(apiKey: string): Promise<void> {
    try {
      // Start the Brave Search MCP server
      await this.mcpManager.startServer(this.braveServerId);
      this.isEnabled = true;
      
      log.info('Web Search: Brave Search MCP server enabled');
      this.emit('enabled');
    } catch (error) {
      log.error('Web Search: Failed to enable Brave Search:', error);
      this.emit('error', { type: 'enable', error });
    }
  }

  async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isEnabled) {
      throw new Error('Web search is not enabled. Configure BRAVE_API_KEY to enable search.');
    }

    const maxResults = options.maxResults || 10;
    
    try {
      log.info(`Web Search: Searching for "${query}"`);
      
      const results = await this.mcpManager.callTool(
        this.braveServerId,
        'brave_web_search',
        {
          query,
          count: maxResults,
          offset: 0
        }
      );

      // Parse and format results
      const searchResults: SearchResult[] = this.parseSearchResults(results);
      
      log.info(`Web Search: Found ${searchResults.length} results`);
      this.emit('search:completed', { query, results: searchResults });
      
      return searchResults;
    } catch (error) {
      log.error('Web Search: Search failed:', error);
      this.emit('search:error', { query, error });
      throw error;
    }
  }

  private parseSearchResults(rawResults: any): SearchResult[] {
    if (!rawResults || !Array.isArray(rawResults.web?.results)) {
      return [];
    }

    return rawResults.web.results.map((result: any) => ({
      title: result.title || '',
      url: result.url || '',
      description: result.description || '',
      favicon: result.profile?.img,
      publishedDate: result.age
    }));
  }

  async searchWithContext(
    query: string,
    context: string,
    options: WebSearchOptions = {}
  ): Promise<{ results: SearchResult[]; summary: string }> {
    // Enhance query with context
    const enhancedQuery = `${query} ${context}`.trim();
    
    const results = await this.search(enhancedQuery, options);
    
    // Generate summary of results
    const summary = this.generateSummary(results, query);
    
    return { results, summary };
  }

  private generateSummary(results: SearchResult[], query: string): string {
    if (results.length === 0) {
      return `No results found for "${query}".`;
    }

    const topResults = results.slice(0, 3);
    let summary = `Found ${results.length} results for "${query}".\n\nTop results:\n`;
    
    topResults.forEach((result, index) => {
      summary += `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.description.slice(0, 150)}...\n\n`;
    });

    return summary;
  }

  formatResultsForAgent(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No search results found.';
    }

    let formatted = 'Search Results:\n\n';
    
    results.forEach((result, index) => {
      formatted += `[${index + 1}] ${result.title}\n`;
      formatted += `URL: ${result.url}\n`;
      formatted += `Description: ${result.description}\n`;
      if (result.publishedDate) {
        formatted += `Published: ${result.publishedDate}\n`;
      }
      formatted += '\n';
    });

    return formatted;
  }

  async performSearchCommand(
    query: string,
    agentId: string,
    options: WebSearchOptions = {}
  ): Promise<{ results: SearchResult[]; formattedResults: string }> {
    const results = await this.search(query, options);
    const formattedResults = this.formatResultsForAgent(results);
    
    this.emit('search:command', {
      agentId,
      query,
      results,
      formattedResults
    });

    return { results, formattedResults };
  }

  isSearchEnabled(): boolean {
    return this.isEnabled;
  }

  getStatus(): {
    enabled: boolean;
    serverId: string;
    serverStatus: string;
  } {
    return {
      enabled: this.isEnabled,
      serverId: this.braveServerId,
      serverStatus: this.mcpManager.getServerStatus(this.braveServerId)
    };
  }

  async disable(): Promise<void> {
    if (this.isEnabled) {
      await this.mcpManager.stopServer(this.braveServerId);
      this.isEnabled = false;
      log.info('Web Search: Disabled');
      this.emit('disabled');
    }
  }

  cleanup(): void {
    this.removeAllListeners();
  }
}

export default WebSearchIntegration;
