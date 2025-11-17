# Environment Setup Guide

## ✅ Postmark Email Service - Already Configured!

Good news! **Postmark is already set up** in your dependencies. I've updated the email service to use Postmark instead of SMTP.

### Required Environment Variables:

Add these to your `.env` file:

```bash
# Postmark Email Service
POSTMARK_API_TOKEN=your_postmark_server_api_token
POSTMARK_FROM_EMAIL=noreply@focuswithfocal.com

# Application URLs
FRONTEND_URL=https://app.focuswithfocal.io
API_URL=https://api.focuswithfocal.io
```

### How to confirm Postmark is set up:

1. Check your Postmark dashboard at https://account.postmarkapp.com/
2. Get your Server API Token from: Servers → Your Server → API Tokens
3. Make sure your sender signature is verified (noreply@focuswithfocal.com)
4. Test by sending a verification email through the API

The email service now uses `postmark.ServerClient` instead of nodemailer!

---

## OAuth SSO - COMPLETELY OPTIONAL!

### Do you need OAuth?

**NO!** OAuth (Google/GitHub login) is **completely optional**. Here's what you need to know:

### What is OAuth SSO?

OAuth SSO (Single Sign-On) allows users to sign in using their Google or GitHub account instead of creating a password. Think of it like when websites show:
- "Sign in with Google" 🔵
- "Sign in with GitHub" ⚫

### Why offer OAuth?

**Pros:**
- Users don't need to remember another password
- Faster signup (one click)
- Email is auto-verified (Google/GitHub already verified it)
- Reduces password reset requests
- Professional appearance

**Cons:**
- Requires setup with Google/GitHub
- Some users may not want to connect their Google/GitHub account
- Additional code complexity

### How OAuth Works (Simple Explanation):

1. User clicks "Sign in with Google"
2. They're redirected to Google's login page
3. Google verifies who they are
4. Google sends them back to your site with proof of identity
5. Your app creates/logs them in automatically

### Setup Requirements (If you want OAuth):

#### For Google OAuth:
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `https://api.focuswithfocal.io/api/oauth/google/callback`
6. Copy the **Client ID** and **Client Secret**
7. Add to `.env`:
   ```bash
   GOOGLE_CLIENT_ID=your_google_client_id_here
   GOOGLE_CLIENT_SECRET=your_google_client_secret_here
   ```

#### For GitHub OAuth:
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Set Authorization callback URL: `https://api.focuswithfocal.io/api/oauth/github/callback`
4. Copy the **Client ID** and **Client Secret**
5. Add to `.env`:
   ```bash
   GITHUB_CLIENT_ID=your_github_client_id_here
   GITHUB_CLIENT_SECRET=your_github_client_secret_here
   ```

### Can you skip OAuth?

**YES!** The email-first authentication works perfectly fine without OAuth. Users can still:
- Register with email
- Verify their email
- Set password
- Login normally

**If you skip OAuth:**
- Just don't add the Google/GitHub env variables
- Don't add the OAuth routes to server.js
- Don't add the "Sign in with Google/GitHub" buttons to your frontend

The system will work perfectly fine with just email/password authentication!

---

## ✅ Pricing Page Error - FIXED!

The error was caused by undefined price values when the API fails to load. I've added null checks to prevent the crash.

**What was happening:**
```javascript
// Before (crashed if price was undefined)
return `$${price}/mo`;

// After (safe)
if (price === undefined || price === null) {
  return '$0/mo';
}
return `$${price}/mo`;
```

The page will now gracefully handle missing price data and show $0 instead of crashing.

---

## API Documentation

You mentioned `https://docs.focuswithfocal.io/` doesn't exist. Here are your options:

### Option 1: Create API Docs (Recommended)
Use tools like:
- **Swagger/OpenAPI** - Auto-generate docs from your Express routes
- **Postman** - Export collection as docs
- **Readme.io** - Professional API documentation platform

### Option 2: Simple Markdown Docs
Create a simple `/api/docs` endpoint that returns API documentation in your dashboard.

### Option 3: Skip for Now
The dashboard UI is your interface - most users won't need raw API docs.

---

## Summary: Minimal Required Environment Variables

If you want the **absolute minimum** to get email-first auth working:

```bash
# Database (already configured)
DATABASE_URL=postgresql://...

# JWT (already configured)
JWT_SECRET=your_secret_key

# Postmark Email (REQUIRED for email-first auth)
POSTMARK_API_TOKEN=your_postmark_server_api_token
POSTMARK_FROM_EMAIL=noreply@focuswithfocal.com

# App URLs (REQUIRED)
FRONTEND_URL=https://app.focuswithfocal.io
API_URL=https://api.focuswithfocal.io

# OAuth - SKIP THESE IF YOU DON'T WANT SSO!
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# GITHUB_CLIENT_ID=...
# GITHUB_CLIENT_SECRET=...
```

---

## Next Steps

1. ✅ **Postmark** - Add `POSTMARK_API_TOKEN` to `.env`
2. ✅ **Pricing page** - Already fixed
3. ⏳ **OAuth** - Decide if you want it or not
4. ⏳ **Update server.js** - Add new auth routes
5. ⏳ **Build frontend auth UI** - New signup/login flow
6. ⏳ **Add GCP/AWS provider selection** - Deployment wizard enhancement

Would you like me to proceed with:
1. Skipping OAuth (simpler)
2. Or keeping OAuth (more features)

Let me know and I'll continue with updating server.js and building the frontend!
