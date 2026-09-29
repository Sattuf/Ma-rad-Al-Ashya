-- 0004 — fraud-service moves its MongoDB collections to Postgres.
--
-- Table ownership: device_accounts, ip_accounts, transaction_features ... fraud-service
--
-- device_fingerprints (Mongo) stored one document per check and counted distinct users
-- per device and per IP with $group on every check: the cost grew with every check ever
-- made, so a busy shared device got slower each time. Here each (device, user) and
-- (ip, user) pair is one row, upserted: the tables grow with distinct pairs, not with
-- checks, and "how many accounts use this device" is a short range of the primary key.

CREATE TABLE device_accounts (
  device_id       VARCHAR(255) NOT NULL,
  user_id         VARCHAR(255) NOT NULL,
  last_user_agent TEXT,
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, user_id)
);
-- "Which devices does this user use" (admin investigation, user deletion).
CREATE INDEX idx_device_accounts_user ON device_accounts (user_id);

CREATE TABLE ip_accounts (
  ip_address INET NOT NULL,
  user_id    VARCHAR(255) NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ip_address, user_id)
);
CREATE INDEX idx_ip_accounts_user ON ip_accounts (user_id);

-- Append-only log of scored transactions (training data for the anomaly model). Rows
-- arrive in time order, so a BRIN index on created_at gives time-range exports for a few
-- pages of index instead of a B-tree the size of a sizeable fraction of the table.
CREATE TABLE transaction_features (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id VARCHAR(255) NOT NULL,
  user_id        VARCHAR(255) NOT NULL,
  amount         NUMERIC(14, 2) NOT NULL,
  mcc            VARCHAR(16),
  country        VARCHAR(8),
  is_anomaly     BOOLEAN NOT NULL,
  anomaly_score  DOUBLE PRECISION NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transaction_features_created ON transaction_features USING brin (created_at);

-- fraud_signals: a user's risk is sum(risk_score) over their signals. A covering index
-- (risk_score in the leaf pages) answers it as an index-only scan, without reading the
-- table. Replaces the plain (user_id) index from 0001.
DROP INDEX IF EXISTS idx_fraud_signals_user;
CREATE INDEX idx_fraud_signals_user ON fraud_signals (user_id) INCLUDE (risk_score);
