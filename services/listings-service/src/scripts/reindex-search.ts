/**
 * Rebuilds the search index from Postgres (the source of truth).
 *
 * Run after deploying search (or after an outage), so listings created while search-service
 * was unreachable are searchable and the A/B experiment compares complete result sets.
 *
 *   npm run search:reindex                # dev (ts-node)
 *   node dist/scripts/reindex-search.js   # in the production image
 *
 * Reads in keyset-paginated batches (no OFFSET scans) with bounded concurrency, so it can run
 * against a live database.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { ListingsService } from '../listings/listings.service';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';

const BATCH = 200;
const CONCURRENCY = 5;

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const listings = app.get(ListingsService);
  const repo = app.get(DataSource).getRepository(Listing);

  let lastId = '00000000-0000-0000-0000-000000000000';
  let indexed = 0;
  let failed = 0;
  for (;;) {
    const batch = await repo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.images', 'images')
      .where('l.id > :lastId', { lastId })
      .andWhere('l.status != :deleted', { deleted: ListingStatus.DELETED })
      .orderBy('l.id', 'ASC')
      .take(BATCH)
      .getMany();
    if (!batch.length) break;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const results = await Promise.all(batch.slice(i, i + CONCURRENCY).map((l) => listings.triggerSearchIndex('update', l)));
      indexed += results.filter(Boolean).length;
      failed += results.filter((ok) => !ok).length;
    }
    lastId = batch[batch.length - 1].id;
    console.log(`indexed ${indexed}, failed ${failed}…`);
  }
  console.log(`done: ${indexed} indexed, ${failed} failed`);
  await app.close();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
