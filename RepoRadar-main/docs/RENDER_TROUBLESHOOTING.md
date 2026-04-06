# Render Deployment Troubleshooting Quick Reference

Quick solutions to common Render deployment issues.

## Quick Diagnostics

```bash
# 1. Check health endpoint
curl https://your-app.onrender.com/health

# 2. Check logs in Render dashboard
# Dashboard → Your Service → Logs tab

# 3. Check deployment status
# Dashboard → Your Service → Events tab

# 4. Test database connection
psql "$DATABASE_URL" -c "SELECT 1"

# 5. Test Redis connection (if configured)
redis-cli -u "$REDIS_URL" ping
```

## Common Issues

### 🔴 Build Fails

**Quick Fix:**
```bash
# Test locally first
npm ci
npm run build

# Check for TypeScript errors
npm run check

# Review build logs in Render dashboard
```

**Common Causes:**
- TypeScript compilation errors
- Missing dependencies
- Out of memory during build

**Solution:** Fix errors locally, test build, then push.

---

### 🔴 Health Check Fails

**Quick Fix:**
```bash
# Verify DATABASE_URL is correct
# Check Environment tab in Render dashboard

# Test health endpoint
curl https://your-app.onrender.com/health

# Check logs for startup errors
# Look for "Database connection failed" or similar
```

**Common Causes:**
- Database connection failure
- Missing environment variables
- Application crashes on startup

**Solution:** Verify DATABASE_URL includes `?sslmode=require`, check all required env vars are set.

---

### 🔴 Application Crashes

**Quick Fix:**
```bash
# Check error logs
# Dashboard → Logs → Filter by ERROR

# Look for:
# - Unhandled promise rejections
# - Memory errors
# - Database connection errors

# Check memory usage
# Dashboard → Metrics tab
```

**Common Causes:**
- Unhandled errors
- Memory leaks
- Database connection exhaustion

**Solution:** Add error handling, monitor memory usage, adjust connection pool settings.

---

### 🟡 Slow Performance

**Quick Fix:**
```bash
# Enable Redis caching
REDIS_URL=redis://user:password@host:port
CACHE_ENABLED=true
CACHE_TYPE=redis

# Enable compression
COMPRESSION_ENABLED=true

# Check slow queries
# Look for "Slow query detected" in logs
```

**Common Causes:**
- No caching configured
- Missing database indexes
- Insufficient instance resources

**Solution:** Configure Redis, enable compression, optimize database queries.

---

### 🟡 WebSocket Issues

**Quick Fix:**
```bash
# For single instance (no Redis needed)
# Ensure only 1 instance running

# For multiple instances (requires Redis)
REDIS_URL=redis://user:password@host:port

# Check WebSocket in browser DevTools
# Network tab → WS → Look for connection status
```

**Common Causes:**
- Multiple instances without Redis
- CORS misconfiguration

**Solution:** Use single instance or configure Redis for multi-instance.

---

### 🟡 Session Loss

**Quick Fix:**
```bash
# Use PostgreSQL sessions (default, no Redis needed)
# Or use Redis sessions for multiple instances
USE_REDIS_SESSIONS=true
REDIS_URL=redis://user:password@host:port

# Verify cookie settings
FORCE_HTTPS=true
```

**Common Causes:**
- Multiple instances without Redis
- Cookie settings incorrect

**Solution:** Use PostgreSQL sessions for single instance, Redis for multiple.

---

### 🟡 Environment Variables Not Working

**Quick Fix:**
```bash
# 1. Verify in Render dashboard → Environment tab
# 2. Check for typos (case-sensitive)
# 3. Redeploy after adding variables
# Dashboard → Manual Deploy → Deploy latest commit
```

**Common Causes:**
- Variables not saved
- Typos in variable names
- Service not redeployed

**Solution:** Double-check variable names, save, and redeploy.

---

### 🟡 Database Connection Errors

**Quick Fix:**
```bash
# Verify DATABASE_URL format
# Must include ?sslmode=require
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# Test connection
psql "$DATABASE_URL" -c "SELECT 1"

# Check Neon dashboard
# Verify database is active
```

**Common Causes:**
- Missing `?sslmode=require`
- Incorrect credentials
- Database paused/deleted

**Solution:** Add SSL mode, verify credentials, check Neon dashboard.

---

### 🟡 Redis Connection Errors

**Quick Fix:**
```bash
# Test Redis connection
redis-cli -u "$REDIS_URL" ping

# Application works without Redis
# Check logs for "Falling back to memory cache"

# If Redis is optional, remove REDIS_URL
# App will use memory cache
```

**Common Causes:**
- Incorrect REDIS_URL
- Redis instance not running

**Solution:** Verify REDIS_URL or remove it (app works without Redis).

---

## Emergency Procedures

### Immediate Rollback

```bash
# Option 1: Via Dashboard
# Dashboard → Events → Find previous deployment → Rollback

# Option 2: Via Git
git revert HEAD
git push origin main
```

### Force Restart

```bash
# In Render dashboard
# Settings → Manual Deploy → Clear build cache & deploy
```

### Check Service Status

```bash
# Render status page
https://status.render.com

# Your service health
curl https://your-app.onrender.com/health
```

## Monitoring Checklist

Daily checks:
- [ ] Health endpoint returns 200 OK
- [ ] No error spikes in logs
- [ ] Response times < 2 seconds
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%

## Getting Help

1. **Check logs first**: Dashboard → Logs tab
2. **Review this guide**: Common issues above
3. **Check Render status**: https://status.render.com
4. **Render community**: https://community.render.com
5. **Render support**: support@render.com (paid plans)

## Useful Commands

```bash
# Test health
curl https://your-app.onrender.com/health

# Test API
curl https://your-app.onrender.com/api/health

# Test database
psql "$DATABASE_URL" -c "SELECT 1"

# Test Redis
redis-cli -u "$REDIS_URL" ping

# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Validate config locally
npm run config:validate
```

## See Also

- Full deployment guide: `docs/RENDER_DEPLOYMENT_GUIDE.md`
- Environment variables: `docs/RENDER_ENV_TEMPLATE.md`
- Health checks: `docs/HEALTH_CHECK_GUIDE.md`
- Security: `docs/SECURITY_CONFIGURATION.md`
