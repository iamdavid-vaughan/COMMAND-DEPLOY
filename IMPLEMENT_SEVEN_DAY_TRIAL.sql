-- Implement 7-Day Free Trial System
-- Run on server: sudo -u postgres psql focal_deploy_saas < IMPLEMENT_SEVEN_DAY_TRIAL.sql

\c focal_deploy_saas

-- 1. Add trial columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';

COMMENT ON COLUMN users.trial_started_at IS 'When the user started their 7-day free trial';
COMMENT ON COLUMN users.trial_ends_at IS 'When the trial period ends (7 days from start)';
COMMENT ON COLUMN users.trial_used IS 'Whether the user has used their one-time trial';
COMMENT ON COLUMN users.subscription_status IS 'Current status: trial, active, cancelled, past_due, refund_requested';

-- 2. Create refund_requests table
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id VARCHAR(255),
  transaction_id VARCHAR(255),
  amount DECIMAL(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id),
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT check_status CHECK (status IN ('pending', 'approved', 'denied', 'processed'))
);

COMMENT ON TABLE refund_requests IS 'Tracks user refund requests for 7-day money-back guarantee';
COMMENT ON COLUMN refund_requests.status IS 'pending=submitted, approved=admin approved, denied=admin denied, processed=refund completed';
COMMENT ON COLUMN refund_requests.admin_notes IS 'Internal notes from admin reviewing the request';

CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_requested_at ON refund_requests(requested_at);

-- 3. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE refund_requests TO davidvaughan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO davidvaughan;

-- 4. Verify
SELECT COUNT(*) as refund_table_count FROM information_schema.tables WHERE table_name = 'refund_requests';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE '%trial%';
