# 🌐 Focal Deploy Domain Recommendations

**For**: DNS Publishing, LLC
**Date**: November 11, 2025

---

## Quick Answer: What Should Each Domain Be Used For?

### focuswithfocal.com - **Marketing & Corporate** 🏢

Use this for everything public-facing and customer-acquisition:

✅ **Main website** (www.focuswithfocal.com)
- Product information
- Pricing page
- Features and benefits
- Customer testimonials
- About/Team page

✅ **Content & SEO** (blog.focuswithfocal.com)
- Blog posts
- Tutorials and guides
- Case studies
- Video content

✅ **Documentation** (docs.focuswithfocal.com)
- Getting started
- User guides
- FAQ

✅ **Support** (help.focuswithfocal.com)
- Help center
- Knowledge base
- Contact forms

✅ **Legal** (legal.focuswithfocal.com)
- Terms of service
- Privacy policy
- EULA

✅ **Email**
- support@focuswithfocal.com
- sales@focuswithfocal.com
- legal@focuswithfocal.com
- enterprise@focuswithfocal.com
- billing@focuswithfocal.com
- hello@focuswithfocal.com

---

### focuswithfocal.io - **SaaS Application** 💻

Use this for the actual product that customers log into:

✅ **Customer Dashboard** (app.focuswithfocal.io)
- User login/signup
- Deployment management
- Settings and account
- Usage analytics
- Billing portal

✅ **API Server** (api.focuswithfocal.io)
- REST API for CLI
- Authentication endpoints
- Deployment operations
- Credential management

✅ **Developer Portal** (developers.focuswithfocal.io)
- API documentation
- Code examples
- SDKs and libraries
- Webhooks documentation

✅ **Infrastructure**
- status.focuswithfocal.io → Uptime status page
- cdn.focuswithfocal.io → Static assets (JS, CSS, images)
- webhooks.focuswithfocal.io → Webhook endpoints

---

## Why This Split Makes Sense

### Industry Standard Pattern
Most successful SaaS companies use this:
- **Stripe**: stripe.com (marketing) + stripe.com/dashboard (app)
- **GitHub**: github.com (marketing) + github.com (app - same domain)
- **Vercel**: vercel.com (marketing) + vercel.com/dashboard (app)
- **DigitalOcean**: digitalocean.com (marketing) + cloud.digitalocean.com (app)
- **Railway**: railway.app (marketing) + railway.app (app)

### Security Benefits
- **Isolated vulnerabilities**: Marketing site breach doesn't affect customer data
- **Different security policies**: Stricter CORS/CSP on .io domain
- **Separate SSL certificates**: Easier to manage and rotate

### Performance Benefits
- **Different CDNs**: Marketing on Vercel/Netlify, App on CloudFront
- **Caching strategies**: Aggressive caching for .com, dynamic for .io
- **Geographic optimization**: Serve marketing globally, app from specific regions

### Professional Appearance
- `.io` is the standard for developer tools and SaaS products
- Signals "tech-savvy" and "modern"
- Easy to remember: .com for info, .io for app

---

## Hosting Recommendations

### focuswithfocal.com (Marketing)

**Option 1: Vercel (Recommended for MVP)** 🌟
- ✅ Free tier available
- ✅ Automatic SSL
- ✅ Global CDN
- ✅ Zero-config Next.js/React
- ✅ Git integration
- 💰 Cost: $0-20/month

**Option 2: Netlify**
- Similar to Vercel
- Great for static sites
- Built-in forms
- 💰 Cost: $0-19/month

**Setup**:
```bash
# Deploy marketing site
npx create-next-app@latest focal-marketing
cd focal-marketing
vercel --prod
# Connect to focuswithfocal.com in Vercel dashboard
```

### focuswithfocal.io (SaaS App)

**Option 1: Self-Hosted on EC2 t3.medium (Recommended)** 🌟
```bash
# Use focal-deploy to deploy your SaaS server!
focal-deploy new focal-saas-production

# This creates:
# - EC2 t3.medium ($34/month)
# - PostgreSQL database
# - Redis cache
# - All in one instance
```

**Option 2: Railway.app (Easiest)**
```bash
railway login
railway init
railway add postgresql redis
railway up
# Connect to api.focuswithfocal.io
```
💰 Cost: $20-50/month

**Option 3: Render.com**
- Good free tier to start
- Managed PostgreSQL
- 💰 Cost: $7-25/month

---

## DNS Setup Guide

### Step 1: Configure DigitalOcean DNS

**For focuswithfocal.com**:
```
Type    Name        Value                   TTL
A       @           [Vercel IP]             3600
CNAME   www         @                       3600
CNAME   blog        [Vercel]                3600
CNAME   docs        [Vercel]                3600
CNAME   help        [Vercel]                3600
TXT     @           [SPF/DKIM]              3600
MX      @           [Email provider]        3600
```

**For focuswithfocal.io**:
```
Type    Name        Value                   TTL
A       api         [EC2 Elastic IP]        3600
A       app         [EC2 Elastic IP]        3600
CNAME   developers  [Static site CDN]       3600
CNAME   status      [StatusPage.io]         3600
```

### Step 2: SSL Certificates

**Automatic with Vercel/Netlify** (for .com):
- Vercel handles SSL automatically
- No configuration needed

**Let's Encrypt Wildcard** (for .io):
```bash
# On your EC2 server
sudo certbot certonly --dns-digitalocean \
  -d focuswithfocal.io \
  -d *.focuswithfocal.io

# Auto-renew
sudo certbot renew --quiet
```

---

## Email Setup

### Recommended: SendGrid (Free Tier)

