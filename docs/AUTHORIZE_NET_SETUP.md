# Authorize.Net Setup Guide (Sandbox & Production)

## Overview

Focal Deploy uses Authorize.Net for subscription billing. This guide shows you exactly how to get your API credentials from the Authorize.Net sandbox (for testing) and production (for live payments).

## Part 1: Sandbox Setup (For Testing)

You're logged into the sandbox - perfect! Follow these steps:

### Step 1: Get Your API Login ID and Transaction Key

1. **In Authorize.Net Sandbox Dashboard**, look for the navigation on the left side
2. Click **"Account"** (top menu) → **"Settings"**
3. In the Settings menu, find and click **"API Credentials & Keys"**
   - Or navigate directly to: https://sandbox.authorize.net → Account → Settings → API Credentials & Keys

### Step 2: View/Generate API Login ID

4. You'll see a page titled "API Credentials & Keys"
5. **API Login ID** is shown at the top - it looks like: `5KP3u95bQpv`
   - This is your **API_LOGIN_ID**
   - Copy this value

### Step 3: Generate Transaction Key

6. Under "API Login ID", you'll see **"New Transaction Key"** button
7. Click **"New Transaction Key"**
8. You might need to type an answer to your security question
9. **IMPORTANT**: The Transaction Key is shown **ONLY ONCE**
   - It looks like: `346HZ32z3fP4hTG2`
   - Copy it immediately - you cannot view it again!
   - If you lose it, you'll need to generate a new one

### Step 4: Add Credentials to Your Server

SSH into your server and edit the `.env` file:

```bash
cd ~/app/focal-deploy/saas-server
nano .env
```

Add these lines (or update if they exist):

```bash
# Authorize.Net Sandbox Credentials
AUTHNET_API_LOGIN_ID=5KP3u95bQpv          # Your API Login ID from step 5
AUTHNET_TRANSACTION_KEY=346HZ32z3fP4hTG2  # Your Transaction Key from step 9
AUTHNET_ENVIRONMENT=sandbox                 # sandbox for testing
AUTHNET_ENABLED=true                        # Enable billing system
```

Save and exit (Ctrl+X, then Y, then Enter)

### Step 5: Restart Backend

```bash
pm2 restart focal-saas-api
```

### Step 6: Verify in Admin Panel

1. Go to: https://app.focuswithfocal.io/dashboard/admin/settings
2. Scroll to "Authorize.Net Configuration"
3. You should see:
   - API Login ID: `5KP3u95bQpv` (masked as `5KP***Qpv`)
   - Environment: `sandbox`
   - Status: ✅ Connected

## Part 2: Testing Sandbox Payments

### Test Credit Card Numbers

Authorize.Net Sandbox accepts these test card numbers:

| Card Type | Number | CVV | Expiration |
|-----------|--------|-----|------------|
| Visa | 4007000000027 | 123 | Any future date |
| Visa | 4012888818888 | 123 | Any future date |
| Mastercard | 5424000000000015 | 123 | Any future date |
| Amex | 370000000000002 | 1234 | Any future date |
| Discover | 6011000000000012 | 123 | Any future date |

**Important**:
- Use any future expiration date (e.g., 12/25)
- Use any billing zip code (e.g., 90210)
- These cards will always approve in sandbox
- No real money is charged

### Testing Subscriptions

1. Register a new user: https://app.focuswithfocal.io/register
2. Select a plan (e.g., "Professional - $99/mo")
3. Enter test card: `4007000000027`
4. CVV: `123`
5. Expiration: `12/25`
6. Submit

Expected behavior:
- Subscription created successfully
- User receives 7-day trial
- First charge happens after 7 days
- Recurring charges every month/year

### View Transactions in Sandbox

1. Go to Authorize.Net Sandbox Dashboard
2. Click **"Transactions"** → **"Unsettled Transactions"**
3. You'll see your test transactions
4. Click any transaction to view details

### View Subscriptions in Sandbox

1. Go to: **"Recurring Billing"** → **"Subscriptions"**
2. You'll see all active subscriptions
3. Can manually cancel, edit, or view details

## Part 3: Production Setup (For Live Payments)

**⚠️ Only do this when ready to accept real payments!**

### Step 1: Create Production Account

1. Go to: https://www.authorize.net/sign-up/
2. Choose your plan (usually "Payment Gateway")
3. Complete application process
4. Wait for approval (usually 1-2 business days)

### Step 2: Get Production API Credentials

Once approved:

1. Log into production: https://account.authorize.net
2. Click **"Account"** → **"Settings"**
3. Click **"API Credentials & Keys"**
4. Copy your **API Login ID**
5. Click **"New Transaction Key"** and copy it
6. **Store these securely** - they handle real money!

### Step 3: Update Production Environment

```bash
cd ~/app/focal-deploy/saas-server
nano .env
```

Change to production values:

```bash
# Authorize.Net Production Credentials
AUTHNET_API_LOGIN_ID=your_production_api_login_id
AUTHNET_TRANSACTION_KEY=your_production_transaction_key
AUTHNET_ENVIRONMENT=production  # Changed from 'sandbox'
AUTHNET_ENABLED=true
```

### Step 4: Enable Production Mode

