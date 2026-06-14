-- V003__add_oauth_fields.sql

-- Create custom ENUM type for OAuth provider
CREATE TYPE auth_provider_type AS ENUM ('local', 'google', 'facebook');

-- Add OAuth fields to users table
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN facebook_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN auth_provider auth_provider_type NOT NULL DEFAULT 'local';
