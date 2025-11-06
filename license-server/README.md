# Focal Deploy License Server

Complete licensing system for Focal Deploy with activation, validation, and version control.

## Quick Start

### 1. Install Dependencies

```bash
cd license-server
npm install
```

### 2. Start Server

```bash
npm start
```

Server will run on `http://localhost:3100`

### 3. Generate Your SUPER License

```bash
npm run generate-key
```

Select option `1` (SUPER) to create your unlimited license.

## License Types

### SUPER (Your Personal License)
- **Email**: None required (works with ANY email)
- **Versions**: ALL (lifetime)
- **Machines**: Unlimited (999)
- **Expires**: NEVER
- **Use case**: Your personal development license

### ALPHA (Early Supporters)
- **Email**: Locked to specific email
- **Versions**: All versions up to v3.0.0
- **Machines**: 3
- **Expires**: NEVER (lifetime)
- **Price**: $99 one-time (suggested)

### BETA (Beta Testers)
- **Email**: Locked to specific email
- **Versions**: Current major version only (e.g., 2.x.x)
- **Machines**: 2
- **Expires**: 1 year OR next major version
- **Price**: $49 one-time with 50% discount for next version

### PRO (Production Users)
- **Email**: Locked to specific email
- **Versions**: Specific version (e.g., 2.x.x)
- **Machines**: 1
- **Expires**: 1 year (annual renewal)
- **Price**: $99/year (suggested)

## API Endpoints

### POST /api/v1/validate

Validate a license key.

**Request:**
```json
{
  "license_key": "FCLDPLY-SUPER-LIFETIME-A3F9",
  "email": "user@example.com",
  "version": "2.1.0",
  "machine_id": "abc123def456"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "license_type": "SUPER",
  "version_limit": "LIFETIME",
  "validation_token": "encrypted_token_here"
}
```

**Response (Failure):**
```json
{
  "valid": false,
  "reason": "License key not found"
}
```

### POST /api/v1/activate

Activate a license before first use.

**Request:**
```json
{
  "license_key": "FCLDPLY-ALPHA-LIFETIME-X7K2",
  "email": "alpha@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "License activated successfully",
  "license_type": "ALPHA",
  "version_limit": "LIFETIME",
  "max_activations": 3
}
```

### GET /api/v1/health

Health check endpoint.

## Generating Licenses

### Interactive Generator

```bash
npm run generate-key
```

Prompts you for license type and details.

### Manual Database Insert

```sql
INSERT INTO licenses (
  license_key,
  email,
  license_type,
  version_limit,
  max_activations,
  expires_at
) VALUES (
  'FCLDPLY-PRO-2x-ABC123',
  'customer@example.com',
  'PRO',
  '2.x',
  1,
  '2026-01-01'
);
```

## Database Schema

### licenses
- `id`: Auto-increment primary key
- `license_key`: Unique license key (FCLDPLY-TYPE-VERSION-HASH)
- `email`: User email (NULL for SUPER licenses)
- `license_type`: SUPER, ALPHA, BETA, or PRO
- `version_limit`: Version restriction (e.g., "2.x", "LIFETIME")
- `max_activations`: Maximum number of machines
- `current_activations`: Currently activated machines
- `created_at`: Creation timestamp
- `expires_at`: Expiration date (NULL for lifetime)
- `is_active`: 1 = active, 0 = deactivated

### activations
- `id`: Auto-increment primary key
- `license_key`: Foreign key to licenses
- `email`: User email
- `machine_id`: Unique machine identifier
- `activated_at`: First activation timestamp
- `last_validated`: Last validation timestamp

### validation_log
- `id`: Auto-increment primary key
- `license_key`: License key used
- `email`: Email used
- `version`: App version
- `success`: 1 = valid, 0 = invalid
- `reason`: Validation result reason
- `timestamp`: Log timestamp

## Client Integration

### Activate License (User Side)

```bash
focal-deploy activate
```

Prompts for:
1. License key
2. Email address

Validates with server and caches locally.

### Check License

```bash
focal-deploy license
```

Shows current license information.

### Deactivate License

```bash
focal-deploy deactivate
```

Removes license from current machine.

## Validation Logic

1. **First run**: User activates with `focal-deploy activate`
2. **Local cache**: License validated locally for 24 hours
3. **Online check**: Every 24 hours, app contacts server to revalidate
4. **Offline grace**: If no internet, app works for 7 days
5. **Expiration**: After 7 days offline, user must connect to validate

## Security Features

- ✅ Encrypted validation tokens
- ✅ Rate limiting (10 requests per minute per IP)
- ✅ Machine ID binding
- ✅ Email binding (except SUPER)
- ✅ Version locking
- ✅ Activation limits
- ✅ Expiration dates
- ✅ Audit logging

## Deployment

### Deploy to Production

1. **Choose hosting**: Railway, Heroku, DigitalOcean, AWS
2. **Set environment**:
   ```bash
   PORT=3100
   ENCRYPTION_KEY=your-random-32-byte-key
   NODE_ENV=production
   ```
3. **Deploy**
4. **Update client**: Set `LICENSE_SERVER` env variable

### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Deploy
railway up
```

## Pricing Suggestions

| License Type | Price | Renewal | Market |
|--------------|-------|---------|--------|
| SUPER | FREE | Never | You only |
| ALPHA | $99 | Lifetime | 10-20 early supporters |
| BETA | $49 | 1 year | 50-100 beta testers |
| PRO | $99/year | Annual | Unlimited |

## Maintenance

### View All Licenses

```bash
sqlite3 licenses.db "SELECT * FROM licenses;"
```

### Deactivate License

```bash
sqlite3 licenses.db "UPDATE licenses SET is_active = 0 WHERE license_key = 'FCLDPLY-xxx';"
```

### View Validation Logs

```bash
sqlite3 licenses.db "SELECT * FROM validation_log ORDER BY timestamp DESC LIMIT 50;"
```

### Check Activations

```bash
sqlite3 licenses.db "SELECT l.license_key, l.email, l.current_activations, l.max_activations, COUNT(a.id) as active_machines FROM licenses l LEFT JOIN activations a ON l.license_key = a.license_key GROUP BY l.license_key;"
```

## Support

For license issues:
1. Check validation logs
2. Verify email matches
3. Confirm version compatibility
4. Check activation limits
5. Contact support@focal-deploy.com

## License Key Format

```
FCLDPLY-[TYPE]-[VERSION]-[HASH]

Examples:
FCLDPLY-SUPER-LIFETIME-A3F9K2X7
FCLDPLY-ALPHA-LIFETIME-X7B2D4M9
FCLDPLY-BETA-2x-K9P3L7N2
FCLDPLY-PRO-2x-M4R8T1Z5
```
