import OpenAI from 'openai';
import log from 'electron-log';

export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

export class EmbeddingService {
  private client: OpenAI | null = null;
  private model: string = 'text-embedding-3-small';

  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        timeout: 30000,
        maxRetries: 3
      });
    }
  }

  async createEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized - no API key');
    }

    try {
      // Truncate if too long (max ~8000 tokens for embedding-3)
      const truncatedText = text.length > 30000 ? text.slice(0, 30000) : text;

      const response = await this.client.embeddings.create({
        model: this.model,
        input: truncatedText,
        encoding_format: 'float'
      });

      return response.data[0].embedding;
    } catch (error) {
      log.error('Failed to create embedding:', error);
      throw error;
    }
  }

  async createEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized - no API key');
    }

    try {
      // Truncate texts if too long
      const truncatedTexts = texts.map(t => t.length > 30000 ? t.slice(0, 30000) : t);

      const response = await this.client.embeddings.create({
        model: this.model,
        input: truncatedTexts,
        encoding_format: 'float'
      });

      return response.data.map(d => ({
        embedding: d.embedding,
        index: d.index
      }));
    } catch (error) {
      log.error('Failed to create embeddings:', error);
      throw error;
    }
  }

  static cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  isAvailable(): boolean {
    return this.client !== null;
  }
}
