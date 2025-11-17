-- Create deployment_logs table

CREATE TABLE IF NOT EXISTS deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deployment_logs_deployment_id ON deployment_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_created_at ON deployment_logs(created_at);

-- Add comments
COMMENT ON TABLE deployment_logs IS 'Logs for deployment operations';
COMMENT ON COLUMN deployment_logs.deployment_id IS 'Foreign key to deployments table';
COMMENT ON COLUMN deployment_logs.level IS 'Log level: info, warning, error, success';
COMMENT ON COLUMN deployment_logs.message IS 'Log message';
COMMENT ON COLUMN deployment_logs.metadata IS 'Additional metadata for the log entry';
