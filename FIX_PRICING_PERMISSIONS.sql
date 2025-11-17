-- Fix permissions for pricing_tiers table
-- Run this as postgres superuser

\c focal_deploy_saas

-- Grant permissions to your saas user (replace with actual username if different)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pricing_tiers TO davidvaughan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO davidvaughan;

-- Verify permissions
\dp pricing_tiers
