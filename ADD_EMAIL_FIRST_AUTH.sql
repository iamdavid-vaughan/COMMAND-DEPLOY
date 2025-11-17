-- Email-First Authentication & OAuth Integration
-- Run on server: sudo -u postgres psql focal_deploy_saas < ADD_EMAIL_FIRST_AUTH.sql

\c focal_deploy_saas

-- ============================================
-- PART 1: Update Users Table
-- ============================================

-- Add email verification and OAuth columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(20); -- 'google', 'github', or NULL
ALTER TABLE users ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company VARCHAR(255);

-- Make password nullable (for OAuth users or users who haven't set password yet)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Add unique constraint on oauth_provider + oauth_id combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_provider_id
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;

COMMENT ON COLUMN users.email_verified IS 'Whether email has been verified via token';
COMMENT ON COLUMN users.is_active IS 'Account is active (email verified + password set, or OAuth login completed)';
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider: google, github, or NULL for email signup';
COMMENT ON COLUMN users.oauth_id IS 'Unique ID from OAuth provider';
COMMENT ON COLUMN users.last_login_at IS 'Timestamp of last successful login';
COMMENT ON COLUMN users.company IS 'Optional company name provided during signup';

-- ============================================
-- PART 2: Email Verification Tokens
-- ============================================

-- Create email_verification_tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE email_verification_tokens IS 'Email verification tokens (24hr expiration)';
COMMENT ON COLUMN email_verification_tokens.token IS 'Unique verification token sent via email';
COMMENT ON COLUMN email_verification_tokens.expires_at IS '24 hours from creation';
COMMENT ON COLUMN email_verification_tokens.used_at IS 'When token was used (NULL if unused)';

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires ON email_verification_tokens(expires_at);

-- ============================================
-- PART 3: Password Reset Tokens
-- ============================================

-- Create password_reset_tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE password_reset_tokens IS 'Password reset tokens (4hr expiration)';
COMMENT ON COLUMN password_reset_tokens.token IS 'Unique reset token sent via email';
COMMENT ON COLUMN password_reset_tokens.expires_at IS '4 hours from creation';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'When token was used (NULL if unused)';

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================
-- PART 4: Update Existing Users
-- ============================================

-- Mark existing users as verified and active (backward compatibility)
UPDATE users
SET
  email_verified = true,
  is_active = true
WHERE password IS NOT NULL;

-- ============================================
-- PART 5: Grant Permissions
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE email_verification_tokens TO davidvaughan;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE password_reset_tokens TO davidvaughan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO davidvaughan;

-- ============================================
-- PART 6: Verification
-- ============================================

-- Verify new columns in users table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('email_verified', 'is_active', 'oauth_provider', 'oauth_id', 'company')
ORDER BY ordinal_position;

-- Verify new tables
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('email_verification_tokens', 'password_reset_tokens')
ORDER BY table_name;

\echo '✅ Email-first authentication schema installed successfully!'
