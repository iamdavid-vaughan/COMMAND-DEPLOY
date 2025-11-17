-- ============================================================================
-- Add Free Tier to Pricing Tiers
-- Run this on your production database after pulling latest code
-- ============================================================================

-- Add Free Tier (display_order = 0, shows first)
INSERT INTO pricing_tiers (
    id,
    name,
    description,
    monthly_price,
    yearly_price,
    features,
    limits,
    display_order,
    is_active,
    api_access,
    popular,
    contact_sales,
    dfy,
    super_admin_included,
    billing_options,
    created_at,
    updated_at
) VALUES (
    'free',
    'Free',
    'Perfect for getting started - no credit card required',
    0.00,
    NULL,
    '[
        "3 deployments per month",
        "1 instance maximum",
        "5GB storage",
        "Community support only",
        "Powered by Focal Deploy"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": 3,
        "concurrent": 1,
        "licenses": 1,
        "instances": 1,
        "storageGB": 5,
        "maxS3Buckets": 1,
        "maxDomains": 0,
        "teamMembers": 1
    }'::jsonb,
    0,
    true,
    false,
    false,
    false,
    false,
    false,
    '["monthly"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    monthly_price = EXCLUDED.monthly_price,
    yearly_price = EXCLUDED.yearly_price,
    features = EXCLUDED.features,
    limits = EXCLUDED.limits,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Update display order for existing tiers to make room for free tier
UPDATE pricing_tiers SET display_order = 1 WHERE id = 'starter';
UPDATE pricing_tiers SET display_order = 2 WHERE id = 'professional';
UPDATE pricing_tiers SET display_order = 3 WHERE id = 'max';
UPDATE pricing_tiers SET display_order = 4 WHERE id = 'enterprise';
UPDATE pricing_tiers SET display_order = 5 WHERE id = 'dfy';

-- Verify the changes
SELECT
    id,
    name,
    monthly_price,
    display_order,
    is_active,
    array_length(features, 1) as feature_count
FROM pricing_tiers
ORDER BY display_order;

-- ============================================================================
-- Success! Free tier added. New users will now default to this tier.
-- ============================================================================
