# Email-First Authentication System

## Overview

This document describes the new email-first authentication system for Focal Deploy, which replaces the traditional signup-with-password flow with a more secure email verification approach, plus OAuth support for Google and GitHub.

## Key Features

- **Email-first registration**: Users provide only email, name, and optional company during signup
- **Email verification required**: Users must verify email before setting password
- **Token expiration**:
  - Email verification: 24 hours
  - Password reset: 4 hours
- **OAuth integration**: Google and GitHub SSO
- **Auto-cleanup**: Incomplete accounts deleted after 5 days
- **Security**: Prevents spam/fraud by requiring email verification before account activation

## Database Schema

### New Tables

**email_verification_tokens**
- `id` (UUID): Primary key
- `user_id` (UUID): References users table
- `token` (VARCHAR 255): Unique verification token
- `expires_at` (TIMESTAMP): 24 hours from creation
- `used_at` (TIMESTAMP): When token was used (NULL if unused)
- `created_at` (TIMESTAMP): Creation timestamp

**password_reset_tokens**
- `id` (UUID): Primary key
- `user_id` (UUID): References users table
- `token` (VARCHAR 255): Unique reset token
- `expires_at` (TIMESTAMP): 4 hours from creation
- `used_at` (TIMESTAMP): When token was used (NULL if unused)
- `created_at` (TIMESTAMP): Creation timestamp

### Updated Users Table

New columns added:
- `email_verified` (BOOLEAN): Whether email has been verified
- `is_active` (BOOLEAN): Account is fully active (email verified + password set)
- `oauth_provider` (VARCHAR 20): 'google', 'github', or NULL
- `oauth_id` (VARCHAR 255): Unique ID from OAuth provider
- `company` (VARCHAR 255): Optional company name
- `password_hash` now nullable (for OAuth users)

## Authentication Flow

### 1. Email-First Registration

**Endpoint**: `POST /api/auth/register`

**Request**:
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "company": "Acme Inc" // optional
}
```

**Response**:
```json
{
  "success": true,
  "message": "Registration successful! Please check your email to verify your account and set your password.",
  "requiresVerification": true,
  "email": "user@example.com"
}
```

**Process**:
1. User provides email, name, and optional company
2. System creates user with `email_verified=false`, `is_active=false`
3. Generates 24-hour verification token
4. Sends verification email with link to set password
5. User has 24 hours to complete verification

### 2. Email Verification & Password Setup

**Endpoint**: `POST /api/auth/verify-email`

**Request**:
```json
{
  "token": "abc123...",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Email verified successfully! Welcome to Focal Deploy.",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "licenseTier": "starter"
  },
  "token": "jwt_token_here",
  "expiresIn": "7d"
}
```

**Process**:
1. Validates token (must be unused and not expired)
2. Sets user password
3. Marks `email_verified=true`, `is_active=true`, `status='active'`
4. Marks token as used
5. Sends welcome email
6. Returns JWT token for automatic login

### 3. Login

**Endpoint**: `POST /api/auth/login`

**Request**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "name": "John Doe",
    "licenseTier": "starter"
  },
  "token": "jwt_token_here",
  "expiresIn": "7d"
}
```

**Additional checks**:
- Email must be verified (`email_verified=true`)
- Account must be active (`is_active=true`)
- OAuth users cannot login with password (redirected to OAuth)

### 4. Password Reset

**Step 1: Request Reset**

**Endpoint**: `POST /api/auth/forgot-password`

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response** (always successful to prevent email enumeration):
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

**Process**:
1. Finds user by email
2. Generates 4-hour reset token
3. Sends password reset email
4. User has 4 hours to reset password

**Step 2: Reset Password**

**Endpoint**: `POST /api/auth/reset-password`

**Request**:
```json
{
  "token": "xyz789...",
  "password": "NewSecurePass123!"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Password reset successful. You can now log in with your new password."
}
```

### 5. OAuth Authentication

#### Google OAuth

**Start OAuth Flow**: `GET /api/oauth/google`
- Redirects user to Google consent screen

**Callback**: `GET /api/oauth/google/callback?code=...`
- Exchanges code for access token
- Fetches user info from Google
- Creates or links account
- Redirects to frontend with JWT token

#### GitHub OAuth

**Start OAuth Flow**: `GET /api/oauth/github`
- Redirects user to GitHub authorization

**Callback**: `GET /api/oauth/github/callback?code=...`
- Exchanges code for access token
- Fetches user info from GitHub
- Creates or links account
- Redirects to frontend with JWT token

