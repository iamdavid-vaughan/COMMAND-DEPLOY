# Database Migration Schema Fix

## Problem

The database migrations reported as "already applied" but the actual tables are missing required columns:

- **subscriptions table**: Missing `authnet_subscription_id` and other Authorize.Net related columns
- **invoices table**: Missing `amount` and other billing-related columns

This causes the application to crash with errors like:
```
SequelizeDatabaseError: column "authnet_subscription_id" does not exist
SequelizeDatabaseError: column "amount" does not exist
```

## Solution

Run the provided SQL script to manually add all missing columns to the database.

## How to Fix

From the `~/app/focal-deploy/saas-server` directory, run:

```bash
psql $DATABASE_URL -f ~/COMMAND-DEPLOY/fix-migration-schema.sql
```

Or if you need to specify the database URL explicitly:

```bash
psql "your-database-url" -f ~/COMMAND-DEPLOY/fix-migration-schema.sql
```

## What the Script Does

1. Checks for missing columns in `subscriptions` table and adds them
2. Checks for missing columns in `invoices` table and adds them
3. Creates necessary indexes
4. Displays the final schema for verification

## Verification

After running the script, you should see output like:
- "Added authnet_subscription_id to subscriptions"
- "Added amount to invoices"
- etc.

Then the final schema will be displayed showing all columns.

## Testing

After applying the fix:
1. Restart your application
2. Access the billing endpoints
3. Verify no more "column does not exist" errors

## Prevention

To prevent this issue in the future, consider:
1. Checking migration status with schema validation
2. Using migration rollback before re-running failed migrations
3. Adding schema verification tests
