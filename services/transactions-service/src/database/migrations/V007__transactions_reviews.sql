CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_seller' CHECK (status IN ('pending_seller','pending_buyer','completed','cancelled')),
    seller_confirmed_at TIMESTAMP NULL,
    buyer_confirmed_at TIMESTAMP NULL,
    cancelled_by UUID NULL,
    cancel_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    listing_id UUID NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(transaction_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS user_rating_summary (
    user_id UUID PRIMARY KEY,
    total_reviews INT DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    rating_1_count INT DEFAULT 0,
    rating_2_count INT DEFAULT 0,
    rating_3_count INT DEFAULT 0,
    rating_4_count INT DEFAULT 0,
    rating_5_count INT DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);