**OAuth User Creation**:
- `email_verified=true` (OAuth providers verify emails)
- `is_active=true`
- `password_hash=NULL` (OAuth users don't need passwords)
- `oauth_provider='google'` or `'github'`
- `oauth_id='...'` (provider's unique ID)

## Account Cleanup

### Automatic Cleanup Cron Job

**Schedule**: Daily at 2:00 AM

**Cleanup Actions**:
1. **Delete incomplete accounts** (older than 5 days):
   - Email not verified OR account not active
   - Not OAuth users (OAuth users are auto-verified)
   - Created more than 5 days ago

2. **Delete expired tokens**:
   - Email verification tokens expired (>24 hours)
   - Password reset tokens expired (>4 hours)

**Manual trigger**:
```javascript
const { runCleanup } = require('./services/accountCleanupService');
await runCleanup();
```

## Environment Variables

Add to `.env`:

```bash
# Email Service (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@focuswithfocal.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM="Focal Deploy" <noreply@focuswithfocal.com>

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Application URLs
FRONTEND_URL=https://focuswithfocal.com
API_URL=https://api.focuswithfocal.com
```

## Frontend Routes Needed

### Pages to Create/Update:

1. **Signup Page** (`/signup`):
   - Email, name, company fields only (NO password)
   - Submit → Show "Check your email" message

2. **Verify Email Page** (`/verify-email?token=...`):
   - Password input field
   - Submit → Verify email + set password + login

3. **OAuth Callback Page** (`/oauth-callback?token=...&provider=...`):
   - Receives JWT token from OAuth
   - Stores token and redirects to dashboard

4. **Login Page** (`/login`):
   - Email + password fields
   - "Sign in with Google" button
   - "Sign in with GitHub" button
   - Link to "Forgot password"

5. **Forgot Password Page** (`/forgot-password`):
   - Email input
   - Submit → Show "Check your email" message

6. **Reset Password Page** (`/reset-password?token=...`):
   - New password input
   - Submit → Password reset + redirect to login

## Security Features

1. **Token-based verification**: Prevents account creation without email access
2. **Expiring tokens**: 24hr for verification, 4hr for password reset
3. **Email enumeration protection**: Always return success for forgot-password requests
4. **OAuth security**: Verified emails from trusted providers (Google, GitHub)
5. **Account cleanup**: Automatic deletion of incomplete/abandoned accounts
6. **Password requirements**: Minimum 8 characters, uppercase, lowercase, number
7. **One-time tokens**: Tokens marked as used after verification/reset

## Migration Steps

1. **Run database migration**:
   ```bash
   sudo -u postgres psql focal_deploy_saas < ADD_EMAIL_FIRST_AUTH.sql
   ```

2. **Install npm dependencies**:
   ```bash
   cd saas-server && npm install
   ```

3. **Update environment variables** (add OAuth credentials and SMTP settings)

4. **Replace auth routes in server.js**:
   ```javascript
   // Old: app.use('/api/auth', require('./routes/auth'));
   // New:
   app.use('/api/auth', require('./routes/authNew'));
   app.use('/api/oauth', require('./routes/oauth'));
   ```

5. **Initialize cleanup cron job in server.js**:
   ```javascript
   const { initializeCleanupCron } = require('./services/accountCleanupService');
   initializeCleanupCron();
   ```

6. **Restart server**

## API Response Examples

### Verification Email Sent
```json
{
  "success": true,
  "message": "Registration successful! Please check your email...",
  "requiresVerification": true,
  "email": "user@example.com"
}
```

### Email Not Verified
```json
{
  "error": "Email not verified",
  "message": "Please verify your email before logging in...",
  "requiresVerification": true
}
```

### Invalid Token
```json
{
  "error": "Invalid Token",
  "message": "Email verification token is invalid or has expired..."
}
```

### OAuth Account Using Password Login
```json
{
  "error": "Authentication failed",
  "message": "This account uses OAuth. Please log in with Google or GitHub."
}
```

## Testing Checklist

- [ ] Email-first registration works
- [ ] Verification email is sent and received
- [ ] Email verification + password setup works
- [ ] Login with verified account works
- [ ] Login with unverified account is blocked
- [ ] Password reset request works
- [ ] Password reset with token works
- [ ] Google OAuth signup works
- [ ] Google OAuth login (existing user) works
- [ ] GitHub OAuth signup works
- [ ] GitHub OAuth login (existing user) works
- [ ] Cleanup cron job runs and deletes old accounts
- [ ] Expired tokens are cleaned up
- [ ] Password requirements are enforced
- [ ] Token expiration is enforced (24hr and 4hr)

## Support

For questions or issues, contact support@focuswithfocal.com
