ALTER TABLE users 
  ADD COLUMN full_name VARCHAR(100),
  ADD COLUMN bio TEXT,
  ADD COLUMN city VARCHAR(100),
  ADD COLUMN avatar_url VARCHAR(500),
  ADD COLUMN notification_messages BOOLEAN DEFAULT true,
  ADD COLUMN notification_listings BOOLEAN DEFAULT true,
  ADD COLUMN notification_transactions BOOLEAN DEFAULT true;
