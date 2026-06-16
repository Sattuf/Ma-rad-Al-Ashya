CREATE TABLE IF NOT EXISTS fraud_signals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  signal_type VARCHAR(50) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  ip_address VARCHAR(45),
  device_fingerprint VARCHAR(255),
  metadata JSONB,
  action_taken VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risk_scores (
  user_id INTEGER PRIMARY KEY,
  score INTEGER NOT NULL,
  risk_level VARCHAR(50) NOT NULL,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  factors JSONB
);
