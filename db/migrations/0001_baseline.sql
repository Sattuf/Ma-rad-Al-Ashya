-- 0001_baseline.sql
-- Consolidated schema. Replaces the per-service V00x files, which could never be applied
-- in order (users was never created, the same ALTERs lived in three services, and version
-- numbers collided). Column sets match the TypeORM entities and the SQL the services run.
--
-- Table ownership (only the owner writes the table; others go through its API):
--   users ............................ auth-service (identity) + users-service (profile columns)
--   categories, listings, listing_images, promotions ... listings-service
--   transactions, reviews, user_rating_summary ......... transactions-service
--   reports, report_counts ............................. moderation-service
--   kyc_verifications, kyc_audit_logs .................. identity-service
--   ab_test_results .................................... search-service
--   fraud_signals ...................................... fraud-service

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── users ──────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending', 'banned');
CREATE TYPE auth_provider_type AS ENUM ('local', 'google', 'facebook');

CREATE TABLE users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone                     VARCHAR(20) UNIQUE,
  email                     VARCHAR(255) UNIQUE,
  full_name                 VARCHAR(100) NOT NULL,
  avatar_url                TEXT,
  bio                       TEXT,
  city                      VARCHAR(100),
  location_lat              DECIMAL(10, 8),
  location_lng              DECIMAL(11, 8),
  password_hash             VARCHAR(255),
  provider                  VARCHAR(20) NOT NULL DEFAULT 'local',
  provider_id               VARCHAR(255),
  auth_provider             auth_provider_type NOT NULL DEFAULT 'local',
  google_id                 VARCHAR(255) UNIQUE,
  facebook_id               VARCHAR(255) UNIQUE,
  role                      user_role NOT NULL DEFAULT 'user',
  status                    user_status NOT NULL DEFAULT 'active',
  is_verified               BOOLEAN NOT NULL DEFAULT false,
  is_phone_verified         BOOLEAN NOT NULL DEFAULT false,
  is_email_verified         BOOLEAN NOT NULL DEFAULT false,
  is_identity_verified      BOOLEAN NOT NULL DEFAULT false,
  identity_verified_at      TIMESTAMPTZ,
  fcm_token                 TEXT,
  preferred_language        VARCHAR(5) NOT NULL DEFAULT 'ar',
  notification_messages     BOOLEAN NOT NULL DEFAULT true,
  notification_listings     BOOLEAN NOT NULL DEFAULT true,
  notification_transactions BOOLEAN NOT NULL DEFAULT true,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── listings ───────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(255) NOT NULL,
  slug       VARCHAR(255) NOT NULL UNIQUE,
  parent_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_categories_parent_id ON categories (parent_id);

CREATE TABLE listings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price       DECIMAL(12, 2) NOT NULL CHECK (price > 0),
  currency    VARCHAR(3) DEFAULT 'USD',
  status      VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'deleted')),
  views_count INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
-- Match the paginated queries: filter by status [+ category | user], newest first.
CREATE INDEX idx_listings_status_created          ON listings (status, created_at DESC, id DESC);
CREATE INDEX idx_listings_category_status_created ON listings (category_id, status, created_at DESC, id DESC);
CREATE INDEX idx_listings_user_status_created     ON listings (user_id, status, created_at DESC, id DESC);

CREATE TABLE listing_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url     VARCHAR(1024) NOT NULL,
  thumbnail_url VARCHAR(1024) NOT NULL,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_listing_images_listing_sort ON listing_images (listing_id, sort_order);

CREATE TABLE promotions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id               UUID UNIQUE REFERENCES listings(id) ON DELETE CASCADE,
  seller_id                UUID NOT NULL,
  plan                     VARCHAR(50) NOT NULL CHECK (plan IN ('basic', 'featured', 'premium')),
  price_paid               DECIMAL(10, 2) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_status    VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (stripe_payment_status IN ('pending', 'succeeded', 'failed')),
  boost_multiplier         DECIMAL(3, 2) NOT NULL,
  starts_at                TIMESTAMPTZ,
  expires_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_promotions_seller_id ON promotions (seller_id);

-- ── transactions ───────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL,
  seller_id           UUID NOT NULL,
  buyer_id            UUID NOT NULL,
  status              VARCHAR(20) DEFAULT 'pending_seller' CHECK (status IN ('pending_seller', 'pending_buyer', 'completed', 'cancelled')),
  seller_confirmed_at TIMESTAMP NULL,
  buyer_confirmed_at  TIMESTAMP NULL,
  cancelled_by        UUID NULL,
  cancel_reason       TEXT NULL,
  created_at          TIMESTAMP DEFAULT now(),
  updated_at          TIMESTAMP DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);
