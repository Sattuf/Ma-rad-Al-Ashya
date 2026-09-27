-- V013__listings_query_indexes.sql
-- Composite indexes matching the paginated queries in ListingsService
-- (filter by status [+ category | user], newest first). They let Postgres read one
-- page from the index instead of sorting the whole table on every request.
-- On a large live table, run each statement as CREATE INDEX CONCURRENTLY outside a transaction.
CREATE INDEX IF NOT EXISTS idx_listings_status_created
  ON listings (status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category_status_created
  ON listings (category_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_listings_user_status_created
  ON listings (user_id, status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing_sort
  ON listing_images (listing_id, sort_order);

-- Superseded by the composite indexes above.
DROP INDEX IF EXISTS idx_listings_status;
DROP INDEX IF EXISTS idx_listings_user_id;
DROP INDEX IF EXISTS idx_listings_category_id;
