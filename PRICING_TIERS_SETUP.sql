-- ============================================================================
-- Pricing Tiers Table Setup and Seed Data
-- Run this script directly in PostgreSQL to create the pricing_tiers table
-- and populate it with initial pricing data
-- ============================================================================

-- Drop table if it exists (USE WITH CAUTION IN PRODUCTION!)
-- DROP TABLE IF EXISTS pricing_tiers CASCADE;

-- Create pricing_tiers table
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id VARCHAR(50) PRIMARY KEY NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_price DECIMAL(10, 2),
    yearly_price DECIMAL(10, 2),
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    api_access BOOLEAN NOT NULL DEFAULT false,
    popular BOOLEAN NOT NULL DEFAULT false,
    contact_sales BOOLEAN NOT NULL DEFAULT false,
    dfy BOOLEAN NOT NULL DEFAULT false,
    super_admin_included BOOLEAN NOT NULL DEFAULT false,
    billing_options JSONB NOT NULL DEFAULT '["monthly", "yearly"]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments to columns
COMMENT ON COLUMN pricing_tiers.id IS 'Tier identifier (starter, professional, max, enterprise, dfy)';
COMMENT ON COLUMN pricing_tiers.name IS 'Display name of the tier';
COMMENT ON COLUMN pricing_tiers.description IS 'Marketing description of the tier';
COMMENT ON COLUMN pricing_tiers.monthly_price IS 'Monthly price in USD (null for custom/contact pricing)';
COMMENT ON COLUMN pricing_tiers.yearly_price IS 'Yearly price in USD (null for custom/contact pricing)';
COMMENT ON COLUMN pricing_tiers.features IS 'Array of feature strings or objects';
COMMENT ON COLUMN pricing_tiers.limits IS 'Object containing usage limits';
COMMENT ON COLUMN pricing_tiers.display_order IS 'Order in which to display tiers (lower = first)';
COMMENT ON COLUMN pricing_tiers.is_active IS 'Whether this tier is currently available for purchase';
COMMENT ON COLUMN pricing_tiers.api_access IS 'Whether this tier includes API access';
COMMENT ON COLUMN pricing_tiers.popular IS 'Whether to mark as "popular" choice';
COMMENT ON COLUMN pricing_tiers.contact_sales IS 'Whether to show "Contact Sales" instead of price';
COMMENT ON COLUMN pricing_tiers.dfy IS 'Whether this is a Done For You tier';
COMMENT ON COLUMN pricing_tiers.super_admin_included IS 'Whether this tier includes super admin access';
COMMENT ON COLUMN pricing_tiers.billing_options IS 'Array of available billing options';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_display_order ON pricing_tiers(display_order);
CREATE INDEX IF NOT EXISTS idx_pricing_tiers_is_active ON pricing_tiers(is_active);

-- Insert initial pricing tiers data
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
) VALUES
-- Starter Tier
(
    'starter',
    'Starter',
    'Perfect for individuals getting started with automated deployments',
    39.00,
    NULL,
    '[
        "10 deployments per month",
        "1 concurrent deployment",
        "1 machine license",
        "Up to 3 instances",
        "10GB storage",
        "Community support",
        "DIY deployment automation"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": 10,
        "concurrent": 1,
        "licenses": 1,
        "instances": 3,
        "storageGB": 10,
        "maxS3Buckets": 2,
        "maxDomains": 2,
        "teamMembers": 1
    }'::jsonb,
    1,
    true,
    false,
    false,
    false,
    false,
    false,
    '["monthly"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Professional Tier
(
    'professional',
    'Professional',
    'For growing teams who need more power and API access',
    99.00,
    990.00,
    '[
        "50 deployments per month",
        "5 concurrent deployments",
        "2 machine licenses",
        "Up to 15 instances",
        "50GB storage",
        "Email support",
        "Full API access",
        "Priority deployment queue"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": 50,
        "concurrent": 5,
        "licenses": 2,
        "instances": 15,
        "storageGB": 50,
        "maxS3Buckets": 10,
        "maxDomains": 10,
        "teamMembers": 5
    }'::jsonb,
    2,
    true,
    true,
    true,
    false,
    false,
    false,
    '["monthly", "yearly"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Max Tier
(
    'max',
    'Max',
    'Maximum power for teams managing multiple production environments',
    199.00,
    1990.00,
    '[
        "150 deployments per month",
        "15 concurrent deployments",
        "3 machine licenses",
        "Up to 50 instances",
        "200GB storage",
        "Priority support",
        "Full API access",
        "Advanced analytics",
        "Custom deployment hooks"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": 150,
        "concurrent": 15,
        "licenses": 3,
        "instances": 50,
        "storageGB": 200,
        "maxS3Buckets": 25,
        "maxDomains": 25,
        "teamMembers": 15
    }'::jsonb,
    3,
    true,
    true,
    false,
    false,
    false,
    false,
    '["monthly", "yearly"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Enterprise Tier
(
    'enterprise',
    'Enterprise',
    'Custom solutions for enterprise-scale deployment needs',
    NULL,
    NULL,
    '[
        "Unlimited deployments",
        "Unlimited concurrent",
        "Unlimited licenses",
        "Unlimited instances",
        "Unlimited storage",
        "Dedicated support",
        "Full API access",
        "SLA guarantee",
        "Custom integrations",
        "On-premise option",
        "Training & onboarding"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": -1,
        "concurrent": -1,
        "licenses": -1,
        "instances": -1,
        "storageGB": -1,
        "maxS3Buckets": -1,
        "maxDomains": -1,
        "teamMembers": -1
    }'::jsonb,
    4,
    true,
    true,
    false,
    true,
    false,
    false,
    '["contact"]'::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
-- Done For You Tier
(
    'dfy',
    'Done For You',
    'We handle all deployments for you - fully managed white-glove service',
    299.00,
    2990.00,
    '[
        "Unlimited deployments",
        "10 concurrent deployments",
        "1 machine license for you",
        "Up to 25 instances",
        "100GB storage",
        "White-glove support",
        "Dedicated deployment manager",
        "We deploy for you",
        "Full admin dashboard access",
        "Priority response",
        "Custom configurations"
    ]'::jsonb,
    '{
        "deploymentsPerMonth": -1,
        "concurrent": 10,
        "licenses": 1,
        "instances": 25,
        "storageGB": 100,
        "maxS3Buckets": -1,
        "maxDomains": -1,
        "teamMembers": 1
    }'::jsonb,
    5,
    true,
    false,
    false,
    false,
    true,
    true,
    '["monthly", "yearly"]'::jsonb,
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
    api_access = EXCLUDED.api_access,
    popular = EXCLUDED.popular,
    contact_sales = EXCLUDED.contact_sales,
    dfy = EXCLUDED.dfy,
    super_admin_included = EXCLUDED.super_admin_included,
    billing_options = EXCLUDED.billing_options,
    updated_at = CURRENT_TIMESTAMP;

-- Verify data was inserted
SELECT
    id,
    name,
    monthly_price,
    yearly_price,
    display_order,
    is_active,
    popular,
    array_length(features::json::text::json->'features', 1) as feature_count
FROM pricing_tiers
ORDER BY display_order;

-- ============================================================================
-- Success! Pricing tiers table created and populated with initial data.
-- You can now access these tiers from the admin panel at:
-- https://app.focuswithfocal.io/dashboard/admin/pricing
-- ============================================================================
