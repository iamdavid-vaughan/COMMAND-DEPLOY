-- Remove the free tier from pricing_tiers
-- Run this on your server: sudo -u postgres psql focal_deploy_saas < REMOVE_FREE_TIER.sql

\c focal_deploy_saas

-- Delete the free tier
DELETE FROM pricing_tiers WHERE id = 'free';

-- Reorder remaining tiers to start at 0
UPDATE pricing_tiers SET display_order = 0 WHERE id = 'starter';
UPDATE pricing_tiers SET display_order = 1 WHERE id = 'professional';
UPDATE pricing_tiers SET display_order = 2 WHERE id = 'business';
UPDATE pricing_tiers SET display_order = 3 WHERE id = 'enterprise';

-- Verify removal
SELECT id, name, monthly_price, display_order, is_active FROM pricing_tiers ORDER BY display_order;
