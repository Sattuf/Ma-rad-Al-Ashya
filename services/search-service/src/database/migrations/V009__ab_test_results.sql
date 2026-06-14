CREATE TABLE IF NOT EXISTS ab_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  user_id UUID,
  session_id VARCHAR(255),
  query TEXT,
  results_count INTEGER NOT NULL DEFAULT 0,
  clicked_listing_id UUID,
  click_position INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_ab_test_variant ON ab_test_results(variant);
CREATE INDEX idx_ab_test_created ON ab_test_results(created_at);