⚠️ **IMPORTANT SECURITY CHECKLIST**:
- [ ] SSL certificate installed (https://)
- [ ] Database backups configured
- [ ] Error logging set up
- [ ] PCI compliance reviewed
- [ ] Terms of service published
- [ ] Privacy policy published
- [ ] Refund policy defined

### Step 5: Test with Real Card (Small Amount)

Before going live:
1. Create test account
2. Subscribe to cheapest plan
3. Use your own credit card (charge $1)
4. Verify charge appears in Authorize.Net
5. Verify subscription created correctly
6. Test cancellation
7. Verify refund works

## Part 4: Configuring in Admin Panel

### Method A: Via Web Interface

1. Go to: `/dashboard/admin/settings`
2. Find "Authorize.Net Configuration" section
3. Fill in:
   - **API Login ID**: Your API Login ID
   - **Transaction Key**: Your Transaction Key
   - **Environment**: `sandbox` or `production`
4. Click **"Save Configuration"**

### Method B: Via .env File (Recommended)

More secure - keeps credentials out of database:

```bash
# In saas-server/.env
AUTHNET_API_LOGIN_ID=your_api_login_id_here
AUTHNET_TRANSACTION_KEY=your_transaction_key_here
AUTHNET_ENVIRONMENT=sandbox  # or 'production'
AUTHNET_ENABLED=true
```

## Part 5: Troubleshooting

### "Authentication failed" Error

**Cause**: Wrong API Login ID or Transaction Key

**Solution**:
1. Verify credentials in Authorize.Net dashboard
2. Make sure you're using correct environment (sandbox vs production)
3. Regenerate transaction key if needed
4. Restart backend after changing `.env`

### "This transaction cannot be accepted"

**Cause**: Test cards only work in sandbox, real cards only in production

**Solution**:
- Sandbox: Use test card numbers (4007000000027)
- Production: Use real card numbers

### Subscriptions Not Creating

**Check**:
1. Backend logs: `pm2 logs focal-saas-api | grep AUTHNET`
2. Authorize.Net dashboard for API errors
3. Database `subscriptions` table for entries
4. User `license_tier` updated correctly

### Transaction Key Not Working

**If you lost it**:
1. Go to API Credentials & Keys
2. Click "New Transaction Key" again
3. This invalidates the old one
4. Update `.env` with new key
5. Restart backend

## Part 6: Subscription Flow

### How It Works

1. **User Registers** → Chooses plan → Enters CC info
2. **Trial Created** → 7-day free trial starts
   - `trial_started_at`: Now
   - `trial_ends_at`: Now + 7 days
   - `can_deploy_external`: false (in-app only)
   - Payment method stored in Authorize.Net

3. **After 7 Days** → Automatic charge
   - Authorize.Net charges card automatically
   - If successful: User continues with full access
   - If failed: User suspended, email sent

4. **Monthly/Yearly** → Recurring charges
   - Authorize.Net handles all recurring billing
   - Webhooks notify our system of successful/failed payments
   - We update user status accordingly

### Testing the Full Flow

```bash
# 1. Register new user
curl -X POST https://app.focuswithfocal.io/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "plan": "professional",
    "billingCycle": "monthly",
    "paymentMethod": {
      "cardNumber": "4007000000027",
      "expirationDate": "12/25",
      "cvv": "123",
      "billingZip": "90210"
    }
  }'

# 2. Check Authorize.Net sandbox for subscription
# 3. Wait (or manually trigger after 7 days)
# 4. Verify charge processed
# 5. Check user's license_tier updated
```

## Part 7: Monitoring & Management

### View All Subscriptions

**Admin Dashboard**: `/dashboard/admin` (coming soon)
- List of all active subscriptions
- Revenue tracking
- Failed payment alerts

### Cancel Subscription

**API Endpoint**: `POST /api/billing/cancel`
```bash
curl -X POST https://app.focuswithfocal.io/api/billing/cancel \
  -H "Authorization: Bearer {user_token}"
```

**Authorize.Net Dashboard**:
1. Recurring Billing → Subscriptions
2. Find subscription
3. Click "Cancel"

### Update Payment Method

**API Endpoint**: `POST /api/billing/payment-method`
```bash
curl -X POST https://app.focuswithfocal.io/api/billing/payment-method \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "cardNumber": "4012888818888",
    "expirationDate": "12/26",
    "cvv": "123"
  }'
```

## Quick Reference

### Sandbox

- **Login**: https://sandbox.authorize.net
- **API Login ID**: Account → Settings → API Credentials & Keys
- **Transaction Key**: Click "New Transaction Key" (shown once!)
- **Test Cards**: 4007000000027 (Visa)
- **Environment**: `sandbox`

### Production

- **Login**: https://account.authorize.net
- **Signup**: https://www.authorize.net/sign-up/
- **Real Cards Only**: No test numbers
- **Environment**: `production`
- **PCI Compliance Required**: Yes

### Configuration Files

- **Environment**: `saas-server/.env`
- **Admin Panel**: `/dashboard/admin/settings`
- **Billing Service**: `saas-server/services/billing.js`
- **Subscription Routes**: `saas-server/routes/billing.js`

## Support

### Authorize.Net Support
- **Phone**: 1-877-447-3938
- **Email**: https://www.authorize.net/support/
- **Documentation**: https://developer.authorize.net/

### Focal Deploy Issues
- Check logs: `pm2 logs focal-saas-api`
- Database: Check `subscriptions` table
- API errors: Enable debug mode in billing service

---

**Next Steps**: Set up sandbox credentials, test with test card, verify subscription creation!
