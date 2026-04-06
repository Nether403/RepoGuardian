# ✅ RepoRadar Setup Checklist

## 🚨 CRITICAL (Must Do Now)

### 1. Gemini API Key
- [ ] Visit https://aistudio.google.com/app/apikey
- [ ] Create API key
- [ ] Add to `.env`: `GEMINI_API_KEY=AIza...`
- [ ] Restart server: `npm run dev`
- [ ] Test: Analyze a repository at `/analyze`
- [ ] Verify: Scores are NOT all 5/10

**Status:** ❌ NOT CONFIGURED - AI features disabled

---

### 2. Stripe Payment Keys
- [ ] Visit https://dashboard.stripe.com/test/apikeys
- [ ] Copy Secret Key (sk_test_...)
- [ ] Copy Publishable Key (pk_test_...)
- [ ] Add both to `.env`
- [ ] Set up webhook at https://dashboard.stripe.com/test/webhooks
- [ ] Add webhook secret to `.env`
- [ ] Test: Try upgrading at `/pricing`

**Status:** ❌ NOT CONFIGURED - Payments disabled

---

## 🟡 RECOMMENDED (Do Soon)

### 3. Redis Setup
- [ ] Choose option:
  - [ ] Local: `docker run -d -p 6379:6379 redis:alpine`
  - [ ] Cloud: Sign up at https://upstash.com
- [ ] Update `.env`: `REDIS_ENABLED=true`
- [ ] Update `.env`: `USE_REDIS_SESSIONS=true`
- [ ] Restart server
- [ ] Test: Background jobs work

**Status:** ❌ DISABLED - Using memory (single instance only)

---

### 4. Security Hardening
- [ ] Generate new `SESSION_SECRET`: `openssl rand -hex 32`
- [ ] Generate new `SESSION_ENCRYPTION_KEY`: `openssl rand -hex 32`
- [ ] Update both in `.env`
- [ ] Restart server

**Status:** ⚠️ USING DEFAULTS - Change for production

---

## ✅ ALREADY CONFIGURED

- [x] Neon Auth (Stack Auth) - Working
- [x] Database (Neon PostgreSQL) - Working
- [x] GitHub Token - Working
- [x] Performance Settings - Configured
- [x] Feature Flags - Enabled

---

## 📝 TESTING CHECKLIST

After completing critical setup:

### Basic Functionality
- [ ] Sign up / Sign in works
- [ ] Search repositories works
- [ ] Analyze repository shows AI scores
- [ ] AI Assistant responds
- [ ] Bookmarks save
- [ ] Collections work

### Payment Flow (Test Mode)
- [ ] Visit `/pricing`
- [ ] Click "Upgrade to Pro"
- [ ] Enter test card: 4242 4242 4242 4242
- [ ] Payment succeeds
- [ ] Subscription shows as active
- [ ] Pro features unlock

### Advanced Features
- [ ] Batch analysis works
- [ ] Export to PDF works
- [ ] Similar repositories found
- [ ] Admin dashboard loads
- [ ] Analytics tracking works

---

## 🚀 DEPLOYMENT CHECKLIST

Before going to production:

### Environment
- [ ] Set `NODE_ENV=production`
- [ ] Change `PORT` if needed
- [ ] Update all secrets (session, encryption)

### Stripe
- [ ] Switch to Live Mode keys
- [ ] Update webhook URL to production domain
- [ ] Test live payment flow

### Redis
- [ ] Set up production Redis (Upstash recommended)
- [ ] Update connection URL
- [ ] Test connection

### Security
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Review rate limits
- [ ] Set up monitoring

### Database
- [ ] Run migrations: `npm run db:push`
- [ ] Verify connection
- [ ] Set up backups

---

## 📊 CURRENT STATUS SUMMARY

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Authentication | ✅ Working | None |
| Database | ✅ Working | None |
| GitHub API | ✅ Working | None |
| **AI Analysis** | ❌ Broken | **Add Gemini key** |
| **Payments** | ❌ Broken | **Add Stripe keys** |
| Redis | ⚠️ Disabled | Enable for production |
| Sessions | ⚠️ Insecure | Change secrets |

---

## ⏱️ TIME ESTIMATES

- **Gemini Setup:** 5 minutes
- **Stripe Setup:** 10 minutes
- **Redis Setup:** 15 minutes
- **Security Hardening:** 5 minutes
- **Testing:** 30 minutes
- **Production Deploy:** 2-3 hours

**Total to MVP:** ~1 hour
**Total to Production:** ~4 hours

---

## 🆘 QUICK HELP

**AI not working?**
```bash
# Check if key is set
grep GEMINI_API_KEY .env
# Should show: GEMINI_API_KEY=AIza...
```

**Payments failing?**
```bash
# Check if Stripe keys are set
grep STRIPE_ .env
# Should show all three keys
```

**Server won't start?**
```bash
# Check for errors
npm run dev
# Look for "GEMINI_API_KEY not configured" warning
```

---

## 📞 SUPPORT

- Documentation: `docs/` folder
- Quick Setup: `QUICK_SETUP_GUIDE.md`
- API Docs: `docs/API_DOCUMENTATION.md`

---

**Last Updated:** 2025-10-09
**Next Review:** After completing critical setup
