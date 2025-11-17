-- Add Google Cloud Platform (GCP) Support
-- Run on server: sudo -u postgres psql focal_deploy_saas < ADD_GCP_SUPPORT.sql

\c focal_deploy_saas

-- 1. Add provider fields to deployments table
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS provider VARCHAR(10) DEFAULT 'aws';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS provider_region VARCHAR(50);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS provider_zone VARCHAR(50);
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS gcp_project_id VARCHAR(100);

COMMENT ON COLUMN deployments.provider IS 'Cloud provider: aws or gcp';
COMMENT ON COLUMN deployments.provider_region IS 'GCP region (e.g., us-central1) or AWS region';
COMMENT ON COLUMN deployments.provider_zone IS 'GCP zone (e.g., us-central1-a) - NULL for AWS';
COMMENT ON COLUMN deployments.gcp_project_id IS 'GCP Project ID - NULL for AWS deployments';

-- 2. Create GCP credentials table
CREATE TABLE IF NOT EXISTS gcp_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id VARCHAR(100) NOT NULL,
  service_account_email VARCHAR(255),
  service_account_key TEXT NOT NULL, -- Encrypted JSON key
  region VARCHAR(50) DEFAULT 'us-central1',
  zone VARCHAR(50) DEFAULT 'us-central1-a',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE gcp_credentials IS 'Encrypted GCP service account credentials for each user';
COMMENT ON COLUMN gcp_credentials.service_account_key IS 'AES-256-GCM encrypted JSON service account key';

CREATE INDEX IF NOT EXISTS idx_gcp_credentials_user_id ON gcp_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_gcp_credentials_project_id ON gcp_credentials(project_id);

-- 3. Update existing deployments to have provider='aws'
UPDATE deployments SET provider = 'aws' WHERE provider IS NULL;

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE gcp_credentials TO davidvaughan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO davidvaughan;

-- 5. Verify
SELECT COUNT(*) as gcp_credentials_table_count FROM information_schema.tables WHERE table_name = 'gcp_credentials';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'deployments' AND column_name LIKE '%provider%';

-- Show all provider values
SELECT provider, COUNT(*) FROM deployments GROUP BY provider;
