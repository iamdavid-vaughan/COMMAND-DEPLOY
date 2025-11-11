# Focal Deploy SaaS Server

This is the backend API server for Focal Deploy SaaS platform. It handles user authentication, credential encryption, deployment orchestration, usage tracking, and billing.

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Focal Deploy   │────────▶│   SaaS API       │────────▶│   PostgreSQL    │
│  CLI (Client)   │         │   Server         │         │   Database      │
│                 │         │                  │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │
                                    │
                                    ▼
                            ┌──────────────────┐
                            │                  │
                            │   Redis Cache    │
                            │   & Sessions     │
                            │                  │
                            └──────────────────┘
```

## Features

### Core Features
- **JWT Authentication**: Secure token-based authentication
- **AES-256-GCM Encryption**: Military-grade credential encryption
- **Just-In-Time Credentials**: Credentials decrypted only when needed
- **License Tier Management**: Basic, Professional, and Enterprise tiers
- **Usage Tracking**: Track API calls, deployments, and resource usage
- **Rate Limiting**: Protect API from abuse
- **EULA Enforcement**: Require EULA acceptance before usage

### Security Features
- **Helmet.js**: HTTP security headers
- **CORS**: Configurable cross-origin resource sharing
- **bcrypt**: Password hashing with salt
- **Rate Limiting**: Per-IP and per-user limits
- **Input Validation**: Express-validator for all inputs
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Sanitized inputs and outputs

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
cd saas-server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Generate master encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add the key to .env as MASTER_ENCRYPTION_KEY

# Initialize database (TODO: create migration script)
npm run migrate

# Start server
npm start

# Or for development with auto-reload
npm run dev
```

### Environment Configuration

See `.env.example` for all configuration options. Key variables:

```env
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/focal_deploy_saas
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
MASTER_ENCRYPTION_KEY=your-32-byte-hex-key

# Optional
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://dashboard.focal-deploy.com
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Deployments
- `GET /api/deployments` - List user's deployments
- `POST /api/deployments` - Create new deployment
- `GET /api/deployments/:id` - Get deployment details
- `PUT /api/deployments/:id` - Update deployment
- `DELETE /api/deployments/:id` - Delete deployment
- `POST /api/deployments/:id/execute` - Execute deployment

### Credentials
- `POST /api/credentials` - Store encrypted AWS credentials
- `GET /api/credentials` - Get encrypted credentials (JIT decryption)
- `PUT /api/credentials` - Update credentials
- `DELETE /api/credentials` - Delete credentials
- `POST /api/credentials/test` - Test credential validity

### Usage
- `GET /api/usage` - Get usage statistics
- `GET /api/usage/summary` - Get usage summary
- `POST /api/usage/track` - Track usage event (internal)
- `GET /api/usage/limits` - Get current limits

### Billing
- `GET /api/billing/subscription` - Get subscription details
- `POST /api/billing/upgrade` - Upgrade tier
- `POST /api/billing/downgrade` - Downgrade tier
- `GET /api/billing/invoices` - List invoices
- `POST /api/billing/payment-method` - Update payment method

### Health
- `GET /api/health` - Health check
- `GET /api/health/ping` - Simple ping

## Authentication Flow

### Registration & Login

```javascript
// 1. Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe",
  "company": "Acme Inc"
}

// Response
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "licenseTier": "basic"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}

// 2. Use token in subsequent requests
GET /api/deployments
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Credential Encryption Flow

### Storing Credentials

```javascript
// 1. Client sends AWS credentials (HTTPS only)
POST /api/credentials
Authorization: Bearer <token>
{
  "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1"
}

// 2. Server encrypts with AES-256-GCM
const encryptedData = encryption.encryptCredentials(credentials, userId);

// 3. Stored in database:
{
  "encrypted": "a3f8b2...",
  "iv": "9c7d3a...",
  "authTag": "4e5b1c...",
  "algorithm": "aes-256-gcm",
  "version": "1.0"
}
```

### Just-In-Time Retrieval

```javascript
// 1. Deployment request
POST /api/deployments/deploy-123/execute
Authorization: Bearer <token>

// 2. Server retrieves encrypted credentials
const encryptedData = await db.getCredentials(userId);

// 3. Decrypt just-in-time
const credentials = encryption.decryptCredentials(encryptedData, userId);

// 4. Use credentials for AWS operations
const ec2 = new EC2Client(credentials);

// 5. Clear from memory immediately
credentials = null;
```

## License Tiers

### Basic - $29/month
- 3 deployments per month
- 2 EC2 instances max
- 2 S3 buckets
- 2 custom domains
- Community support

### Professional - $99/month
- Unlimited deployments
- 10 EC2 instances max
- 10 S3 buckets
- 10 custom domains
- Email support (48-hour SLA)
- Team collaboration (5 members)
- Advanced security features

