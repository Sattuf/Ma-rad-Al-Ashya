-- V002__alter_users_auth.sql

-- Create custom ENUM types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending');

-- Add new columns
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN status user_status NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT false;

-- Modify existing columns to be nullable
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
