-- ============================================================================
-- معرض الأشياء — Ma'rad Al-Ashya' C2C Marketplace
-- V001__initial_schema.sql — المخطط الأولي لقاعدة البيانات
-- ============================================================================

-- تفعيل إضافة UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- أنواع ENUM المخصصة
-- ============================================================================

CREATE TYPE listing_condition AS ENUM (
    'new',
    'like_new',
    'good',
    'fair',
    'poor'
);

CREATE TYPE listing_status AS ENUM (
    'draft',
    'active',
    'sold',
    'expired',
    'removed'
);

CREATE TYPE transaction_status AS ENUM (
    'pending',
    'accepted',
    'meeting_scheduled',
    'completed',
    'cancelled',
    'disputed'
);

-- ============================================================================
-- دالة تحديث updated_at تلقائيًا — Auto-update Trigger Function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. جدول المستخدمين — users
-- ============================================================================

CREATE TABLE users (
    id                    UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone                 VARCHAR(20)     UNIQUE NOT NULL,
    email                 VARCHAR(255)    UNIQUE,
    full_name             VARCHAR(100)    NOT NULL,
    avatar_url            TEXT,
    bio                   TEXT,
    is_verified           BOOLEAN         NOT NULL DEFAULT false,
    is_phone_verified     BOOLEAN         NOT NULL DEFAULT false,
    identity_verified_at  TIMESTAMPTZ,
    location_lat          DECIMAL(10, 8),
    location_lng          DECIMAL(11, 8),
    city                  VARCHAR(100),
    password_hash         VARCHAR(255)    NOT NULL,
    provider              VARCHAR(20)     NOT NULL DEFAULT 'local',
    provider_id           VARCHAR(255),
    fcm_token             TEXT,
    preferred_language    VARCHAR(5)      NOT NULL DEFAULT 'ar',
    created_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. جدول التصنيفات — categories
-- ============================================================================

CREATE TABLE categories (
    id              SERIAL          PRIMARY KEY,
    name_ar         VARCHAR(100)    NOT NULL,
    name_en         VARCHAR(100),
    slug            VARCHAR(100)    UNIQUE NOT NULL,
    parent_id       INT             REFERENCES categories(id) ON DELETE SET NULL,
    icon_url        TEXT,
    sort_order      INT             NOT NULL DEFAULT 0,
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);

-- ============================================================================
-- 3. جدول الإعلانات — listings
-- ============================================================================

CREATE TABLE listings (
    id              UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id       UUID                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id     INT                 NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title           VARCHAR(200)        NOT NULL,
    description     TEXT,
    price           DECIMAL(12, 2)      NOT NULL,
    currency        VARCHAR(3)          NOT NULL DEFAULT 'SAR',
    condition       listing_condition,
    status          listing_status      NOT NULL DEFAULT 'draft',
    location_lat    DECIMAL(10, 8),
    location_lng    DECIMAL(11, 8),
    city            VARCHAR(100),
    view_count      INT                 NOT NULL DEFAULT 0,
    favorite_count  INT                 NOT NULL DEFAULT 0,
    is_featured     BOOLEAN             NOT NULL DEFAULT false,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_listings_seller_id   ON listings(seller_id);
CREATE INDEX idx_listings_category_id ON listings(category_id);
CREATE INDEX idx_listings_status      ON listings(status);
CREATE INDEX idx_listings_city        ON listings(city);
CREATE INDEX idx_listings_created_at  ON listings(created_at DESC);

-- ============================================================================
-- 4. جدول صور الإعلانات — listing_images
-- ============================================================================

CREATE TABLE listing_images (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id      UUID            NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url       TEXT            NOT NULL,
    thumbnail_url   TEXT,
    sort_order      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_listing_images_listing_id ON listing_images(listing_id);

-- ============================================================================
-- 5. جدول المعاملات — transactions
-- ============================================================================

CREATE TABLE transactions (
    id                      UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id              UUID                NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    buyer_id                UUID                NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id               UUID                NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status                  transaction_status  NOT NULL DEFAULT 'pending',
    meeting_location_lat    DECIMAL(10, 8),
    meeting_location_lng    DECIMAL(11, 8),
    meeting_address         TEXT,
    meeting_time            TIMESTAMPTZ,
    amount                  DECIMAL(12, 2)      NOT NULL,
    currency                VARCHAR(3)          NOT NULL DEFAULT 'SAR',
    buyer_confirmed         BOOLEAN             NOT NULL DEFAULT false,
    seller_confirmed        BOOLEAN             NOT NULL DEFAULT false,
    cancelled_by            UUID                REFERENCES users(id) ON DELETE SET NULL,
    cancellation_reason     TEXT,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_transactions_buyer_id   ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller_id  ON transactions(seller_id);
CREATE INDEX idx_transactions_listing_id ON transactions(listing_id);

-- ============================================================================
-- 6. جدول التقييمات — reviews
-- ============================================================================

CREATE TABLE reviews (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id  UUID            UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    reviewer_id     UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reviewee_id     UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    rating          SMALLINT        NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

-- ============================================================================
-- نهاية المخطط الأولي
-- ============================================================================