### Enterprise - Custom Pricing
- Unlimited everything
- Priority support (4-hour SLA)
- Unlimited team members
- White-label capabilities
- On-premises deployment
- Custom integrations
- Dedicated account manager

## Usage Tracking

The server automatically tracks:
- API calls per day/month
- Deployments per month
- Active EC2 instances
- S3 buckets created
- Custom domains configured
- Estimated AWS costs

Usage is checked against license tier limits before allowing operations.

## Security Best Practices

### For Development
1. Never commit `.env` file
2. Use `.env.example` as template
3. Rotate secrets regularly
4. Use strong JWT secrets (64+ characters)
5. Generate new encryption keys per environment

### For Production
1. Use environment variables (not `.env` file)
2. Enable HTTPS only (TLS 1.2+)
3. Set `NODE_ENV=production`
4. Use managed PostgreSQL (RDS)
5. Use managed Redis (ElastiCache)
6. Enable database encryption at rest
7. Set up automated backups
8. Monitor error logs (Sentry)
9. Implement IP whitelisting for admin endpoints
10. Use rate limiting aggressively

### Encryption Key Management
- **Master Encryption Key**: Store in environment variable, rotate annually
- **User Keys**: Derived from master key + user ID (automatic)
- **Key Rotation**: Use `reEncryptCredentials()` for seamless rotation

## Deployment

### Option 1: Railway.app (Recommended for MVP)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add postgresql

# Add Redis
railway add redis

# Deploy
railway up

# Set environment variables
railway variables set JWT_SECRET=your-secret
railway variables set MASTER_ENCRYPTION_KEY=your-key
```

### Option 2: Render.com

1. Create account at render.com
2. New > Web Service
3. Connect GitHub repo
4. Configure:
   - **Build Command**: `cd saas-server && npm install`
   - **Start Command**: `cd saas-server && npm start`
   - **Environment**: Add variables from `.env.example`
5. Add PostgreSQL database (free tier available)
6. Add Redis instance
7. Deploy

### Option 3: Self-Hosted (Use focal-deploy!)

```bash
# On your local machine
cd saas-server

# Use focal-deploy to provision server
focal-deploy new focal-saas-server

# SSH to server
focal-deploy shell focal-saas-server

# Install Node.js, PostgreSQL, Redis
# Clone repo, configure, start with PM2

pm2 start server.js --name focal-saas
pm2 startup
pm2 save
```

## Monitoring

### Health Checks

```bash
# Basic health
curl https://api.focal-deploy.com/api/health

# Response
{
  "status": "healthy",
  "uptime": 86400,
  "services": {
    "database": "operational",
    "redis": "operational",
    "encryption": "operational"
  }
}
```

### Logging

The server logs to stdout/stderr. In production, pipe to a logging service:

```bash
# Using PM2
pm2 start server.js --name focal-saas --log /var/log/focal-saas.log

# View logs
pm2 logs focal-saas

# Using Docker
docker run -d \
  --name focal-saas \
  --log-driver=syslog \
  --log-opt syslog-address=tcp://logs.example.com:514 \
  focal-deploy-saas
```

## Development

### Running Tests

```bash
npm test
```

### Database Migrations

```bash
# Create migration
npm run migration:create -- add-users-table

# Run migrations
npm run migrate

# Rollback
npm run migrate:rollback
```

### Local Development with Docker

```bash
# Start dependencies
docker-compose up -d postgres redis

# Start server
npm run dev
```

## API Client Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.focal-deploy.com',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// List deployments
const deployments = await client.get('/api/deployments');

// Create deployment
const deployment = await client.post('/api/deployments', {
  name: 'my-app',
  instanceType: 't3.small',
  region: 'us-east-1'
});
```

### cURL

```bash
# Login
curl -X POST https://api.focal-deploy.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get deployments
curl https://api.focal-deploy.com/api/deployments \
  -H "Authorization: Bearer eyJhbGc..."
```

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U focal_deploy -d focal_deploy_saas
```

### Redis Connection Failed

```bash
# Check Redis is running
redis-cli ping

# Should return: PONG
```

### JWT Token Invalid

- Check `JWT_SECRET` is set correctly
- Verify token hasn't expired
- Ensure clock synchronization between client and server

### Decryption Failed

- Verify `MASTER_ENCRYPTION_KEY` is correct
- Check encryption key hasn't been rotated without re-encrypting data
- Ensure user ID matches between encryption and decryption

## Support

- **Documentation**: https://docs.focal-deploy.com
- **Issues**: https://github.com/focal-deploy/focal-deploy/issues
- **Email**: support@focal-deploy.com
- **Enterprise**: enterprise@focal-deploy.com

---

## License

Copyright (c) 2025 Focal Deploy. All Rights Reserved.

This software is proprietary and confidential. See LICENSE file for details.
