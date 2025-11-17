-- Fix missing columns in subscriptions and invoices tables
-- This script adds columns that should have been created by migrations but are missing

-- First, check if subscriptions table exists and add missing columns
DO $$
BEGIN
    -- Add authnet_subscription_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'authnet_subscription_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN authnet_subscription_id VARCHAR(100);
        RAISE NOTICE 'Added authnet_subscription_id to subscriptions';
    END IF;

    -- Add authnet_customer_profile_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'authnet_customer_profile_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN authnet_customer_profile_id VARCHAR(100);
        RAISE NOTICE 'Added authnet_customer_profile_id to subscriptions';
    END IF;

    -- Add authnet_payment_profile_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'authnet_payment_profile_id'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN authnet_payment_profile_id VARCHAR(100);
        RAISE NOTICE 'Added authnet_payment_profile_id to subscriptions';
    END IF;

    -- Add plan if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'plan'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN plan VARCHAR(50) NOT NULL DEFAULT 'free';
        RAISE NOTICE 'Added plan to subscriptions';
    END IF;

    -- Add billing_cycle if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'billing_cycle'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly';
        RAISE NOTICE 'Added billing_cycle to subscriptions';
    END IF;

    -- Add amount if it doesn't exist in subscriptions
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'amount'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
        RAISE NOTICE 'Added amount to subscriptions';
    END IF;

    -- Add status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'status'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
        RAISE NOTICE 'Added status to subscriptions';
    END IF;

    -- Add current_period_start if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'current_period_start'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added current_period_start to subscriptions';
    END IF;

    -- Add current_period_end if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'current_period_end'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added current_period_end to subscriptions';
    END IF;

    -- Add cancelled_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'cancelled_at'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added cancelled_at to subscriptions';
    END IF;

    -- Add trial_end if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'subscriptions' AND column_name = 'trial_end'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN trial_end TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added trial_end to subscriptions';
    END IF;
END $$;

-- Fix invoices table
DO $$
BEGIN
    -- Add subscription_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'subscription_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE ON UPDATE CASCADE;
        RAISE NOTICE 'Added subscription_id to invoices';
    END IF;

    -- Add invoice_number if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'invoice_number'
    ) THEN
        ALTER TABLE invoices ADD COLUMN invoice_number VARCHAR(50) NOT NULL UNIQUE;
        RAISE NOTICE 'Added invoice_number to invoices';
    END IF;

    -- Add amount if it doesn't exist in invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'amount'
    ) THEN
        ALTER TABLE invoices ADD COLUMN amount DECIMAL(10,2) NOT NULL DEFAULT 0.00;
        RAISE NOTICE 'Added amount to invoices';
    END IF;

    -- Add status if it doesn't exist in invoices
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'status'
    ) THEN
        ALTER TABLE invoices ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending';
        RAISE NOTICE 'Added status to invoices';
    END IF;

    -- Add authnet_transaction_id if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'authnet_transaction_id'
    ) THEN
        ALTER TABLE invoices ADD COLUMN authnet_transaction_id VARCHAR(100);
        RAISE NOTICE 'Added authnet_transaction_id to invoices';
    END IF;

    -- Add billing_period_start if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'billing_period_start'
    ) THEN
        ALTER TABLE invoices ADD COLUMN billing_period_start TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added billing_period_start to invoices';
    END IF;

    -- Add billing_period_end if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'billing_period_end'
    ) THEN
        ALTER TABLE invoices ADD COLUMN billing_period_end TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added billing_period_end to invoices';
    END IF;

    -- Add paid_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'paid_at'
    ) THEN
        ALTER TABLE invoices ADD COLUMN paid_at TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added paid_at to invoices';
    END IF;

    -- Add payment_method_last_four if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'payment_method_last_four'
    ) THEN
        ALTER TABLE invoices ADD COLUMN payment_method_last_four VARCHAR(4);
        RAISE NOTICE 'Added payment_method_last_four to invoices';
    END IF;

    -- Add error_message if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'invoices' AND column_name = 'error_message'
    ) THEN
        ALTER TABLE invoices ADD COLUMN error_message TEXT;
        RAISE NOTICE 'Added error_message to invoices';
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS invoices_user_id ON invoices(user_id);

-- Display final schema
SELECT 'Subscriptions columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
ORDER BY ordinal_position;

SELECT 'Invoices columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;
