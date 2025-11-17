# Focal Deploy Domain Strategy

**Entity**: DNS Publishing, LLC
**Domains**: focuswithfocal.com, focuswithfocal.io
**Last Updated**: November 11, 2025

---

## 🌐 Domain Architecture

### Overview

Focal Deploy uses a **dual-domain strategy** following SaaS industry best practices:

- **focuswithfocal.com** → Marketing, corporate, public-facing content
- **focuswithfocal.io** → SaaS application, API, developer tools

This separation provides:
- ✅ Clear distinction between marketing and product
- ✅ Better security (isolate app from marketing site vulnerabilities)
- ✅ Improved performance (separate CDN/caching strategies)
- ✅ Professional appearance (.io is standard for dev tools)
- ✅ Flexible scaling (different infrastructure per domain)

---

## 📋 Domain Mapping

### focuswithfocal.com (Marketing & Corporate)

**Primary Use**: Public-facing marketing website and corporate resources

#### Subdomains & Services

| Subdomain | Purpose | Example |
|-----------|---------|---------|
| `www.focuswithfocal.com` | Main marketing website | Product info, pricing, features |
| `blog.focuswithfocal.com` | Blog and content marketing | Tutorials, guides, SEO content |
| `docs.focuswithfocal.com` | Public documentation | Getting started, API docs, guides |
| `help.focuswithfocal.com` | Help center/Support portal | FAQs, troubleshooting, knowledge base |
| `legal.focuswithfocal.com` | Legal documents | Terms, privacy, EULA, compliance |
| _(root domain)_ | Main website | Redirects to www |

#### Email Addresses

| Email | Purpose |
|-------|---------|
| `support@focuswithfocal.com` | Customer support |
| `sales@focuswithfocal.com` | Sales inquiries |
| `legal@focuswithfocal.com` | Legal questions, contracts |
| `licensing@focuswithfocal.com` | License inquiries |
| `enterprise@focuswithfocal.com` | Enterprise sales |
| `billing@focuswithfocal.com` | Billing questions |
| `hello@focuswithfocal.com` | General inquiries |
| `noreply@focuswithfocal.com` | Automated emails |

#### Content Strategy

**Marketing Pages**:
- Homepage (product pitch)
- Pricing page
- Features & benefits
- Use cases
- Customer testimonials
- About us / Team
- Contact us

**Content Marketing**:
- Blog posts (SEO)
- Case studies
- Whitepapers
- Webinars
- Video tutorials

**Support & Docs**:
- Getting started guide
- Documentation
- API reference
- Video tutorials
- Changelog
- Status page (or status.focuswithfocal.com)

---

### focuswithfocal.io (SaaS Application)

**Primary Use**: SaaS product, API, and developer tools

#### Subdomains & Services

| Subdomain | Purpose | Tech Stack | Example |
|-----------|---------|------------|---------|
| `app.focuswithfocal.io` | Customer dashboard | React/Vue | Login, deployments, settings |
| `api.focuswithfocal.io` | REST API server | Node.js/Express | JWT auth, deployment endpoints |
| `developers.focuswithfocal.io` | Developer portal | Static site | API docs, SDKs, code samples |
| `status.focuswithfocal.io` | Status page | StatusPage.io | Uptime, incidents |
| `webhooks.focuswithfocal.io` | Webhook endpoints | Node.js | Event notifications |
| `cdn.focuswithfocal.io` | Static assets CDN | CloudFront | JS, CSS, images |
| _(root domain)_ | App or redirect | - | Redirects to app.focuswithfocal.io |

#### Application Architecture

```
┌─────────────────────────────────────────┐
│       focuswithfocal.io Domain          │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
  ┌──────────┐ ┌────────┐ ┌──────────┐
  │   app.   │ │  api.  │ │ status.  │
  │          │ │        │ │          │
  │ Customer │ │  API   │ │  Uptime  │
  │Dashboard │ │ Server │ │   Page   │
  └──────────┘ └────────┘ └──────────┘
       │            │
       │            │
       ▼            ▼
  React/Vue    Express.js
  Frontend      Backend
                   │
                   ├─> PostgreSQL
                   ├─> Redis
                   └─> AWS SDK
```

