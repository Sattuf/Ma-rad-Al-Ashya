CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID UNIQUE REFERENCES listings(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('basic', 'featured', 'premium')),
  price_paid DECIMAL(10,2) NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_payment_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (stripe_payment_status IN ('pending', 'succeeded', 'failed')),
  boost_multiplier DECIMAL(3,2) NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotions_seller_id ON promotions(seller_id);
CREATE INDEX idx_promotions_listing_id ON promotions(listing_id);
CREATE INDEX idx_promotions_stripe_payment_intent_id ON promotions(stripe_payment_intent_id);
