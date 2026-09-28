-- 0002 — Indexes for the admin dashboard (GET …/admin/stats in each owning service).
--
-- Every dashboard query filters on a 30-day window of created_at / reviewed_at. Without
-- these indexes each one is a full table scan; with them it is a short range scan.
-- Results are also cached in the services (common/stats.ts), so these run about once a
-- minute per instance at most.
--
-- Plain CREATE INDEX (not CONCURRENTLY) because db/migrate.mjs runs each file in a
-- transaction. On a large production table, create the index CONCURRENTLY by hand first;
-- IF NOT EXISTS then makes this migration a no-op.

CREATE INDEX IF NOT EXISTS idx_users_created        ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_listings_created     ON listings (created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions (created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_created      ON reviews (created_at);
CREATE INDEX IF NOT EXISTS idx_reports_created      ON reports (created_at);
CREATE INDEX IF NOT EXISTS idx_reports_reviewed     ON reports (reviewed_at) WHERE reviewed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_paid_created
  ON promotions (created_at) WHERE stripe_payment_status = 'succeeded';
