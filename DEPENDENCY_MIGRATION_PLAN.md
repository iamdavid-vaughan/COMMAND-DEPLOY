# Dependency Migration Plan
## Focal Deploy Monorepo - Package Update Strategy

> **Created:** 2025-11-19
> **Purpose:** Systematic upgrade plan for 40+ outdated dependencies across CLI, SaaS Server, and Dashboard

---

## 📊 Overview

### Current State
- **Root Project (CLI):** 19 outdated packages, 7 major version updates needed
- **SaaS Server:** 19 outdated packages, 7 major version updates needed
- **Dashboard:** 12 outdated packages, 5 major version updates needed

### Risk Assessment
- **Low Risk:** Patch/minor version updates
- **Medium Risk:** Major version updates with documented migration paths
- **High Risk:** Major version updates requiring code changes

---

## Phase 1: Low-Risk Updates (Week 1)

### Root Project (CLI)

```bash
cd /home/davidvaughan/app/focal-deploy
npm update axios simple-git js-yaml
```

**Packages:**
- `axios`: 1.12.2 → 1.13.2 (security fixes)
- `simple-git`: 3.28.0 → 3.30.0 (bug fixes)
- `js-yaml`: 4.1.0 → 4.1.1 (minor fix)
- `@aws-sdk/*`: All packages → 3.935.0 (latest stable)

**Testing Required:**
- [ ] Run full CLI test suite
- [ ] Test AWS operations (EC2, S3, IAM)
- [ ] Test Git operations
- [ ] Verify builds still work

**Estimated Time:** 2-3 hours

---

### SaaS Server

```bash
cd saas-server
npm update express-validator nodemailer
```

**Packages:**
- `express-validator`: 7.3.0 → 7.3.1
- `nodemailer`: 6.9.7 → 6.10.1
- `@aws-sdk/*`: 3.930.0 → 3.935.0
- `@aws-sdk/s3-request-presigner`: 3.934.0 → 3.935.0

**Testing Required:**
- [ ] Run server test suite
- [ ] Test email functionality
- [ ] Test validation on all endpoints
- [ ] Test AWS operations

**Estimated Time:** 2-3 hours

---

### Dashboard

```bash
cd dashboard
npm update @tanstack/react-query @types/react
```

**Packages:**
- `@tanstack/react-query`: 5.90.8 → 5.90.10
- `@types/react`: 18.3.26 → 18.3.27

**Testing Required:**
- [ ] Build dashboard
- [ ] Test all pages
- [ ] Verify API calls work

**Estimated Time:** 1-2 hours

---

## Phase 2: Medium-Risk Updates (Week 2-3)

### Root Project (CLI)

**Update Strategy:**
Test each major version update individually before combining.

#### 1. Commander.js (9.5.0 → 13.1.0)

**Breaking Changes:** Yes (multiple major versions)
**Migration Path:** https://github.com/tj/commander.js/blob/master/CHANGELOG.md

```bash
npm install commander@13.1.0
```

**Code Changes Needed:**
- Review `/bin/focal-deploy.js` command definitions
- Update option parsing if needed
- Test all 27 CLI commands

**Rollback Plan:**
```bash
npm install commander@9.5.0
```

**Testing Required:**
- [ ] Test every CLI command
- [ ] Verify option parsing
- [ ] Check help text output

**Estimated Time:** 4-6 hours

---

#### 2. Inquirer (8.2.7 → 12.11.1)

**Breaking Changes:** Yes (ESM migration in v9+)
**Migration Path:** https://github.com/SBoudrias/Inquirer.js/releases

**IMPORTANT:** Inquirer 9+ is ESM-only. Options:
1. Stay on v8.x (current approach)
2. Convert project to ESM
3. Use dynamic import

**Recommendation:** Stay on v8.x for now, migrate in major version

---

#### 3. Chalk (4.1.2 → 5.6.2)

**Breaking Changes:** Yes (ESM-only in v5)
**Migration Path:** Similar to Inquirer

**Recommendation:** Stay on v4.x until ESM migration

---

### SaaS Server

#### 1. Redis (4.7.1 → 5.10.0)