#### API Endpoints

**Base URL**: `https://api.focuswithfocal.io`

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (JWT)
- `GET /api/deployments` - List deployments
- `POST /api/deployments` - Create deployment
- `GET /api/credentials` - Get encrypted credentials (JIT)
- `POST /api/credentials` - Store credentials (encrypted)
- `GET /api/usage` - Usage statistics
- `GET /api/billing/subscription` - Subscription info

---

## 🔐 SSL/TLS Certificates

### Certificate Strategy

**focuswithfocal.com**:
- Primary certificate: `*.focuswithfocal.com` (wildcard)
- Covers: www, blog, docs, help, legal, etc.
- Provider: Let's Encrypt (auto-renew)
- Validation: DNS-01 challenge (DigitalOcean DNS)

**focuswithfocal.io**:
- Primary certificate: `*.focuswithfocal.io` (wildcard)
- Covers: app, api, developers, status, webhooks, cdn
- Provider: Let's Encrypt (auto-renew)
- Validation: DNS-01 challenge (DigitalOcean DNS)

---

## 🚀 Deployment Infrastructure

### focuswithfocal.com Hosting

**Recommended Stack**:
- **Hosting**: Vercel or Netlify (marketing site)
- **CMS**: Sanity.io or ContentfulJS (blog/content)
- **Forms**: Formspree or Netlify Forms (contact forms)
- **Analytics**: Plausible or Google Analytics
- **CDN**: Built-in (Vercel/Netlify)

**Alternative** (Self-Hosted):
- **Server**: AWS S3 + CloudFront (static site)
- **Generator**: Next.js or Astro (static generation)
- **Deployment**: GitHub Actions → S3

**Cost**: $0-20/month (Vercel/Netlify free tier sufficient for MVP)

### focuswithfocal.io Hosting

**Recommended Stack** (MVP):
- **Server**: AWS EC2 t3.medium ($34/month)
- **App**: React/Vue SPA on S3 + CloudFront
- **API**: Node.js/Express on EC2
- **Database**: PostgreSQL on EC2 (or RDS for production)
- **Cache**: Redis on EC2 (or ElastiCache)
- **Deployment**: Using focal-deploy itself! 🎯

**Alternative Stack** (Managed):
- **Server**: Railway.app or Render.com
- **Database**: Managed PostgreSQL (Railway/Render)
- **Redis**: Managed Redis (Railway/Render)
- **Cost**: $20-50/month

**Production Stack** (Scale):
- **Load Balancer**: AWS ALB
- **API Servers**: Multiple EC2 instances (auto-scaling)
- **Database**: RDS PostgreSQL (Multi-AZ)
- **Cache**: ElastiCache Redis (cluster)
- **CDN**: CloudFront (global)
- **Cost**: $150-300/month

---

## 📊 DNS Configuration

### DigitalOcean DNS Records

**focuswithfocal.com Zone**:

```
Type    Name        Value                           TTL
A       @           [Vercel/Netlify IP]             3600
CNAME   www         @                               3600
CNAME   blog        [Vercel/Netlify]                3600
CNAME   docs        [Vercel/Netlify]                3600
CNAME   help        [Vercel/Netlify]                3600
CNAME   legal       [Vercel/Netlify]                3600
MX      @           [Email provider MX records]     3600
TXT     @           [SPF, DKIM records]             3600
```

**focuswithfocal.io Zone**:

```
Type    Name        Value                           TTL
A       @           [Redirect to app]               3600
A       app         [EC2 Elastic IP or ALB]         3600
A       api         [EC2 Elastic IP or ALB]         3600
CNAME   developers  [Static site CDN]               3600
CNAME   status      [StatusPage.io]                 3600
CNAME   cdn         [CloudFront distribution]       3600
TXT     @           [SPF, verification]             3600
```

---

## 📧 Email Configuration

### Email Service Provider

**Recommended**: SendGrid, Mailgun, or AWS SES

**Email Types**:

1. **Transactional** (via SendGrid/SES):
   - Welcome emails
   - Password reset
   - Deployment notifications
   - Billing invoices
   - Usage alerts

