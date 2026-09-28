import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { ListingsService } from '../../src/listings/listings.service';
import { Listing, ListingStatus } from '../../src/listings/entities/listing.entity';
import { ListingImage } from '../../src/listings/entities/listing-image.entity';
import { Category } from '../../src/categories/entities/category.entity';
import { Promotion } from '../../src/promotions/entities/promotion.entity';

/**
 * Runs ListingsService against a real Postgres (schema from the SQL migrations) and Redis,
 * covering the SQL the unit tests can only mock: pagination, status filtering, LIKE escaping,
 * and the SCAN/GETDEL view flush.
 */
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
if (!databaseUrl || !redisUrl) {
  throw new Error('DATABASE_URL and REDIS_URL are required for integration tests');
}

// The same files db/migrate.mjs applies, in order.
const MIGRATIONS_DIR = join(__dirname, '../../../../db/migrations');
const SELLER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('ListingsService against real Postgres and Redis', () => {
  let dataSource: DataSource;
  let redis: Redis;
  let service: ListingsService;

  beforeAll(async () => {
    const schema = `it_${process.pid}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    await admin.initialize();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
    await admin.destroy();

    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      schema,
      extra: { options: `-c search_path=${schema},public` },
      entities: [Listing, ListingImage, Category, Promotion],
    });
    await dataSource.initialize();
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
      await dataSource.query(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
    }

    const { hostname, port } = new URL(redisUrl);
    process.env.REDIS_HOST = hostname;
    process.env.REDIS_PORT = port;
    redis = new Redis(redisUrl);

    const http = { post: jest.fn(() => of({ data: {} })), get: jest.fn(() => of({ data: {} })) };
    service = new ListingsService(
      dataSource.getRepository(Listing),
      dataSource.getRepository(ListingImage),
      {} as any,
      http as any,
    );
  });

  afterAll(async () => {
    await (service as any).redis.quit();
    await redis.quit();
    await dataSource.query(`DROP SCHEMA IF EXISTS it_${process.pid} CASCADE`);
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE listings CASCADE');
    await redis.flushdb();
  });

  const insert = async (rows: Partial<Listing>[]) => {
    const repo = dataSource.getRepository(Listing);
    for (const [i, row] of rows.entries()) {
      await repo.insert({
        userId: SELLER,
        title: `item ${i}`,
        description: 'd',
        price: 10,
        status: ListingStatus.ACTIVE,
        createdAt: new Date(Date.now() - i * 60_000),
        ...row,
      } as any);
    }
  };

  it('returns bounded, newest-first pages of active listings only', async () => {
    await insert(Array.from({ length: 60 }, () => ({})));
    await insert([
      { title: 'gone', status: ListingStatus.DELETED },
      { title: 'old', status: ListingStatus.EXPIRED },
    ]);

    const page1 = await service.findAll({ limit: '500' });
    expect(page1.data).toHaveLength(50);
    expect(page1.meta).toMatchObject({ total: 60, page: 1, limit: 50, lastPage: 2 });
    const times = page1.data.map((l) => new Date(l.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const page2 = await service.findAll({ limit: '50', page: '2' });
    expect(page2.data).toHaveLength(10);
    expect(page2.data.find((l) => ['gone', 'old'].includes(l.title))).toBeUndefined();

    const deletedRequest = await service.findAll({ status: 'deleted' });
    expect(deletedRequest.data.every((l) => l.status === ListingStatus.ACTIVE)).toBe(true);
  });

  it('matches LIKE wildcards in search terms literally', async () => {
    await insert([{ title: '100% cotton' }, { title: '1000 cotton' }, { title: 'a_b' }, { title: 'axb' }]);

    expect((await service.findAll({ search: '100%' })).data.map((l) => l.title)).toEqual(['100% cotton']);
    expect((await service.findAll({ search: 'a_b' })).data.map((l) => l.title)).toEqual(['a_b']);
  });

  it("lists the owner's listings except deleted ones", async () => {
    await insert([
      { title: 'mine', status: ListingStatus.SOLD },
      { title: 'mine-deleted', status: ListingStatus.DELETED },
      { title: 'theirs', userId: OTHER },
    ]);
    const mine = await service.findMine(SELLER);
    expect(mine.data.map((l) => l.title)).toEqual(['mine']);
  });

  it('flushes buffered views atomically without losing concurrent increments', async () => {
    await insert([{ title: 'popular' }]);
    const [{ id }] = await dataSource.query(`SELECT id FROM listings WHERE title = 'popular'`);

    await Promise.all(Array.from({ length: 40 }, () => service.incrementView(id)));
    await service.syncViews();
    await Promise.all(Array.from({ length: 5 }, () => service.incrementView(id)));
    await service.syncViews();

    const [{ views_count }] = await dataSource.query('SELECT views_count FROM listings WHERE id = $1', [id]);
    expect(Number(views_count)).toBe(45);
    expect(await redis.exists(`listing:views:${id}`)).toBe(0);
  });
});
