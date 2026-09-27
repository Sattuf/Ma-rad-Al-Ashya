-- V014__transactions_query_indexes.sql
-- The transactions and reviews tables had no secondary indexes: every "my transactions"
-- or "user reviews" page was a full table scan.
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_created
  ON transactions (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_created
  ON transactions (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_listing
  ON transactions (listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_created
  ON reviews (reviewee_id, created_at DESC);
