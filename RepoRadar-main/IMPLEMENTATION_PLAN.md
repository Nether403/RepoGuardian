# RepoRadar Pre-Deployment Implementation Plan

## Overview
This document outlines the implementation tasks to prepare RepoRadar for production deployment.

---

## ✅ Task 1: GitHub Webhook Integration + Coming Soon Banners

### 1.1 Implement GitHub Webhook Backend
**Files to create/modify:**
- `server/integrations/github.ts` - GitHub webhook handler
- `server/routes.ts` - Add webhook endpoints
- `shared/schema.ts` - Add webhook events table (if needed)

**Endpoints needed:**
- `POST /api/integrations/github/connect` - Connect GitHub
- `POST /api/integrations/github/webhook` - Receive webhook events
- `GET /api/integrations/github/status` - Check connection status
- `DELETE /api/integrations/github/disconnect` - Disconnect

**Features:**
- Webhook signature verification
- Handle events: push, pull_request, release
- Trigger automatic repository analysis on push
- Store webhook events for debugging

### 1.2 Update Integrations Page UI
**File:** `client/src/pages/integrations.tsx`

**Changes:**
- Add "Coming Soon" badge to non-GitHub integrations
- Make GitHub integration fully functional
- Add webhook URL display after connection
- Add event log viewer for GitHub webhooks
- Disable "Connect" button for coming soon integrations

---

## ✅ Task 2: Teams/Collaboration Coming Soon Page

### 2.1 Create Teams Page
**File to create:** `client/src/pages/teams.tsx`

**Features:**
- "Coming Soon" banner at top
- Preview of planned features:
  - Team creation and management
  - Member invitations
  - Shared analyses
  - Team analytics
  - Role-based permissions
- Email signup for early access notification
- Estimated release date

### 2.2 Add Navigation Link
**File:** `client/src/components/layout/Header.tsx`
- Add "Teams" link to navigation
- Add beta badge

---

## ✅ Task 3: Simplify Subscription Tiers

### 3.1 Update Tier Limits
**File:** `server/stripe.ts`

**Current (Confusing):**
```typescript
Free: 5 analyses/day
Pro: Unlimited
Enterprise: Unlimited
```

**New (Clear):**
```typescript
Free: 10 analyses/month
Pro: Unlimited analyses/month
Enterprise: Unlimited + API access
```

### 3.2 Update Documentation
**Files to update:**
- `README.md` - Update tier comparison
- `client/src/pages/pricing.tsx` - Update pricing cards
- `docs/API_DOCUMENTATION.md` - Clarify API access

### 3.3 Update Rate Limiting
**File:** `.env`
```bash
# Change from daily to monthly
RATE_LIMIT_ANALYSIS_FREE_LIMIT=10
RATE_LIMIT_ANALYSIS_FREE_WINDOW=2592000000  # 30 days in ms
```

---

## ✅ Task 4: Update User Onboarding

### 4.1 Review Current Onboarding
**File:** `client/src/components/onboarding-tour.tsx`

**Verify it includes:**
- Welcome message
- Key features tour
- Sample repository suggestion
- First analysis walkthrough

### 4.2 Enhancements Needed
- Add "Skip Tour" option
- Add "Restart Tour" in help menu
- Show tour on first login only
- Add progress indicator (Step 1 of 5)

### 4.3 Sample Repository
**Add to onboarding:**
- Suggest analyzing: `facebook/react` or `microsoft/vscode`
- Pre-fill URL in search box
- One-click "Analyze Sample" button

---

## ✅ Task 5: Monitoring Setup (Sentry)

### 5.1 Install Sentry
```bash
npm install @sentry/node @sentry/react
```

### 5.2 Backend Integration
**File to create:** `server/monitoring/sentry.ts`

**Features:**
- Error tracking
- Performance monitoring
- User context
- Custom tags (environment, version)
- Breadcrumbs for debugging

### 5.3 Frontend Integration
**File to create:** `client/src/lib/sentry.ts`

**Features:**
- Error boundary integration
- User feedback widget
- Session replay (optional)
- Performance monitoring

### 5.4 Environment Variables
**Add to `.env`:**
```bash
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=1.0.0
```

---

## ✅ Task 6: Uptime Monitoring

### 6.1 Options
**Recommended:** UptimeRobot (free tier)
- Monitor `/health` endpoint
- Alert via email/Slack
- 5-minute intervals
- Multiple locations

