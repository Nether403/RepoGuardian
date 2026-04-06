# 🚀 RepoRadar Quick Setup Guide

## Critical Setup Steps (15 minutes)

### Step 1: Get Gemini API Key (5 minutes) ⚠️ REQUIRED

**Why:** Without this, AI analysis returns generic scores and the app's core value is lost.

1. Visit: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AIza...`)
5. Open `.env` file
6. Find the line: `GEMINI_API_KEY=`
7. Paste your key: `GEMINI_API_KEY=AIzaSyC...your_key_here`
8. Save the file

**Test it:**
```bash
npm run dev
# Visit http://localhost:3001/analyze
# Try analyzing: https://github.com/facebook/react
# You should see detailed AI scores and insights
```

---

### Step 2: Set Up Stripe (10 minutes) ⚠️ REQUIRED for Payments

**Why:** Without this, users can't upgrade to Pro/Enterprise plans.

1. Visit: https://dashboard.stripe.com/register
2. Create account (or sign in)
3. Switch to **Test Mode** (toggle in top right)
4. Go to: https://dashboard.stripe.com/test/apikeys
5. Copy both keys:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`)
6. Open `.env` file
7. Add your keys:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...your_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_...your_publishable_key
   ```

**Set up webhooks:**
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter URL: `https://your-domain.com/api/stripe/webhook`
4. Select events: `customer.subscription.*` and `invoice.*`
5. Copy the **Signing secret** (starts with `whsec_...`)
6. Add to `.env`:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...your_webhook_secret
   ```

**Test it:**
```bash
npm run dev
# Visit http://localhost:3001/pricing
# Try upgrading to Pro (use test card: 4242 4242 4242 4242)
```

---

### Step 3: Clean Up Configuration (2 minutes)

Your `.env` file is now properly organized with:
- ✅ Clear sections with emojis
- ✅ Comments explaining what each setting does
- ✅ Instructions for getting API keys
- ✅ Status indicators (✅ configured, ⚠️ required)

**No action needed** - just review the file to understand the settings.

---

## Optional: Enable Redis (for Production)

**Why:** Redis enables:
- Background job processing (batch analysis)
- Distributed caching (multi-instance deployments)
- Session storage across servers
- WebSocket scaling

**Quick Start (Docker):**
```bash
docker run -d -p 6379:6379 --name reporadar-redis redis:alpine
```

**Update `.env`:**
```bash
REDIS_ENABLED=true
USE_REDIS_SESSIONS=true
REDIS_URL=redis://localhost:6379
```

**Cloud Option (Recommended for Production):**
1. Sign up at: https://upstash.com (free tier available)
2. Create Redis database
3. Copy connection URL
4. Update `.env` with your Upstash URL

---

## Verification Checklist

After setup, verify everything works:

- [ ] **AI Analysis Works**
  - Visit `/analyze`
  - Analyze a repository
  - See detailed AI scores (not all 5/10)
  - AI Assistant responds to questions

- [ ] **Authentication Works**
  - Can sign up/sign in
  - Profile page loads
  - Bookmarks save correctly

- [ ] **Payments Work (Test Mode)**
  - Visit `/pricing`
  - Click upgrade to Pro
  - Complete test payment
  - Subscription shows as active

- [ ] **Search Works**
  - Visit `/search`
  - Search for repositories
  - Results appear
  - Filters work

- [ ] **Database Works**
  - Analyses save to database
  - User data persists
  - No connection errors in console

---

## Common Issues

### "AI analysis returns all 5/10 scores"
- **Cause:** Gemini API key not set or invalid
- **Fix:** Double-check `GEMINI_API_KEY` in `.env`
- **Test:** Restart server and try again

### "Payment fails with 'Service unavailable'"
- **Cause:** Stripe keys not configured
- **Fix:** Add all three Stripe keys to `.env`
- **Test:** Use test card 4242 4242 4242 4242

### "Session lost after refresh"
- **Cause:** Normal in development with memory sessions
- **Fix:** Enable Redis for persistent sessions (optional)

### "Port 3001 already in use"
- **Cause:** Another process using the port
- **Fix:** Change `PORT=3001` to `PORT=3002` in `.env`

---

## Next Steps

Once basic setup is complete:

1. **Test thoroughly** - Try all features with demo user
2. **Review analytics** - Check `/admin` dashboard
3. **Configure production** - Set up production environment variables
4. **Deploy** - Follow deployment guide in `docs/`

---

## Getting Help

- **Documentation:** Check `docs/` folder
- **API Reference:** `docs/API_DOCUMENTATION.md`
- **Performance:** `docs/PERFORMANCE_CONFIGURATION.md`
- **Issues:** Create GitHub issue with error details

---

## Production Checklist

Before deploying to production:

- [ ] Change `NODE_ENV=production`
- [ ] Generate secure `SESSION_SECRET` (use: `openssl rand -hex 32`)
- [ ] Generate secure `SESSION_ENCRYPTION_KEY` (use: `openssl rand -hex 32`)
- [ ] Switch Stripe to **Live Mode** keys
- [ ] Set up Redis (Upstash or similar)
- [ ] Configure proper domain in Stripe webhooks
- [ ] Enable HTTPS
- [ ] Set up monitoring/logging
- [ ] Configure backup strategy
- [ ] Test all critical flows

---

**Estimated Setup Time:** 15-20 minutes
**Time to First Working Analysis:** 5 minutes (with Gemini key)
**Time to Full Production:** 2-3 hours (including testing)
