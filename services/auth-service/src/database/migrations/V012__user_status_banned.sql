-- V012__user_status_banned.sql
-- moderation-service can ban users; the enum previously only allowed active/suspended/pending.
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'banned';
