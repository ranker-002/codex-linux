import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import log from 'electron-log';
import fetch from 'node-fetch';

export type ResearchStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ResearchDepth = 'shallow' | 'medium' | 'deep';

export interface ResearchSource {
  url: string;
  title: string;
  content: string;
  relevance: number;
  credibility: number;
  retrievedAt: Date;
}

export interface ResearchFinding {
  id: string;
  category: string;
  statement: string;
  evidence: string[];
  confidence: number;
  sources: string[];
}

export interface ResearchReport {
  id: string;
  query: string;
  depth: ResearchDepth;
  status: ResearchStatus;
  summary: string;
  findings: ResearchFinding[];
  sources: ResearchSource[];
  citations: string[];
  createdAt: Date;
  completedAt?: Date;
  duration?: number;
  metadata: Record<string, unknown>;
}

export interface ResearchConfig {
  maxSources: number;
  maxDepth: number;
  includeCredibilityScore: boolean;
  searchApiKey?: string;
  searchEndpoint?: string;
}

export class DeepResearchManager extends EventEmitter {
  private reports: Map<string, ResearchReport> = new Map();
  private config: ResearchConfig;
  private activeResearch: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<ResearchConfig>) {
    super();
    this.config = {
      maxSources: config?.maxSources || 20,
      maxDepth: config?.maxDepth || 3,
      includeCredibilityScore: config?.includeCredibilityScore ?? true,
      searchApiKey: config?.searchApiKey,
      searchEndpoint: config?.searchEndpoint,
    };
  }

  configure(config: Partial<ResearchConfig>): void {
    this.config = { ...this.config, ...config };
    log.info('DeepResearchManager configured', {
      maxSources: this.config.maxSources,
      maxDepth: this.config.maxDepth,
    });
  }

  getConfig(): ResearchConfig {
    return { ...this.config };
  }

  async startResearch(
    query: string,
    options: {
      depth?: ResearchDepth;
      maxSources?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<ResearchReport> {
    const report: ResearchReport = {
      id: uuidv4(),
      query,
      depth: options.depth || 'medium',
      status: 'pending',
      summary: '',
      findings: [],
      sources: [],
      citations: [],
      createdAt: new Date(),
      metadata: options.metadata || {},
    };

    this.reports.set(report.id, report);
    this.emit('research:started', report);
    log.info(`Starting deep research: ${query}`);

    this.executeResearch(report, options.maxSources);

    return report;
  }

  private async executeResearch(
    report: ResearchReport,
    maxSources?: number
  ): Promise<void> {
    report.status = 'running';
    this.emit('research:running', report);

    const startTime = Date.now();
    const sources = await this.gatherSources(report.query, report.depth, maxSources);
    report.sources = sources;
    this.emit('sources:gathered', { reportId: report.id, count: sources.length });

    const findings = await this.analyzeSources(report.query, sources);
    report.findings = findings;
    this.emit('findings:analyzed', { reportId: report.id, count: findings.length });

    const summary = await this.generateSummary(report.query, findings);
    report.summary = summary;

    report.citations = sources.map((s) => s.url);
    report.status = 'completed';
    report.completedAt = new Date();
    report.duration = Date.now() - startTime;

    this.emit('research:completed', report);
    log.info(`Deep research completed: ${report.id} (${report.duration}ms)`);
  }

  private async gatherSources(
    query: string,
    depth: ResearchDepth,
    maxSources?: number
  ): Promise<ResearchSource[]> {
    const depthMultiplier = {
      shallow: 1,
      medium: 2,
      deep: 3,
    };

    const numQueries = depthMultiplier[depth];
    const searchQueries = this.generateSearchQueries(query, numQueries);
    const sources: ResearchSource[] = [];
    const seenUrls = new Set<string>();

    for (const searchQuery of searchQueries) {
      const searchResults = await this.performSearch(searchQuery);
      
      for (const result of searchResults) {
        if (sources.length >= (maxSources || this.config.maxSources)) break;
        if (seenUrls.has(result.url)) continue;

        try {
          const content = await this.fetchPageContent(result.url);
          const relevance = this.calculateRelevance(query, content);
          const credibility = this.calculateCredibility(result.url);

          if (relevance > 0.3) {
            seenUrls.add(result.url);
            sources.push({
              url: result.url,
              title: result.title,
              content,
              relevance,
              credibility,
              retrievedAt: new Date(),
            });
          }
        } catch (error) {
          log.debug(`Failed to fetch ${result.url}:`, error);
        }
      }

      if (sources.length >= (maxSources || this.config.maxSources)) break;
    }

    return sources.sort((a, b) => b.relevance - a.relevance);
  }

  private generateSearchQueries(query: string, count: number): string[] {
    const baseQuery = query;
    const variations = [
      `${query} overview`,
      `${query} definition`,
      `${query} examples`,
      `${query} best practices`,
      `${query} research`,
      `${query} analysis`,
    ];

    return [baseQuery, ...variations.slice(0, count - 1)];
  }

  private async performSearch(query: string): Promise<Array<{ url: string; title: string }>> {
    if (this.config.searchEndpoint) {
      try {
        const response = await fetch(this.config.searchEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.config.searchApiKey && {
              'Authorization': `Bearer ${this.config.searchApiKey}`,
            }),
          },
          body: JSON.stringify({ query, limit: 10 }),
        });

        if (response.ok) {
          const data = await response.json() as { results: Array<{ url: string; title: string }> };
          return data.results || [];
        }
      } catch (error) {
        log.error('Search API error:', error);
      }
    }

    return this.mockSearchResults(query);
  }

  private mockSearchResults(query: string): Array<{ url: string; title: string }> {
    return [
      {
        url: `https://example.com/wiki/${encodeURIComponent(query)}`,
        title: `${query} - Wikipedia`,
      },
      {
        url: `https://example.com/docs/${encodeURIComponent(query)}`,
        title: `Documentation about ${query}`,
      },
    ];
  }

  private async fetchPageContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CodexLinux/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.extractTextFromHtml(html).substring(0, 5000);
    } catch (error) {
      log.debug(`Failed to fetch content from ${url}:`, error);
      return '';
    }
  }

  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    const matches = queryWords.filter((w) => contentWords.includes(w)).length;
    return Math.min(1, matches / queryWords.length);
  }

  private calculateCredibility(url: string): number {
    const credibleDomains = ['wikipedia.org', 'github.com', 'mozilla.org', 'w3.org'];
    const eduDomains = ['.edu', '.gov'];
    
    for (const domain of credibleDomains) {
      if (url.includes(domain)) return 0.9;
    }
    
    for (const domain of eduDomains) {
      if (url.includes(domain)) return 0.85;
    }
    
    return 0.5;
  }

  private async analyzeSources(
    query: string,
    sources: ResearchSource[]
  ): Promise<ResearchFinding[]> {
    const findings: ResearchFinding[] = [];
    const categories = ['definition', 'usage', 'benefits', 'limitations', 'examples'];

    for (let i = 0; i < Math.min(5, sources.length); i++) {
      const source = sources[i];
      
      const category = categories[i % categories.length];
      const statements = this.extractStatements(source.content, category);
      
      statements.forEach((statement) => {
        findings.push({
          id: uuidv4(),
          category,
          statement,
          evidence: [source.url],
          confidence: source.relevance * source.credibility,
          sources: [source.url],
        });
      });
    }

    return findings;
  }

  private extractStatements(content: string, category: string): string[] {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    return sentences.slice(0, 3).map((s) => s.trim());
  }

  private async generateSummary(
    query: string,
    findings: ResearchFinding[]
  ): Promise<string> {
    const topFindings = findings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    if (topFindings.length === 0) {
      return `Research on "${query}" did not yield sufficient findings.`;
    }

    const summary = [
      `# Research Summary: ${query}\n`,
      `Based on analysis of ${findings.length} findings from multiple sources.\n`,
      '## Key Findings:\n',
    ];

    topFindings.forEach((finding, index) => {
      summary.push(`${index + 1}. ${finding.statement} (${Math.round(finding.confidence * 100)}% confidence)`);
    });

    summary.push('\n## Conclusion:');
    summary.push('The research indicates multiple perspectives on this topic. Further investigation may be warranted.');

    return summary.join('\n');
  }

  getReport(id: string): ResearchReport | undefined {
    return this.reports.get(id);
  }

  listReports(): ResearchReport[] {
    return Array.from(this.reports.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  cancelResearch(id: string): boolean {
    const report = this.reports.get(id);
    if (!report || report.status !== 'running') return false;

    const timeout = this.activeResearch.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.activeResearch.delete(id);
    }

    report.status = 'failed';
    report.completedAt = new Date();
    this.emit('research:cancelled', report);
    log.info(`Research cancelled: ${id}`);
    return true;
  }

  deleteReport(id: string): boolean {
    const deleted = this.reports.delete(id);
    if (deleted) {
      this.emit('report:deleted', { id });
    }
    return deleted;
  }

  exportReport(id: string, format: 'json' | 'markdown' = 'json'): string | null {
    const report = this.reports.get(id);
    if (!report) return null;

    if (format === 'markdown') {
      return this.exportAsMarkdown(report);
    }

    return JSON.stringify(report, null, 2);
  }

  private exportAsMarkdown(report: ResearchReport): string {
    let md = `# Research Report: ${report.query}\n\n`;
    md += `**Status:** ${report.status}\n`;
    md += `**Depth:** ${report.depth}\n`;
    md += `**Created:** ${report.createdAt.toISOString()}\n`;
    
    if (report.completedAt) {
      md += `**Completed:** ${report.completedAt.toISOString()}\n`;
      md += `**Duration:** ${report.duration}ms\n`;
    }
    
    md += `\n---\n\n## Summary\n\n${report.summary}\n\n`;
    md += `## Findings (${report.findings.length})\n\n`;
    
    report.findings.forEach((finding, index) => {
      md += `### ${index + 1}. ${finding.category}\n`;
      md += `${finding.statement}\n`;
      md += `**Confidence:** ${Math.round(finding.confidence * 100)}%\n`;
      md += `\n`;
    });
    
    md += `## Sources (${report.sources.length})\n\n`;
    report.sources.forEach((source) => {
      md += `- [${source.title}](${source.url})\n`;
    });

    return md;
  }

  getStats(): {
    totalReports: number;
    completed: number;
    failed: number;
    averageDuration: number;
  } {
    const reports = this.listReports();
    const completed = reports.filter((r) => r.status === 'completed');
    const failed = reports.filter((r) => r.status === 'failed');
    const durations = completed.map((r) => r.duration || 0);

    return {
      totalReports: reports.length,
      completed: completed.length,
      failed: failed.length,
      averageDuration:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
    };
  }

  cleanup(): void {
    this.activeResearch.forEach((timeout) => clearTimeout(timeout));
    this.activeResearch.clear();
    this.reports.clear();
    this.removeAllListeners();
    log.info('DeepResearchManager cleaned up');
  }
}

export default DeepResearchManager;
