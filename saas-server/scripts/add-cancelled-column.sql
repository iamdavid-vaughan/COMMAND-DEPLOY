-- Add cancelled_by_user column to deployments table
ALTER TABLE deployments
ADD COLUMN IF NOT EXISTS cancelled_by_user BOOLEAN NOT NULL DEFAULT false;

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'deployments'
AND column_name = 'cancelled_by_user';
