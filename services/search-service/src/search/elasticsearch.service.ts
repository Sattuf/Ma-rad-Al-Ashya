import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Client, estypes } from '@elastic/elasticsearch';

/** The index mapping. Existing indexes are checked against it at startup (ensureFields). */
export const MAPPING_PROPERTIES: Record<string, estypes.MappingProperty> = {
  id: { type: 'keyword' },
  title: { 
    type: 'text',
    analyzer: 'arabic_analyzer',
    fields: {
      keyword: { type: 'keyword' }
    }
  },
  description: { 
    type: 'text',
    analyzer: 'arabic_analyzer'
  },
  price: { type: 'double' },
  location: { type: 'geo_point' },
  category: { type: 'keyword' },
  category_ids: { type: 'keyword' },
  status: { type: 'keyword' },
  condition: { type: 'keyword' },
  tags: { type: 'keyword' },
  createdAt: { type: 'date' },
  updatedAt: { type: 'date' },
  boost_multiplier: { type: 'float' },
  expires_at: { type: 'date' }
};

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
  public readonly client: Client;
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly indexName = 'marad_listings';
  /** First retry delay; doubles up to MAX_RETRY_MS. */
  retryBaseMs = 1_000;
  private static readonly MAX_RETRY_MS = 30_000;
  private stopped = false;
  private markReady!: () => void;
  private readonly ready = new Promise<void>((resolve) => (this.markReady = resolve));

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
      maxRetries: 3,
      requestTimeout: 5000,
    });
  }

  /**
   * Elasticsearch often starts after this service (compose, rolling restarts). The index is
   * ensured in the background, retried until it succeeds, so startup is never blocked and a
   * slow Elasticsearch is not a permanent failure.
   */
  onModuleInit() {
    void this.ensureIndexWithRetry();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  async ensureIndexWithRetry(): Promise<void> {
    for (let attempt = 1; !this.stopped; attempt++) {
      try {
        await this.ensureIndex();
        this.markReady();
        return;
      } catch (error) {
        const delay = Math.min(ElasticsearchService.MAX_RETRY_MS, this.retryBaseMs * 2 ** (attempt - 1));
        this.logger.warn(`Elasticsearch not ready (attempt ${attempt}), retrying in ${Math.round(delay / 1000)}s: ${(error as Error).message}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  /**
   * Writes wait for the index to exist with its mapping: a write before that would let
   * Elasticsearch create the index itself with guessed field types (text instead of keyword),
   * silently breaking the category, status and condition filters.
   */
  async whenReady(timeoutMs = 10_000): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('search index not ready yet')), timeoutMs);
    });
    try {
      await Promise.race([this.ready, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureIndex(): Promise<void> {
    const indexExists = await this.client.indices.exists({ index: this.indexName });
    if (!indexExists) {
      await this.client.indices.create({
        index: this.indexName,
        body: {
          settings: {
            analysis: {
              analyzer: {
                arabic_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'arabic_normalization', 'arabic_stop', 'arabic_stemmer'],
                },
              },
              filter: {
                arabic_stop: {
                  type: 'stop',
                  stopwords: '_arabic_',
                },
                arabic_stemmer: {
                  type: 'stemmer',
                  language: 'arabic',
                },
              },
            },
          },
          mappings: {
            properties: MAPPING_PROPERTIES,
          },
        },
      });
      this.logger.log(`Created index ${this.indexName} with mapping`);
      return;
    }
    await this.ensureFields();
  }

  /**
   * An existing index gets the fields added since it was created (allowed in place). A field
   * whose type differs cannot be changed in place: that happens when a document was written
   * before the mapping existed and Elasticsearch guessed (text instead of keyword). It is
   * reported, not fatal: the index still works, but filters on that field are unreliable
   * until the index is rebuilt.
   */
  private async ensureFields(): Promise<void> {
    const current = await this.client.indices.getMapping({ index: this.indexName });
    const existing: Record<string, { type?: string }> = (current as any)[this.indexName]?.mappings?.properties ?? {};
    const missing: Record<string, estypes.MappingProperty> = {};
    const wrong: string[] = [];
    for (const [field, spec] of Object.entries(MAPPING_PROPERTIES)) {
      const actual = existing[field]?.type;
      if (!actual) missing[field] = spec;
      else if (actual !== spec.type) wrong.push(`${field} is ${actual}, expected ${spec.type}`);
    }
    if (Object.keys(missing).length) {
      await this.client.indices.putMapping({ index: this.indexName, properties: missing });
      this.logger.log(`Index ${this.indexName}: added fields ${Object.keys(missing).join(', ')}`);
    }
    if (wrong.length) {
      this.logger.error(
        `Index ${this.indexName} has wrong field types (${wrong.join('; ')}): filters on them are unreliable. ` +
          `Rebuild it: delete the index, restart search-service, then run the listings search:reindex script.`,
      );
    } else {
      this.logger.log(`Index ${this.indexName} mapping is up to date`);
    }
  }

  async updateDocumentFields(
    id: string,
    fields: Partial<{ images_count: number; description_length: number; seller_average_rating: number }>
  ) {
    try {
      await this.whenReady();
      await this.client.update({
        index: this.indexName,
        id,
        body: {
          doc: fields,
        },
      });
      this.logger.log(`Updated fields for document ${id}`);
    } catch (error) {
      this.logger.error(`Failed to update document ${id}: ${error.message}`);
    }
  }
}