**Transactional Emails**:
- Welcome emails
- Password resets
- Deployment notifications
- Billing invoices

```bash
# .env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
SMTP_FROM=noreply@focuswithfocal.com
```

**Setup**:
1. Sign up at sendgrid.com (free up to 100 emails/day)
2. Verify sender email: `noreply@focuswithfocal.com`
3. Add SPF/DKIM records to DNS
4. Test with sending API

---

## Cost Breakdown (MVP)

| Item | Service | Cost/Month |
|------|---------|-----------|
| Marketing Site | Vercel | $0-20 |
| SaaS Server (t3.medium) | AWS EC2 | $34 |
| PostgreSQL | EC2 (included) | $0 |
| Redis | EC2 (included) | $0 |
| Domains | DigitalOcean | $0 |
| SSL Certificates | Let's Encrypt | $0 |
| Email | SendGrid (free) | $0 |
| DNS | DigitalOcean | $0 |
| **TOTAL MVP** | | **$34-54/month** |

**With Optional Services**:
| Item | Service | Cost/Month |
|------|---------|-----------|
| Status Page | StatusPage.io | $29 |
| Analytics | Plausible | $9 |
| Monitoring | Datadog (free tier) | $0 |
| **TOTAL with extras** | | **$72-92/month** |

---

## Implementation Timeline

### Week 1: Domain Setup ✅
- [x] Update all code to use correct domains
- [ ] Configure DNS on DigitalOcean
- [ ] Set up SSL certificates
- [ ] Configure email (SendGrid)

### Week 2: Deploy Marketing Site
- [ ] Build marketing site (Next.js)
- [ ] Deploy to Vercel
- [ ] Connect focuswithfocal.com
- [ ] Test all pages

### Week 3: Deploy SaaS Server
- [ ] Use focal-deploy to create EC2 instance
- [ ] Deploy API server to api.focuswithfocal.io
- [ ] Set up PostgreSQL + Redis
- [ ] Test API endpoints

### Week 4: Deploy Customer Dashboard
- [ ] Build React dashboard
- [ ] Deploy to app.focuswithfocal.io
- [ ] Connect to API
- [ ] Test login/signup flow

### Week 5: Beta Launch 🚀
- [ ] Invite 10 beta users
- [ ] Collect feedback
- [ ] Fix bugs
- [ ] Prepare for public launch

---

## Quick Setup Commands

### Marketing Site (focuswithfocal.com)
```bash
# Create Next.js site
npx create-next-app@latest focal-marketing
cd focal-marketing

# Deploy to Vercel
vercel --prod

# In Vercel dashboard:
# Settings → Domains → Add focuswithfocal.com
```

### API Server (api.focuswithfocal.io)
```bash
# Deploy with focal-deploy
focal-deploy new focal-saas-api

# SSH to server
focal-deploy shell focal-saas-api

# Clone and start server
git clone <your-repo>
cd COMMAND-DEPLOY/saas-server
npm install
npm start

# Set up process manager
pm2 start server.js --name focal-api
pm2 startup
pm2 save
```

### Customer Dashboard (app.focuswithfocal.io)
```bash
# Create React app
npx create-react-app focal-dashboard
cd focal-dashboard

# Build and deploy to S3 + CloudFront
# Or deploy to Vercel/Netlify
vercel --prod
# Connect to app.focuswithfocal.io
```

---

## 📊 Summary Table

| Purpose | Domain | Hosting | Cost |
|---------|--------|---------|------|
| Marketing website | focuswithfocal.com | Vercel | $0-20 |
| Blog & content | blog.focuswithfocal.com | Vercel | included |
| Documentation | docs.focuswithfocal.com | Vercel | included |
| API server | api.focuswithfocal.io | EC2 t3.medium | $34 |
| Customer dashboard | app.focuswithfocal.io | S3+CloudFront or Vercel | $0-15 |
| Status page | status.focuswithfocal.io | StatusPage.io | $29 |
| Email | *@focuswithfocal.com | SendGrid | $0-15 |
| **TOTAL** | | | **$63-113/month** |

---

## 🎯 My Top Recommendation

**For MVP (next 2-3 weeks)**:

1. **focuswithfocal.com** → Deploy simple marketing site on **Vercel** (FREE)
   - Just a landing page with pricing
   - "Sign up" button
   - Link to docs

2. **api.focuswithfocal.io** → Deploy API server on **EC2 t3.medium** using **focal-deploy** ($34/month)
   - PostgreSQL + Redis on same instance
   - Handles all API requests

3. **app.focuswithfocal.io** → Deploy React dashboard on **Vercel** (FREE)
   - Simple login/dashboard
   - Lists deployments
   - Basic settings

**Total MVP cost**: **$34/month** (just the EC2 instance!)

**Then scale up** as you get customers:
- Move PostgreSQL to RDS ($25/month)
- Add Redis ElastiCache ($15/month)
- Add status page ($29/month)
- Add monitoring ($0-50/month)

---

## ✅ All Updates Complete!

I've updated every file in the repository:
- ✅ LICENSE → DNS Publishing, LLC
- ✅ EULA.md → DNS Publishing, LLC, focuswithfocal.com
- ✅ All copyright headers → DNS Publishing, LLC
- ✅ All email addresses → @focuswithfocal.com
- ✅ API URLs → api.focuswithfocal.io
- ✅ Dashboard URLs → app.focuswithfocal.io
- ✅ Server size → t3.medium ($34/month)

**Next step**: Deploy your SaaS server using focal-deploy! 🚀

---

**DNS Publishing, LLC**
Website: https://focuswithfocal.com
API: https://api.focuswithfocal.io
Dashboard: https://app.focuswithfocal.io
