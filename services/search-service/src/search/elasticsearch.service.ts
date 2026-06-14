import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  public readonly client: Client;
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly indexName = 'marad_listings';

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    });
  }

  async onModuleInit() {
    try {
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
              properties: {
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
                tags: { type: 'keyword' },
                createdAt: { type: 'date' },
                updatedAt: { type: 'date' }
              },
            },
          },
        });
        this.logger.log(`Created index ${this.indexName} with mapping`);
      } else {
        this.logger.log(`Index ${this.indexName} already exists`);
      }
    } catch (error) {
      this.logger.error(`Error initializing Elasticsearch index: ${error.message}`);
    }
  }
}
