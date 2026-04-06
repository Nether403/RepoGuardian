# Render Deployment Checklist

Use this checklist to ensure a smooth deployment to Render.

## Pre-Deployment

### Code Preparation
- [ ] All code committed and pushed to repository
- [ ] `.gitignore` excludes `node_modules`, `.env`, `dist`
- [ ] `package.json` has correct build and start scripts
- [ ] Build succeeds locally: `npm run build`
- [ ] Tests pass: `npm run test:run`
- [ ] TypeScript compiles: `npm run check`
- [ ] No linting errors: `npm run lint`

### Database Setup
- [ ] Neon PostgreSQL database created
- [ ] Database connection string copied
- [ ] Connection string includes `?sslmode=require`
- [ ] Database schema pushed: `npm run db:push`
- [ ] Database connection tested locally

### Secrets Generation
- [ ] SESSION_SECRET generated (64 hex chars)
- [ ] SESSION_ENCRYPTION_KEY generated (64 hex chars)
- [ ] Secrets stored securely (not in Git)

### External Services
- [ ] Google Gemini API key obtained
- [ ] GitHub token created (optional but recommended)
- [ ] OpenAI API key obtained (optional, for fallback)
- [ ] Redis instance created (optional but recommended)
- [ ] Stripe account configured (optional, if using payments)
- [ ] Resend API key obtained (optional, for emails)

## Deployment Setup

### Render Service Configuration
- [ ] Render account created
- [ ] Git repository connected to Render
- [ ] Web Service created
- [ ] Service name set
- [ ] Region selected (close to users)
- [ ] Branch configured (usually `main`)
- [ ] Build command set: `npm ci && npm run build`
- [ ] Start command set: `npm run start`
- [ ] Instance type selected (Starter or higher recommended)

### Environment Variables
- [ ] All required variables added (see template)
- [ ] NODE_ENV set to `production`
- [ ] DATABASE_URL configured
- [ ] GEMINI_API_KEY configured
- [ ] SESSION_SECRET configured
- [ ] SESSION_ENCRYPTION_KEY configured
- [ ] FORCE_HTTPS set to `true`
- [ ] SECURITY_HEADERS_ENABLED set to `true`
- [ ] Optional variables added (Redis, GitHub, etc.)
- [ ] All variables saved in Render dashboard

### Health Check Configuration
- [ ] Health check path set to `/health`
- [ ] Health check interval set (30 seconds recommended)
- [ ] Health check timeout set (10 seconds recommended)
- [ ] Unhealthy threshold set (3 failures recommended)

## Deployment

### Initial Deploy
- [ ] "Create Web Service" clicked
- [ ] Build started successfully
- [ ] Build completed without errors
- [ ] Application started successfully
- [ ] Health checks passing
- [ ] Service URL noted

## Post-Deployment Verification

### Basic Checks
- [ ] Service shows "Live" status in dashboard
- [ ] Health endpoint returns 200: `curl https://your-app.onrender.com/health`
- [ ] Health response shows "healthy" status
- [ ] Frontend loads: Visit `https://your-app.onrender.com`
- [ ] No console errors in browser
- [ ] API responds: `curl https://your-app.onrender.com/api/health`

### Functionality Tests
- [ ] User registration works
- [ ] User login works
- [ ] Session persists across page refreshes
- [ ] Repository analysis works
- [ ] Analysis results display correctly
- [ ] Bookmarking works
- [ ] Export features work (PDF/CSV)
- [ ] WebSocket connections work (if applicable)

### Performance Checks
- [ ] Page load time < 3 seconds
- [ ] API response time < 2 seconds
- [ ] No timeout errors
- [ ] CPU usage < 50% (in dashboard)
- [ ] Memory usage < 80% (in dashboard)

### Log Review
- [ ] No error messages in logs
- [ ] "Server started on port 10000" message present
- [ ] "Database connected successfully" message present
- [ ] "Redis connected" message present (if configured)
- [ ] No warning messages about missing configuration

### Database Verification
- [ ] Database connection successful
- [ ] Data persists correctly
- [ ] Queries execute without errors
- [ ] Connection pool working correctly

### Security Verification
- [ ] HTTPS enabled (automatic with Render)
- [ ] HTTP redirects to HTTPS
- [ ] Security headers present (check with browser DevTools)
- [ ] HSTS header present
- [ ] CSP header present
- [ ] Cookies have `secure` and `httpOnly` flags

## Optional Configuration

### Custom Domain (if applicable)
- [ ] Custom domain added in Render dashboard
- [ ] DNS configured correctly
- [ ] SSL certificate provisioned
- [ ] APP_URL updated to custom domain
- [ ] COOKIE_DOMAIN updated to custom domain

### Redis Configuration (if applicable)
- [ ] Redis instance created
- [ ] REDIS_URL configured
- [ ] Redis connection verified
- [ ] Cache working correctly
- [ ] Session storage using Redis (if multi-instance)

### Monitoring Setup
- [ ] Performance monitoring enabled
- [ ] Error tracking configured
- [ ] Alerts configured (if available)
- [ ] Metrics dashboard accessible

## Documentation

### Update Documentation
- [ ] Deployment documented in team wiki/docs
- [ ] Environment variables documented
- [ ] Service URL shared with team
- [ ] Access credentials shared securely
- [ ] Rollback procedure documented

### Team Communication
- [ ] Team notified of deployment
- [ ] Service URL shared
- [ ] Known issues documented
- [ ] Support contact information shared

## Ongoing Maintenance

### Monitoring Setup
- [ ] Daily log review scheduled
- [ ] Weekly performance review scheduled
- [ ] Monthly maintenance scheduled
- [ ] Backup strategy documented
- [ ] Incident response plan created

### Optimization
- [ ] Performance baseline established
- [ ] Optimization opportunities identified
- [ ] Scaling plan documented
- [ ] Cost optimization reviewed

## Rollback Plan

### Preparation
- [ ] Previous working version identified
- [ ] Rollback procedure tested
- [ ] Database backup strategy confirmed
- [ ] Team trained on rollback procedure

### Emergency Contacts
- [ ] Render support contact saved
- [ ] Team lead contact saved
- [ ] On-call schedule established

## Sign-Off

- [ ] Deployment completed successfully
- [ ] All checks passed
- [ ] Team notified
- [ ] Documentation updated
- [ ] Monitoring configured

**Deployed by:** _______________  
**Date:** _______________  
**Service URL:** _______________  
**Version:** _______________

---

## Quick Reference

**Essential URLs:**
- Render Dashboard: https://dashboard.render.com
- Service URL: https://your-app.onrender.com
- Health Check: https://your-app.onrender.com/health
- Neon Dashboard: https://console.neon.tech

**Essential Commands:**
```bash
# Test health
curl https://your-app.onrender.com/health

# Test build locally
npm run build

# Validate config
npm run config:validate

# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Documentation:**
- Full guide: `docs/RENDER_DEPLOYMENT_GUIDE.md`
- Environment variables: `docs/RENDER_ENV_TEMPLATE.md`
- Troubleshooting: `docs/RENDER_TROUBLESHOOTING.md`

---

**Last Updated:** January 2025