2. **Marketing** (via Mailchimp/ConvertKit):
   - Newsletter
   - Product updates
   - Feature announcements

3. **Support** (via Front or Help Scout):
   - Support tickets
   - Customer communication

**Sender Addresses**:
- `noreply@focuswithfocal.com` - Automated emails
- `hello@focuswithfocal.com` - General inquiries
- `support@focuswithfocal.com` - Support (help desk)

---

## 🔒 Security Considerations

### Domain Security

1. **DNSSEC**: Enable on both domains (DigitalOcean supports this)
2. **CAA Records**: Restrict certificate authorities
   ```
   focuswithfocal.com. CAA 0 issue "letsencrypt.org"
   focuswithfocal.io. CAA 0 issue "letsencrypt.org"
   ```
3. **HSTS**: Enable HTTP Strict Transport Security headers
4. **CSP**: Content Security Policy headers on both domains

### API Security

- **CORS**: Allow only `app.focuswithfocal.io` to access `api.focuswithfocal.io`
- **Rate Limiting**: Aggressive limits on public API endpoints
- **JWT**: Secure token storage, short expiry (7 days)
- **Encryption**: All credentials encrypted with AES-256-GCM

---

## 🎯 Migration Plan (If Changing Domains Later)

If you ever need to change domains:

1. **Set up new domain** with identical infrastructure
2. **301 Redirects** from old → new (keep for 12 months)
3. **Update DNS** gradually (lower TTLs first)
4. **Email forwarding** from old → new addresses
5. **Update all docs/links** to new domain
6. **Notify customers** 30 days in advance

---

## 📈 Monitoring & Analytics

### Website Analytics (focuswithfocal.com)

- **Tool**: Plausible Analytics or Google Analytics
- **Track**: Page views, conversions, signup flow
- **Goals**: Free trial signups, contact form submissions

### Application Metrics (focuswithfocal.io)

- **Tool**: Datadog or New Relic
- **Track**: API response times, error rates, uptime
- **Alerts**:
  - API latency > 500ms
  - Error rate > 1%
  - Database connections > 80%

### Uptime Monitoring

- **Tool**: StatusPage.io or UptimeRobot
- **Monitor**:
  - `app.focuswithfocal.io` - Every 1 minute
  - `api.focuswithfocal.io/health` - Every 1 minute
- **Notifications**: Email, Slack, PagerDuty

---

## 💰 Cost Summary

| Service | Provider | Cost/Month |
|---------|----------|-----------|
| Marketing Site | Vercel/Netlify | $0-20 |
| SaaS Server | EC2 t3.medium | $34 |
| Database | PostgreSQL (EC2) | included |
| Redis | Redis (EC2) | included |
| DNS | DigitalOcean | $0 |
| SSL Certificates | Let's Encrypt | $0 |
| Email | SendGrid (free tier) | $0-15 |
| Status Page | StatusPage.io | $29 |
| Analytics | Plausible | $9 |
| **Total (MVP)** | | **$72-107/month** |

**Production Scale** (~500 users):
- ALB + Multi-AZ RDS + ElastiCache: ~$200-300/month

---

## 🚀 Next Steps

### Immediate (This Week)

1. ✅ Update all code references to use correct domains
2. ⬜ Purchase/configure domains on DigitalOcean DNS
3. ⬜ Set up SSL certificates (Let's Encrypt wildcard)
4. ⬜ Deploy marketing site to focuswithfocal.com
5. ⬜ Deploy API server to api.focuswithfocal.io

### Next Month

6. ⬜ Build customer dashboard → app.focuswithfocal.io
7. ⬜ Set up status page → status.focuswithfocal.io
8. ⬜ Configure email service (SendGrid)
9. ⬜ Set up monitoring (Datadog/Plausible)
10. ⬜ Launch beta! 🎉

---

## 📞 Contact

**DNS Publishing, LLC**
- Website: https://focuswithfocal.com
- Support: support@focuswithfocal.com
- Sales: sales@focuswithfocal.com

---

**Last Updated**: November 11, 2025
**Document Version**: 1.0
