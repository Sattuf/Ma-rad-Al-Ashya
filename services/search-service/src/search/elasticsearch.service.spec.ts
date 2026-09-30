import { ElasticsearchService, MAPPING_PROPERTIES } from './elasticsearch.service';

describe('ElasticsearchService startup', () => {
  function service(exists: jest.Mock, properties: Record<string, { type: string }> = {}) {
    const es = new ElasticsearchService();
    es.retryBaseMs = 5;
    (es as any).client = {
      indices: {
        exists,
        create: jest.fn().mockResolvedValue({}),
        putMapping: jest.fn().mockResolvedValue({}),
        getMapping: jest.fn().mockResolvedValue({ marad_listings: { mappings: { properties } } }),
      },
    };
    jest.spyOn((es as any).logger, 'warn').mockImplementation(() => undefined);
    jest.spyOn((es as any).logger, 'log').mockImplementation(() => undefined);
    jest.spyOn((es as any).logger, 'error').mockImplementation(() => undefined);
    return es;
  }

  it('keeps retrying until Elasticsearch answers, then creates the index with its mapping', async () => {
    const exists = jest.fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValue(false);
    const es = service(exists);
    await es.ensureIndexWithRetry();
    expect(exists).toHaveBeenCalledTimes(3);
    const created = (es as any).client.indices.create.mock.calls[0][0];
    expect(created.body.mappings.properties.condition).toEqual({ type: 'keyword' });
    await expect(es.whenReady(50)).resolves.toBeUndefined();
  });

  it('holds writes until the index exists, and gives up after the timeout', async () => {
    const es = service(jest.fn().mockRejectedValue(new Error('down')));
    void es.ensureIndexWithRetry();
    await expect(es.whenReady(30)).rejects.toThrow('search index not ready yet');
    es.onModuleDestroy();
  });

  it('an existing index with a guessed field type still accepts writes, and the conflict is reported', async () => {
    const es = service(jest.fn().mockResolvedValue(true), {
      id: { type: 'keyword' }, title: { type: 'text' }, condition: { type: 'text' }, status: { type: 'keyword' },
    });
    await es.ensureIndexWithRetry();
    await expect(es.whenReady(50)).resolves.toBeUndefined();
    expect((es as any).logger.error).toHaveBeenCalledWith(expect.stringContaining('condition is text, expected keyword'));
    const added = (es as any).client.indices.putMapping.mock.calls[0][0].properties;
    expect(added).not.toHaveProperty('condition'); // cannot change in place
    expect(added).toHaveProperty('category_ids', { type: 'keyword' });
  });

  it('an up-to-date index adds nothing and reports nothing', async () => {
    const es = service(jest.fn().mockResolvedValue(true), MAPPING_PROPERTIES as any);
    await es.ensureIndexWithRetry();
    expect((es as any).client.indices.putMapping).not.toHaveBeenCalled();
    expect((es as any).logger.error).not.toHaveBeenCalled();
  });
});

