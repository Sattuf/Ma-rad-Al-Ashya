-- 0006 — Item condition and location on listings.
--
-- Both forms (app and website) already collect them; until now the server dropped them.
--
-- Written to be instant on a large, busy table:
-- - Nullable columns without a default are a catalogue-only change: no table rewrite.
--   Existing listings read as NULL ("not specified").
-- - The CHECK is added NOT VALID, so it does not scan the table while holding the
--   ACCESS EXCLUSIVE lock. It is still enforced on every INSERT and UPDATE from now on,
--   and every existing row is NULL, which passes it: there is nothing left to validate.
-- - lock_timeout: if a long transaction holds the table, fail fast and retry the deploy
--   instead of queueing every read and write behind this ALTER.
--
-- No index on condition: two values, only ever combined with the status/category
-- indexes already used by the listing queries, where it is a cheap filter.

SET LOCAL lock_timeout = '5s';

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS condition VARCHAR(10),
  ADD COLUMN IF NOT EXISTS location  VARCHAR(100);

ALTER TABLE listings
  ADD CONSTRAINT listings_condition_check CHECK (condition IN ('new', 'used')) NOT VALID;
