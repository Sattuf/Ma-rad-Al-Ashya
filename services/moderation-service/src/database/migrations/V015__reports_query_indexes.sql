-- V015__reports_query_indexes.sql
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created
  ON reports (reporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target
  ON reports (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created
  ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_counts_type_pending
  ON report_counts (target_type, pending_count DESC);
