-- Add password reset fields to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly';

-- Add role and super_admin_for if they don't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS super_admin_for JSONB DEFAULT '[]';

-- Create index on reset token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);

COMMENT ON COLUMN users.password_reset_token IS 'Token for password reset (hashed)';
COMMENT ON COLUMN users.password_reset_expires IS 'When the reset token expires';
COMMENT ON COLUMN users.role IS 'User role: user, admin, super_admin';
COMMENT ON COLUMN users.super_admin_for IS 'Array of user IDs this admin can manage (["*"] for all users)';
