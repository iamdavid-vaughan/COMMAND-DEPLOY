# 7-Day Free Trial Implementation Plan

## Overview
Implement a strict 7-day free trial system with credit card required upfront and clear refund policy.

## Database Changes Needed

### 1. Add trial columns to users table
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';
-- Options: 'trial', 'active', 'cancelled', 'past_due', 'refund_requested'
```

### 2. Add refund tracking table
```sql
CREATE TABLE IF NOT EXISTS refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subscription_id VARCHAR(255),
  amount DECIMAL(10, 2),
  reason TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied, processed
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  processed_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refund_requests_user_id ON refund_requests(user_id);
CREATE INDEX idx_refund_requests_status ON refund_requests(status);
```

## Backend Implementation

### 1. Registration Flow Changes
**File:** `saas-server/routes/auth.js`

- When user signs up, set `trial_started_at` to NOW
- Set `trial_ends_at` to 7 days from now
- Set `trial_used` to TRUE
- Set `subscription_status` to 'trial'
- Require credit card during registration (don't charge yet)
- Store payment method in Authorize.Net customer profile

### 2. Trial Expiration Checker
**File:** `saas-server/services/trialChecker.js` (NEW)

- Cron job runs daily
- Check users where `trial_ends_at < NOW` and `subscription_status = 'trial'`
- Auto-charge credit card for selected tier
- Update `subscription_status` to 'active'
- Send email notification
- If charge fails, set to 'past_due' and lock account

### 3. Refund Request API
**File:** `saas-server/routes/billing.js`

Add endpoints:
- `POST /api/billing/request-refund` - User submits refund request
- `GET /api/billing/refund-requests` - User views their requests
- `GET /api/admin/refund-requests` - Admin views all requests
- `PUT /api/admin/refund-requests/:id` - Admin approves/denies

### 4. Trial Status Middleware
**File:** `saas-server/middleware/trialCheck.js` (NEW)

- Check if user's trial has expired
- If expired and no payment, block API access
- Return 402 Payment Required status
- Include trial info in all auth responses

## Frontend Implementation

### 1. Registration Page Update
**File:** `dashboard/src/app/register/page.tsx`

- Add pricing tier selection during signup
- Add credit card form (using Authorize.Net)
- Show clear messaging: "7-day free trial, then $X/month"
- Add checkbox: "I agree to be charged after trial"
- Store payment method without charging

### 2. Trial Banner Component
**File:** `dashboard/src/components/TrialBanner.tsx` (NEW)

- Show days remaining in trial
- Countdown timer
- Link to billing page
- Only show during trial period

### 3. Refund Request Page
**File:** `dashboard/src/app/dashboard/billing/refund/page.tsx` (NEW)

- Form to request refund
- Email field (pre-filled): billing@focuswithfocal.com
- Reason textarea (required, minimum 50 characters)
- Clear terms: "Refunds processed within 5-7 business days"
- Show refund request status if already submitted

### 4. Admin Refund Management
**File:** `dashboard/src/app/dashboard/admin/refunds/page.tsx` (NEW)

- List all refund requests
- Filter by status (pending, approved, denied)
- View user details, subscription info
- Approve/deny buttons
- Process refund in Authorize.Net
- Add internal notes

## Email Templates

### 1. Trial Started Email
```
Subject: Your 7-Day Free Trial Has Started! 🚀

Hi [Name],

Welcome to Focal Deploy! Your 7-day free trial has started.

Trial Details:
- Started: [Date]
- Ends: [Date] at [Time]
- Selected Plan: [Tier Name] - $[Price]/month

What happens next:
✅ Full access to all features for 7 days
✅ No charges during trial period
✅ On [End Date], we'll charge your card $[Price]
✅ Cancel anytime before trial ends (no charge)

Need help? Reply to this email or visit our docs.

- The Focal Deploy Team
```

### 2. Trial Ending Soon Email (2 days before)
```
Subject: Your Focal Deploy Trial Ends in 2 Days ⏰

Hi [Name],

Just a friendly reminder: your 7-day free trial ends in 2 days.

Trial ending: [Date] at [Time]
Next charge: $[Price] on [Date]
Plan: [Tier Name]

What you can do:
- Continue using Focal Deploy (no action needed)
- Upgrade/downgrade your plan
- Cancel (no charge, but you'll lose access)

Manage your subscription: [Dashboard Link]

Questions? Email us at billing@focuswithfocal.com

- The Focal Deploy Team
```

### 3. Trial Ended & Charged Email
```
Subject: Your Focal Deploy Subscription is Now Active 🎉

Hi [Name],

Your 7-day trial has ended and your subscription is now active!

Charge Details:
- Amount: $[Price]
- Plan: [Tier Name]
- Next billing date: [Date]
- Payment method: [Last 4 digits]

Your account has full access and will renew automatically.

View invoice: [Link]
Manage subscription: [Dashboard Link]

Not satisfied? Request a full refund within 7 days:
Email: billing@focuswithfocal.com

- The Focal Deploy Team
```

### 4. Refund Request Confirmation
```
Subject: Refund Request Received - Focal Deploy

Hi [Name],

We've received your refund request.

Request Details:
- Amount: $[Price]
- Submitted: [Date]
- Status: Under Review

Our team will review your request within 24-48 hours. If approved, refunds are processed within 5-7 business days.

You'll receive an email once we've made a decision.

Request ID: [ID]

- The Focal Deploy Team
```

## Strict 7-Day Refund Policy Implementation

### Terms to Display:
1. **Must email billing@focuswithfocal.com** with:
   - Subject: "Refund Request - [Your Email]"
   - Reason for refund (required)
   - Account email

2. **Eligibility:**
   - Within 7 days of first charge (not trial start)
   - Must not have excessive usage (>100 deployments, etc.)
   - First refund only (no repeat refunders)

3. **Process:**
   - Human review (not automatic)
   - Response within 48 hours
   - Refund processed in 5-7 business days
   - Account suspended after refund

### Display Refund Policy:
- On billing page
- In trial emails
- During registration
- In footer of dashboard

## Priority Order

1. ✅ Remove free tier (SQL script created)
2. **Database schema updates** (trial columns + refund table)
3. **Registration flow** (add credit card, tier selection)
4. **Trial checker cron job** (auto-charge after 7 days)
5. **Trial banner component** (show days remaining)
6. **Refund request system** (frontend + backend)
7. **Admin refund management** (approve/deny)
8. **Email templates** (SendGrid/SES)

## After This:
- Move to **Application Deployment Wizard**
- Then **Web SSH Terminal**

---

**Estimated Time:** 2-3 days for trial system implementation
