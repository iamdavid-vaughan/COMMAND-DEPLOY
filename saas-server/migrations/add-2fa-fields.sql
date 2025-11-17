-- Migration: Add 2FA (Two-Factor Authentication) fields to users table
-- Date: 2025-01-14

-- Add 2FA fields
ALTER TABLE users
ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS twofa_secret TEXT,
ADD COLUMN IF NOT EXISTS twofa_backup_codes JSONB DEFAULT '[]'::jsonb;

-- Add index for 2FA enabled users (for analytics)
CREATE INDEX IF NOT EXISTS idx_users_twofa_enabled ON users(twofa_enabled);

-- Add comment
COMMENT ON COLUMN users.twofa_enabled IS 'Whether 2FA/TOTP is enabled for this user';
COMMENT ON COLUMN users.twofa_secret IS 'Encrypted TOTP secret for 2FA';
COMMENT ON COLUMN users.twofa_backup_codes IS 'Encrypted backup recovery codes for 2FA';