**Breaking Changes:** Yes
**Migration Guide:** https://github.com/redis/node-redis/blob/master/docs/v3-to-v4.md

```bash
npm install redis@5.10.0
```

**Code Changes:**
- Update `/services/redis.js`
- Review connection handling
- Test cache operations

**Files to Update:**
- `saas-server/services/redis.js`
- `saas-server/utils/cache.js`

**Testing Required:**
- [ ] Test Redis connection
- [ ] Test all cache operations
- [ ] Test session storage
- [ ] Performance test

**Estimated Time:** 4-6 hours

---

#### 2. Helmet (7.2.0 → 8.1.0)

**Breaking Changes:** Minimal
**Migration Path:** https://github.com/helmetjs/helmet/releases

```bash
npm install helmet@8.1.0
```

**Code Changes:**
- Review CSP configuration in `server.js`
- Test headers in production

**Testing Required:**
- [ ] Verify security headers
- [ ] Test CSP rules
- [ ] Check CORS configuration

**Estimated Time:** 2-3 hours

---

#### 3. Express Rate Limit (7.5.1 → 8.2.1)

**Breaking Changes:** Yes (configuration changes)
**Migration Path:** https://github.com/express-rate-limit/express-rate-limit/releases

```bash
npm install express-rate-limit@8.2.1
```

**Code Changes:**
- Update rate limiter configuration in `server.js`
- Test new options

**Testing Required:**
- [ ] Test rate limiting
- [ ] Verify headers
- [ ] Test different limits

**Estimated Time:** 2-3 hours

---

### Dashboard

#### 1. Lucide React (0.300.0 → 0.554.0)

**Breaking Changes:** Icon name changes possible
**Migration Path:** https://lucide.dev/guide/migration

```bash
npm install lucide-react@0.554.0
```

**Code Changes:**
- Review all icon imports
- Update deprecated icon names

**Testing Required:**
- [ ] Visual check of all pages
- [ ] Verify all icons render

**Estimated Time:** 2-3 hours

---

## Phase 3: High-Risk Updates (Month 2-3)

### These require careful planning and testing

#### Express 4 → 5 (SaaS Server)

**Impact:** High - Core framework
**Breaking Changes:** Yes
**Migration Guide:** https://expressjs.com/en/guide/migrating-5.html

**Preparation:**
1. Read full migration guide
2. Create feature branch
3. Set up comprehensive testing
4. Plan rollback strategy

**Estimated Time:** 1-2 weeks

---

#### Next.js 14 → 15 (Dashboard)

**Impact:** High - Core framework
**Breaking Changes:** Yes
**Migration Guide:** https://nextjs.org/docs/upgrading

**Major Changes:**
- App Router changes
- Middleware updates
- Image optimization updates
- Font optimization updates

**Preparation:**
1. Create backup branch
2. Review all App Router usage
3. Test on staging first
4. Monitor bundle size

**Estimated Time:** 1-2 weeks

---

#### React 18 → 19 (Dashboard)

**Impact:** Very High - Core library
**Breaking Changes:** Yes
**Migration Guide:** https://react.dev/blog/2024/04/25/react-19-upgrade-guide

**Major Changes:**
- New hooks behavior
- Concurrent features
- Suspense changes
- Server Components updates

**Preparation:**
1. Must upgrade Next.js first
2. Comprehensive testing needed
3. Check all third-party React libraries
4. Performance testing

**Estimated Time:** 2-3 weeks

---

#### Tailwind CSS 3 → 4 (Dashboard)

**Impact:** High - Styling framework
**Breaking Changes:** Yes
**Migration Guide:** https://tailwindcss.com/docs/upgrade-guide

**Major Changes:**
- Configuration changes
- Class name updates
- Plugin updates

**Preparation:**
1. Review all Tailwind classes
2. Update config files
3. Visual regression testing

**Estimated Time:** 1 week

---

## Phase 4: Postponed Updates

### These can wait for a major version release

#### Electron (28.3.3 → 39.2.2)

**Reason:** 11 major versions behind, significant breaking changes
**Recommendation:** Only update if Electron builds are actively used
**Alternative:** Remove if not needed

#### UUID (9.0.1 → 13.0.0)

**Reason:** 4 major versions, but low impact
**Recommendation:** Update during next major release

