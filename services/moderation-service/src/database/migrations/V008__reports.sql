CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_type VARCHAR(10) CHECK (target_type IN ('listing','user')),
  target_id UUID NOT NULL,
  reason VARCHAR(20) CHECK (reason IN ('spam','fake','inappropriate','scam','offensive','wrong_category','other')),
  description TEXT NULL,
  status VARCHAR(15) DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  reviewed_by UUID NULL,
  reviewed_at TIMESTAMP NULL,
  action_taken VARCHAR(20) NULL CHECK (action_taken IN ('none','warning','listing_removed','user_suspended','user_banned')),
  admin_note TEXT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(reporter_id, target_type, target_id)
);

CREATE TABLE report_counts (
  target_type VARCHAR(10),
  target_id UUID,
  pending_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  last_reported_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (target_type, target_id)
);