CREATE INDEX idx_transactions_buyer_created  ON transactions (buyer_id, created_at DESC);
CREATE INDEX idx_transactions_seller_created ON transactions (seller_id, created_at DESC);
CREATE INDEX idx_transactions_listing        ON transactions (listing_id);

CREATE TABLE reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  reviewer_id    UUID NOT NULL,
  reviewee_id    UUID NOT NULL,
  listing_id     UUID NOT NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT NULL,
  created_at     TIMESTAMP DEFAULT now(),
  UNIQUE (transaction_id, reviewer_id)
);
CREATE INDEX idx_reviews_reviewee_created ON reviews (reviewee_id, created_at DESC);

CREATE TABLE user_rating_summary (
  user_id        UUID PRIMARY KEY,
  total_reviews  INT DEFAULT 0,
  average_rating DECIMAL(3, 2) DEFAULT 0.00,
  rating_1_count INT DEFAULT 0,
  rating_2_count INT DEFAULT 0,
  rating_3_count INT DEFAULT 0,
  rating_4_count INT DEFAULT 0,
  rating_5_count INT DEFAULT 0,
  last_updated   TIMESTAMP DEFAULT now()
);

-- ── moderation ─────────────────────────────────────────────────────────────
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL,
  target_type  VARCHAR(10) CHECK (target_type IN ('listing', 'user')),
  target_id    UUID NOT NULL,
  reason       VARCHAR(20) CHECK (reason IN ('spam', 'fake', 'inappropriate', 'scam', 'offensive', 'wrong_category', 'other')),
  description  TEXT NULL,
  status       VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by  UUID NULL,
  reviewed_at  TIMESTAMP NULL,
  action_taken VARCHAR(20) NULL CHECK (action_taken IN ('none', 'warning', 'listing_removed', 'user_suspended', 'user_banned')),
  admin_note   TEXT NULL,
  created_at   TIMESTAMP DEFAULT now(),
  updated_at   TIMESTAMP DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX idx_reports_target         ON reports (target_type, target_id, created_at DESC);
CREATE INDEX idx_reports_status_created ON reports (status, created_at DESC);

CREATE TABLE report_counts (
  target_type      VARCHAR(10),
  target_id        UUID,
  pending_count    INT DEFAULT 0,
  total_count      INT DEFAULT 0,
  last_reported_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (target_type, target_id)
);
CREATE INDEX idx_report_counts_type_pending ON report_counts (target_type, pending_count DESC);

-- ── identity (KYC) ─────────────────────────────────────────────────────────
CREATE TABLE kyc_verifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  session_id     VARCHAR(255) NOT NULL UNIQUE,
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',
  vendor_data    JSONB,
  encrypted_data BYTEA,
  kms_key_id     VARCHAR(255),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at     TIMESTAMP
);
CREATE INDEX idx_kyc_verifications_user_created ON kyc_verifications (user_id, created_at DESC);
CREATE INDEX idx_kyc_verifications_pending_expiry ON kyc_verifications (expires_at) WHERE status = 'pending';

CREATE TABLE kyc_audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  action     VARCHAR(100) NOT NULL,
  details    JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_kyc_audit_logs_user_created ON kyc_audit_logs (user_id, created_at DESC);

-- ── search A/B testing ─────────────────────────────────────────────────────
CREATE TABLE ab_test_results (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant            CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  user_id            UUID,
  session_id         VARCHAR(255),
  query              TEXT,
  results_count      INTEGER NOT NULL DEFAULT 0,
  clicked_listing_id UUID,
  click_position     INTEGER,
  created_at         TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_ab_test_variant_created ON ab_test_results (variant, created_at);

-- ── fraud (shape used by fraud-service) ────────────────────────────────────
CREATE TABLE fraud_signals (
  id          SERIAL PRIMARY KEY,
  user_id     VARCHAR(255) NOT NULL,
  signal_type VARCHAR(255) NOT NULL,
  description TEXT,
  risk_score  FLOAT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_fraud_signals_user    ON fraud_signals (user_id);
CREATE INDEX idx_fraud_signals_created ON fraud_signals (created_at DESC);
