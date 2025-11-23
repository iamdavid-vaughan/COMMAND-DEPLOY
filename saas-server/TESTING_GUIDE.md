# Testing Guide for Recent Changes

This guide covers testing the logging updates and dependency upgrades.

## Changes Made

1. **Console.log Replacement**: All `console.log/error/warn` calls replaced with Winston structured logging
2. **Dependency Updates**:
   - AWS SDK packages updated to v3.935.0
   - axios updated to v1.13.2 (security fix)
   - express-validator updated to v7.3.1
   - nodemailer removed (unused)
3. **Security Fixes**: All vulnerabilities resolved (0 vulnerabilities)

## Testing Checklist

### ✅ Pre-Testing Setup

1. **Environment Configuration**
   ```bash
   # Ensure .env file exists
   cp .env.example .env

   # Edit .env and set at minimum:
   # - DATABASE_URL (PostgreSQL connection)
   # - JWT_SECRET
   # - MASTER_ENCRYPTION_KEY
   ```

2. **Database Setup**
   ```bash
   # Ensure PostgreSQL is running
   # Run migrations if needed
   npm run migrate
   ```

### ✅ Test 1: Server Startup (CRITICAL)

**Purpose**: Verify the server starts without errors after dependency updates

```bash
npm start
```

**Expected Results**:
- ✅ No errors during startup
- ✅ Logs appear in Winston format (structured JSON or formatted text)
- ✅ Database connection message appears: `Database: Connection established successfully`
- ✅ Redis connection message appears (if Redis is running)
- ✅ Server listens on configured port (default: 3000)

**What to Look For**:
- NO `console.log` messages with emoji prefixes (✅, ❌, 💳, etc.)
- ONLY Winston-formatted logs with proper structure

---

### ✅ Test 2: Logging Format Verification

**Purpose**: Verify structured logging is working correctly

```bash
# In another terminal, run the test script
./test-endpoints.sh
```

**Expected Results**:
- ✅ All endpoints return appropriate responses
- ✅ Server logs show structured format with:
  - Component prefixes (Auth:, Database:, Redis:, etc.)
  - Metadata objects when relevant
  - Proper log levels (info, warn, error)

**Example Good Log**:
```
info: Auth: User registered, verification email sent { email: 'test@example.com' }
```

**Example Bad Log** (shouldn't see these):
```
✅ [AUTH] User registered: test@example.com
```

---

### ✅ Test 3: Core Functionality Tests

**3.1 Authentication Flow**
```bash
# Register a new user (replace with your actual endpoint)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

**Expected**:
- Returns 200/201 or appropriate error
- Logs show: `Auth: User registered, verification email sent`

**3.2 Caching Test**
```bash
# Hit cached endpoints twice
curl http://localhost:3000/api/pricing
curl http://localhost:3000/api/pricing
```

**Expected**:
- First request: Cache miss (Redis GET returns null)
- Second request: Cache hit (served from Redis)
- Check logs for cache hit/miss messages

**3.3 AWS SDK Test** (if applicable)
```bash
# Test any endpoint that uses AWS (deployments, credentials, etc.)
# This verifies the updated AWS SDK packages work correctly
```

**Expected**:
- No errors related to AWS SDK
- EC2/S3 operations work as before

---

### ✅ Test 4: Error Handling

**Purpose**: Verify errors are logged correctly with stack traces

```bash
# Trigger an error (invalid credentials)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"wrong"}'
```

**Expected**:
- Error is logged with Winston
- Log includes `error: error.message` and `stack: error.stack` metadata
- No console.error output

---

### ✅ Test 5: Production Environment Check

**Purpose**: Verify logging works correctly in production mode

```bash
# Set NODE_ENV to production
NODE_ENV=production npm start
```

**Expected**:
- Logs are more concise (no debug messages)
- Sequelize query logging is disabled
- Server runs without issues

---

## Common Issues & Solutions

### Issue: "Database not initialized" error
**Solution**: Check your DATABASE_URL in .env file and ensure PostgreSQL is running

### Issue: Redis connection errors
**Solution**:
- Either start Redis (`redis-server`)
- Or the app should continue without Redis (check logs for warning)

### Issue: "MASTER_ENCRYPTION_KEY not set" error
**Solution**: Generate a key and add to .env:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue: Port already in use
**Solution**: Change PORT in .env or kill the process using port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## Performance Verification

After updates, check that performance hasn't degraded:

1. **Startup Time**: Should be roughly the same
2. **Response Times**: Use the test script and check response times
3. **Memory Usage**: Monitor with `top` or `htop`

---

## Sign-Off Checklist

Before considering testing complete:

- [ ] Server starts without errors
- [ ] All console.log calls replaced with Winston logs
- [ ] No security vulnerabilities (`npm audit` shows 0)
- [ ] Core endpoints respond correctly
- [ ] Error logging includes stack traces
- [ ] Cached endpoints return from cache on second request
- [ ] No regressions in existing functionality

---

## Quick Test Command

For a quick smoke test:

```bash
# Start server in one terminal
npm start

# Run test script in another terminal
./test-endpoints.sh

# Check logs for Winston-formatted output
# CTRL+C to stop server when satisfied
```

## Need Help?

If you encounter issues:
1. Check the server logs for error details
2. Verify all environment variables are set
3. Ensure database and Redis are accessible
4. Check that updated packages are properly installed (`npm ls`)
