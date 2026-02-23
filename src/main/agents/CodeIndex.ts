import * as fs from 'fs/promises';
import * as path from 'path';
import crypto from 'crypto';
import log from 'electron-log';
import { EmbeddingService } from './EmbeddingService';

interface CodeIndexEntry {
  id: string;
  filePath: string;
  content: string;
  chunkStart: number;
  chunkEnd: number;
  embedding?: number[];
  lastModified: number;
}

interface SearchResult {
  filePath: string;
  chunkStart: number;
  chunkEnd: number;
  content: string;
  similarity: number;
}

export class CodeIndex {
  private indexPath: string;
  private entries: Map<string, CodeIndexEntry> = new Map();
  private worktreePath: string;
  private embeddingService: EmbeddingService | null = null;

  constructor(worktreePath: string, indexDir: string = '.codex/index', apiKey?: string) {
    this.worktreePath = worktreePath;
    this.indexPath = path.join(worktreePath, indexDir, 'code-index.json');
    if (apiKey) {
      this.embeddingService = new EmbeddingService(apiKey);
    }
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
      const content = await fs.readFile(this.indexPath, 'utf-8');
      const data = JSON.parse(content);
      for (const entry of data.entries || []) {
        this.entries.set(entry.id, entry);
      }
      log.info(`Loaded code index with ${this.entries.size} entries`);
    } catch {
      log.info('No existing code index, starting fresh');
    }
  }

  async save(): Promise<void> {
    const data = {
      entries: Array.from(this.entries.values()),
      updatedAt: Date.now()
    };
    await fs.writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async indexFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.worktreePath, filePath);
    
    try {
      const stats = await fs.stat(fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Split into chunks of ~100 lines
      const lines = content.split('\n');
      const chunkSize = 100;
      
      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunkStart = i;
        const chunkEnd = Math.min(i + chunkSize, lines.length);
        const chunkContent = lines.slice(chunkStart, chunkEnd).join('\n');
        
        const id = crypto.createHash('md5').update(`${filePath}:${chunkStart}`).digest('hex');
        
        // Use real OpenAI embeddings if available, otherwise fallback to simple
        let embedding: number[];
        if (this.embeddingService?.isAvailable()) {
          try {
            embedding = await this.embeddingService.createEmbedding(chunkContent);
          } catch {
            // Fallback to simple embedding if OpenAI fails
            embedding = this.computeSimpleEmbedding(chunkContent);
          }
        } else {
          embedding = this.computeSimpleEmbedding(chunkContent);
        }
        
        this.entries.set(id, {
          id,
          filePath,
          content: chunkContent,
          chunkStart,
          chunkEnd,
          embedding,
          lastModified: stats.mtimeMs
        });
      }
      
      log.info(`Indexed ${filePath}: ${Math.ceil(lines.length / chunkSize)} chunks`);
    } catch (error) {
      log.warn(`Failed to index ${filePath}:`, error);
    }
  }

  private computeSimpleEmbedding(content: string): number[] {
    // Simple feature extraction for similarity
    // In production, you'd use a real embedding model like OpenAI's text-embedding-3-small
    const features: number[] = [];
    
    // Length feature
    features.push(content.length / 1000);
    
    // Character distribution (simplified)
    const chars = content.toLowerCase();
    const total = chars.length || 1;
    
    // Code-specific features
    features.push((chars.match(/function|def|class|const|let|var/g) || []).length / total * 10);
    features.push((chars.match(/import|require|from/g) || []).length / total * 10);
    features.push((chars.match(/return|await|async/g) || []).length / total * 10);
    features.push((chars.match(/if|for|while|switch/g) || []).length / total * 10);
    
    // Comment density
    features.push((chars.match(/\/\/|\/\*|#/g) || []).length / total * 10);
    
    // Pad to fixed size
    while (features.length < 8) features.push(0);
    
    return features.slice(0, 8);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    // Use EmbeddingService's implementation for consistency
    return EmbeddingService.cosineSimilarity(a, b);
  }

  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Compute query embedding
    let queryEmbedding: number[];
    if (this.embeddingService?.isAvailable()) {
      try {
        queryEmbedding = await this.embeddingService.createEmbedding(query);
      } catch {
        queryEmbedding = this.computeSimpleEmbedding(query);
      }
    } else {
      queryEmbedding = this.computeSimpleEmbedding(query);
    }
    
    // Score all entries
    const scored: SearchResult[] = [];
    
    for (const entry of this.entries.values()) {
      if (!entry.embedding) continue;
      
      const similarity = EmbeddingService.cosineSimilarity(queryEmbedding, entry.embedding);
      
      // Boost for exact keyword matches
      const keywords = query.toLowerCase().split(/\s+/);
      const contentLower = entry.content.toLowerCase();
      const keywordMatches = keywords.filter(kw => contentLower.includes(kw)).length;
      const boostedSimilarity = similarity + (keywordMatches / keywords.length) * 0.3;
      
      if (boostedSimilarity > 0.1) {
        scored.push({
          filePath: entry.filePath,
          chunkStart: entry.chunkStart,
          chunkEnd: entry.chunkEnd,
          content: entry.content,
          similarity: boostedSimilarity
        });
      }
    }
    
    // Sort by similarity and return top results
    scored.sort((a, b) => b.similarity - a.similarity);
    
    return scored.slice(0, limit);
  }

  async indexProject(): Promise<void> {
    log.info('Starting project indexing...');
    
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.md'];
    
    async function walk(dir: string): Promise<string[]> {
      const files: string[] = [];
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(worktreePath, fullPath);
          
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' && 
                entry.name !== 'build') {
              files.push(...await walk(fullPath));
            }
          } else if (entry.isFile()) {
            if (extensions.some(ext => entry.name.endsWith(ext))) {
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
      
      return files;
    }
    
    const worktreePath = this.worktreePath;
    const allFiles = await walk(worktreePath);
    
    log.info(`Found ${allFiles.length} files to index`);
    
    for (const file of allFiles.slice(0, 100)) { // Limit to 100 files for now
      await this.indexFile(file);
    }
    
    await this.save();
    log.info(`Indexed ${this.entries.size} chunks`);
  }

  getIndexedFiles(): string[] {
    const files = new Set<string>();
    for (const entry of this.entries.values()) {
      files.add(entry.filePath);
    }
    return Array.from(files);
  }
}