---

## 🔄 Update Process Template

For each package update:

### 1. Preparation
```bash
# Create feature branch
git checkout -b update-package-name

# Backup package-lock.json
cp package-lock.json package-lock.json.backup
```

### 2. Update
```bash
# Update specific package
npm install package-name@latest

# Or update multiple
npm update package1 package2 package3
```

### 3. Testing
```bash
# Run tests
npm test

# Build project
npm run build

# Manual testing checklist
- [ ] Core functionality
- [ ] Edge cases
- [ ] Performance
- [ ] Error handling
```

### 4. Commit
```bash
git add package.json package-lock.json
git commit -m "chore: update package-name from X.X.X to Y.Y.Y"
```

### 5. Rollback (if needed)
```bash
# Restore backup
cp package-lock.json.backup package-lock.json
npm ci
```

---

## 📝 Testing Checklist

### CLI Testing
- [ ] All 27 commands execute
- [ ] AWS operations work
- [ ] Git operations work
- [ ] Wizard flows complete
- [ ] Error handling works
- [ ] Help text displays
- [ ] License validation works

### SaaS Server Testing
- [ ] Server starts without errors
- [ ] Database connection works
- [ ] Redis connection works
- [ ] All API endpoints respond
- [ ] Authentication works
- [ ] Authorization works
- [ ] Rate limiting works
- [ ] Email sending works
- [ ] Billing integration works
- [ ] File uploads work
- [ ] Deployment worker runs

### Dashboard Testing
- [ ] Build completes
- [ ] All pages render
- [ ] Authentication flow works
- [ ] API calls succeed
- [ ] Forms validate
- [ ] Charts display
- [ ] Mobile responsive
- [ ] No console errors

---

## 🚨 Rollback Strategy

### If Critical Issue Found

1. **Immediate Rollback**
   ```bash
   git reset --hard HEAD~1
   npm ci
   ```

2. **Partial Rollback** (specific package)
   ```bash
   npm install package-name@previous-version
   ```

3. **Emergency** (production down)
   ```bash
   # Deploy previous git commit
   git checkout previous-commit-hash
   # Redeploy
   ```

---

## 📊 Progress Tracking

### Phase 1: Low-Risk Updates
- [ ] Root Project - AWS SDK
- [ ] Root Project - axios, simple-git, js-yaml
- [ ] SaaS Server - express-validator, nodemailer
- [ ] SaaS Server - AWS SDK
- [ ] Dashboard - react-query, types

### Phase 2: Medium-Risk Updates
- [ ] Root Project - Commander.js
- [ ] SaaS Server - Redis
- [ ] SaaS Server - Helmet
- [ ] SaaS Server - Express Rate Limit
- [ ] Dashboard - Lucide React

### Phase 3: High-Risk Updates
- [ ] SaaS Server - Express 5
- [ ] Dashboard - Next.js 15
- [ ] Dashboard - React 19
- [ ] Dashboard - Tailwind CSS 4

---

## 💰 Cost-Benefit Analysis

### Immediate Benefits (Phase 1-2)
- Security patches
- Bug fixes
- Performance improvements
- Estimated effort: 20-30 hours

### Long-term Benefits (Phase 3)
- Modern features
- Better performance
- Future compatibility
- Estimated effort: 40-60 hours

---

## 🎯 Recommendations

1. **Start with Phase 1** - Low risk, high value
2. **Do Phase 2 selectively** - Focus on security updates
3. **Plan Phase 3 carefully** - Major version bump timeline
4. **Monitor dependencies** - Set up automated alerts
5. **Document everything** - Update this plan as you progress

---

## 🔗 Useful Resources

- [npm-check-updates](https://www.npmjs.com/package/npm-check-updates) - Automated dependency checker
- [Snyk](https://snyk.io/) - Security vulnerability scanner
- [Dependabot](https://github.com/dependabot) - Automated dependency updates

---

## 📞 Support

If you encounter issues during migration:
1. Check package changelog
2. Search GitHub issues
3. Test in isolation
4. Ask in package community
5. Consider staying on current version

---

**Last Updated:** 2025-11-19
**Next Review:** After Phase 1 completion
