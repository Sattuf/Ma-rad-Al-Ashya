-- 0007 — transaction_features.mcc holds the listing category.
--
-- A C2C sale has no card merchant, so transactions-service sends the listing's category
-- (a UUID, 36 characters) as the merchant category code. VARCHAR(16) rejected it.
--
-- Raising a VARCHAR limit is a catalogue-only change in Postgres: no rewrite, no scan.
-- lock_timeout: fail fast instead of queueing traffic if the table is busy.
SET lock_timeout = '5s';

ALTER TABLE transaction_features ALTER COLUMN mcc TYPE VARCHAR(64);
