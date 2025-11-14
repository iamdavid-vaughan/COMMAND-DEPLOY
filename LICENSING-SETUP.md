# 🔐 Focal Deploy Licensing System - Complete Setup Guide

This guide covers the complete licensing system for selling Focal Deploy as a commercial product.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [License Server Setup](#license-server-setup)
3. [Building Executables](#building-executables)
4. [Your SUPER License](#your-super-license)
5. [Creating Customer Licenses](#creating-customer-licenses)
6. [Distribution Strategy](#distribution-strategy)
7. [Pricing & Tiers](#pricing--tiers)

---

## Quick Start

### 1. Set Up License Server

```bash
cd license-server
npm install
cp .env.example .env

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" >> .env

# Start server
npm start
```

Server runs at `http://localhost:3100`

### 2. Create Your SUPER License

```bash
cd license-server
npm run generate-key
```

Select option `1` (SUPER), then insert your license into database:

```bash
sqlite3 licenses.db << 'SQL'
INSERT INTO licenses (
  license_key, email, license_type, version_limit,
  max_activations, current_activations, expires_at, is_active
) VALUES (
  'FCLDPLY-SUPER-LIFETIME-D3V3L0P3R',
  NULL,
  'SUPER',
  'LIFETIME',
  999,
  0,
  NULL,
  1
);
SQL
```

### 3. Build Executables

```bash
# Install pkg globally
npm install -g pkg

# Build for all platforms
npm run package:all
```

Creates:
- `dist/macos/focal-deploy` (Mac Intel + ARM)
- `dist/linux/focal-deploy` (Linux x64 + ARM)
- `dist/windows/focal-deploy.exe` (Windows x64)

### 4. Activate Your License

```bash
cd dist/macos  # or linux or windows
./focal-deploy activate
```

Enter:
- License Key: `FCLDPLY-SUPER-LIFETIME-D3V3L0P3R`
- Email: `anything@example.com` (doesn't matter for SUPER)

✅ Done! You now have unlimited access on that machine.

---

## License Server Setup

### Development (Local Testing)

```bash
cd license-server
npm install
npm start
```

Access at `http://localhost:3100`

### Production Deployment

#### Option 1: Railway (Recommended - Easiest)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
cd license-server
railway init
railway up
```

Railway gives you a URL like: `https://focal-deploy-license.up.railway.app`

Update client environment:
```bash
export LICENSE_SERVER=https://focal-deploy-license.up.railway.app
```

#### Option 2: DigitalOcean App Platform

1. Push `license-server/` to GitHub
2. Create new app in DigitalOcean
3. Select the repository
4. Set environment variables:
   - `PORT=3100`
   - `ENCRYPTION_KEY=<your-key>`
   - `NODE_ENV=production`

#### Option 3: AWS EC2 (Full Control)

```bash
# SSH into EC2 instance
cd /var/www
git clone <your-repo>
cd focal-deploy/license-server
npm install
pm2 start server.js --name license-server
pm2 save
```

Configure nginx reverse proxy to port 3100.

### Database Backup

```bash
# Backup database
cp licenses.db licenses-backup-$(date +%Y%m%d).db

# Restore
cp licenses-backup-YYYYMMDD.db licenses.db
```

Set up daily backups with cron:
```bash
0 2 * * * cp /path/to/licenses.db /backups/licenses-$(date +\%Y\%m\%d).db
```

---

## Building Executables

### Install pkg

```bash
npm install -g pkg
```

### Build All Platforms

```bash
npm run package:all
```

Creates executables in `dist/`:
```
dist/
├── macos/
│   ├── focal-deploy-x64      (Intel Macs)
│   └── focal-deploy-arm64    (M1/M2 Macs)
├── linux/
│   ├── focal-deploy-x64      (Intel Linux)
│   └── focal-deploy-arm64    (ARM Linux/Raspberry Pi)
└── windows/
    └── focal-deploy.exe      (Windows)
```

### Build Single Platform

```bash
# macOS only
npm run package:macos

# Linux only
npm run package:linux

# Windows only
npm run package:windows
```

### File Sizes

- **macOS**: ~55MB (includes Node.js runtime)
- **Linux**: ~50MB (includes Node.js runtime)
- **Windows**: ~52MB (includes Node.js runtime)

Users don't need Node.js installed - it's bundled!

---

## Your SUPER License

**License Key:** `FCLDPLY-SUPER-LIFETIME-D3V3L0P3R`

### Features

✅ **Any email** - works with any email address
✅ **All versions** - past, present, future forever
✅ **Unlimited machines** - install anywhere
✅ **Never expires** - lifetime access
✅ **Offline forever** - no server required after first activation

### How to Use

1. **Activate once per machine:**
   ```bash
   focal-deploy activate
   ```

2. **Enter license key:**
   ```
   FCLDPLY-SUPER-LIFETIME-D3V3L0P3R
   ```

3. **Enter any email:**
   ```
   dev@example.com
   ```

4. **Done!** License cached locally forever.

### Security

🔒 **KEEP THIS SECRET!**

- Don't commit to repositories
- Don't share publicly
- Don't give to customers
- Don't post online

Use ONLY for:
- Your development machines
- Internal testing
- Demos
- Company employees

---

## Creating Customer Licenses

### Alpha Testers (10-20 people)

```bash
cd license-server
npm run generate-key
```

Select option `2` (ALPHA):
- Email: `alpha@example.com`
- Features:
  - ✅ Lifetime access to all versions
  - ✅ 3 machines
  - ✅ Never expires
- Price: `$99 one-time`

**License Format:** `FCLDPLY-ALPHA-LIFETIME-X7K2D4M9`

### Beta Testers (50-100 people)

Select option `3` (BETA):
- Email: `beta@example.com`
- Current version: `2.x`
- Features:
  - ✅ 1 year access
  - ✅ Current major version only (2.x.x)
  - ✅ 2 machines
  - ⚠️ Upgrade discount available
- Price: `$49 one-time`

**License Format:** `FCLDPLY-BETA-2x-K9P3L7N2`

### Production Users

Select option `4` (PRO):
- Email: `customer@example.com`
- Version: `2.x`
- Features:
  - ✅ 1 year subscription
  - ✅ Specific version (2.x.x)
  - ✅ 1 machine
  - ♻️ Annual renewal required
- Price: `$99/year`

**License Format:** `FCLDPLY-PRO-2x-M4R8T1Z5`

### Bulk License Generation

For multiple customers, edit the generator script or use SQL:

```sql
-- Generate 100 PRO licenses
BEGIN TRANSACTION;

INSERT INTO licenses (license_key, email, license_type, version_limit, max_activations, expires_at)
VALUES
  ('FCLDPLY-PRO-2x-ABC123', 'customer1@example.com', 'PRO', '2.x', 1, '2026-01-01'),
  ('FCLDPLY-PRO-2x-DEF456', 'customer2@example.com', 'PRO', '2.x', 1, '2026-01-01'),
  -- ... add more ...
  ('FCLDPLY-PRO-2x-XYZ999', 'customer100@example.com', 'PRO', '2.x', 1, '2026-01-01');

COMMIT;
```

---

## Distribution Strategy

### Phase 1: Alpha Release (Now - 2 weeks)

**Goal:** Get 10-20 early supporters to test and provide feedback

1. **Build executables:**
   ```bash
   npm run package:all
   ```

2. **Create alpha licenses** (10-20 total)

3. **Distribute:**
   - Email executable + license to alpha users
   - OR host on private S3 bucket with signed URLs

4. **Support:**
   - Private Slack/Discord channel
   - Daily check-ins
   - Bug reports directly to you

**Pricing:** $99 lifetime (or free for close friends/advisors)

### Phase 2: Beta Release (2-4 weeks)

**Goal:** Get 50-100 beta testers for wider testing

1. **Create landing page:**
   - Features list
   - Beta program details
   - Email signup form

2. **Create beta licenses** (50-100 total)

3. **Distribute:**
   - Download link on website
   - License key sent via email

4. **Support:**
   - Email support
   - Public Discord/Slack
   - GitHub issues

**Pricing:** $49 one-time with 50% off next version

### Phase 3: Production Launch (Week 6+)

**Goal:** Public launch, unlimited customers

1. **Create website:**
   - Product tour
   - Pricing page
   - Documentation
   - Purchase flow

2. **Payment integration:**
   - Stripe/Paddle for payments
   - Automatic license generation
   - Email delivery

3. **Support:**
   - Help docs
   - Email support
   - Community forum

**Pricing:** $99/year per machine

---

## Pricing & Tiers

### Recommended Pricing

| Tier | Price | Renewal | Machines | Versions |
|------|-------|---------|----------|----------|
| **ALPHA** | $99 | Lifetime | 3 | All (up to v3) |
| **BETA** | $49 | 1 year | 2 | Current major |
| **PRO** | $99 | Annual | 1 | Current major |
| **TEAM** | $299 | Annual | 5 | Current major |
| **ENTERPRISE** | Custom | Annual | Unlimited | All |

### Revenue Projections

**Conservative (Year 1):**
- 20 Alpha: $99 × 20 = $1,980
- 100 Beta: $49 × 100 = $4,900
- 200 Pro: $99 × 200 = $19,800
- **Total:** $26,680

**Moderate (Year 1):**
- 20 Alpha: $1,980
- 100 Beta: $4,900
- 500 Pro: $99 × 500 = $49,500
- **Total:** $56,380

**Aggressive (Year 1):**
- 20 Alpha: $1,980
- 200 Beta: $9,800
- 1,000 Pro: $99,000
- **Total:** $110,780

### Payment Integration

Use **Paddle** or **Stripe** for payment processing:

```javascript
// Webhook handler (after payment)
app.post('/webhook/payment', async (req, res) => {
  const { email, amount, product } = req.body;

  // Generate license
  const licenseKey = generateLicenseKey('PRO', '2.x');

  // Save to database
  await db.run(`
    INSERT INTO licenses (license_key, email, license_type, version_limit, max_activations, expires_at)
    VALUES (?, ?, 'PRO', '2.x', 1, date('now', '+1 year'))
  `, [licenseKey, email]);

  // Email customer
  await sendEmail(email, {
    subject: 'Your Focal Deploy License',
    body: `License Key: ${licenseKey}`
  });
});
```

---

## Next Steps

1. ✅ **Test license server locally**
2. ✅ **Build executables for all platforms**
3. ✅ **Activate your SUPER license**
4. ✅ **Create 5-10 alpha licenses**
5. ⬜ **Deploy license server to production**
6. ⬜ **Create landing page**
7. ⬜ **Email alpha testers**
8. ⬜ **Collect feedback**
9. ⬜ **Launch beta program**
10. ⬜ **Public launch!**

---

## Support

**License Issues:**
- Check license server logs
- Verify email matches
- Confirm version compatibility
- Check activation limits

**Build Issues:**
- Ensure pkg is installed globally
- Check Node.js version (18+)
- Verify all dependencies installed

**Questions?**
- Email: support@focal-deploy.com
- Docs: https://docs.focal-deploy.com