**Alternative:** Better Uptime, Pingdom

### 6.2 Setup
1. Create UptimeRobot account
2. Add monitor for: `https://your-domain.com/health`
3. Configure alerts
4. Add status page (optional)

---

## ✅ Task 7: Performance Alerts

### 7.1 Current Implementation
**File:** `server/performance/AlertingSystem.ts`

**Already has:**
- Database query time alerts
- API response time alerts
- Cache hit rate alerts
- Error rate alerts

### 7.2 Enhancements Needed
**Add alert channels:**
- Email notifications (via Resend)
- Slack webhooks
- Discord webhooks

**File to modify:** `server/performance/AlertingSystem.ts`

---

## ✅ Task 8: SEO & Marketing

### 8.1 Meta Tags
**File:** `client/index.html`

**Add:**
```html
<!-- Open Graph -->
<meta property="og:title" content="RepoRadar - AI-Powered GitHub Repository Analysis">
<meta property="og:description" content="Analyze GitHub repositories with AI. Get insights on originality, completeness, marketability, and more.">
<meta property="og:image" content="https://your-domain.com/og-image.png">
<meta property="og:url" content="https://your-domain.com">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="RepoRadar - AI Repository Analysis">
<meta name="twitter:description" content="Analyze GitHub repositories with AI">
<meta name="twitter:image" content="https://your-domain.com/twitter-card.png">
```

### 8.2 Create OG Image
**File to create:** `client/public/og-image.png`
- Size: 1200x630px
- Include: Logo, tagline, key features
- Use brand colors

### 8.3 Sitemap
**File to create:** `client/public/sitemap.xml`

**Include:**
- Homepage
- Pricing
- Documentation
- Blog (if applicable)

### 8.4 Robots.txt
**File to create:** `client/public/robots.txt`
```
User-agent: *
Allow: /
Sitemap: https://your-domain.com/sitemap.xml
```

---

## ✅ Task 9: User Feedback Widget

### 9.1 Options
**Recommended:** Canny, Frill, or custom implementation

### 9.2 Custom Implementation
**File to create:** `client/src/components/feedback-widget.tsx`

**Features:**
- Floating button (bottom-right)
- Feedback form (bug, feature request, general)
- Screenshot capture (optional)
- Email notification to admin

### 9.3 Backend
**Endpoint:** `POST /api/feedback`
- Store in database
- Send email notification
- Track feedback status

---

## 📋 Implementation Priority

### Phase 1: Critical (Before Launch)
1. ✅ Verify `.env` security (DONE - just update Stripe price IDs and APP_URL)
2. 🔨 GitHub webhook integration
3. 🔨 Coming soon banners on integrations
4. 🔨 Simplify tier limits
5. 🔨 Update APP_URL and PASSWORD_RESET_URL in `.env`

### Phase 2: Important (Week 1)
6. 🔨 Sentry integration
7. 🔨 Uptime monitoring setup
8. 🔨 Teams coming soon page
9. 🔨 Update onboarding tour

### Phase 3: Nice to Have (Week 2-4)
10. 🔨 SEO meta tags and OG images
11. 🔨 User feedback widget
12. 🔨 Performance alert channels (email/Slack)
13. 🔨 Sitemap and robots.txt

---

## 🎯 Do We Need a Spec File?

**Answer: No, not for these tasks.**

**Reasoning:**
- These are enhancements to existing features
- Implementation is straightforward
- This plan document serves as the spec
- Most changes are configuration or UI updates

**When you WOULD need a spec:**
- Building the full Teams/Collaboration feature
- Adding new AI analysis models
- Implementing a mobile app
- Major architectural changes

---

## 📝 Next Steps

1. **Review this plan** - Confirm priorities
2. **Start with Phase 1** - Critical items first
3. **Test each change** - Don't break existing features
4. **Update documentation** - Keep README current
5. **Deploy incrementally** - Don't wait for everything

---

## 🚀 Ready to Start?

Let me know which task you'd like to tackle first, and I'll help you implement it!

**Recommended order:**
1. Update `.env` APP_URL and Stripe price IDs
2. Add coming soon banners to integrations page (quick win)
3. Implement GitHub webhook integration
4. Set up Sentry monitoring
5. Everything else can follow

