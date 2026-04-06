# Production Deployment Checklist

This checklist ensures your RepoRadar application is ready for production deployment on Render or any other platform.

## Pre-Deployment Validation

### 1. Run Production Readiness Check
```bash
npm run production:validate
```

This validates:
- ✅ Build artifacts exist
- ✅ Build and start scripts are configured
- ✅ PORT environment variable is used
- ✅ Server binds to 0.0.0.0 (all interfaces)
- ✅ Configuration validation is implemented
- ✅ Security middleware exists
- ✅ Health check endpoint exists
- ✅ Graceful shutdown is configured

### 2. Test Build Process
```bash
npm run build
```

Expected output:
- Client build completes successfully
- Server build completes successfully
- `dist/` directory contains:
  - `index.js` (server bundle)
  - `public/` (client assets)

### 3. Test Start Script
```bash
npm run start
```

Verify:
- Server starts without errors
- Listens on PORT environment variable (default: 5000)
- Configuration validation passes
- Health endpoint responds at `/health`

## Required Environment Variables

These MUST be set in your production environment:

```bash
# Core Configuration
NODE_ENV=production
PORT=10000                    # Render uses 10000 by default
HOST=0.0.0.0                  # Bind to all interfaces

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Session Security (MUST be changed from defaults!)
SESSION_SECRET=<generate-secure-random-64-char-string>
SESSION_ENCRYPTION_KEY=<generate-secure-random-64-char-hex-string>

# AI Service
GEMINI_API_KEY=<your-google-gemini-api-key>
```

### Generate Secure Secrets

```bash
# Generate SESSION_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Recommended Environment Variables

These enhance functionality but are optional:

```bash
# Redis (for caching, sessions, and multi-instance support)
REDIS_URL=redis://host:port

# GitHub API (for higher rate limits)
GITHUB_TOKEN=<your-github-personal-access-token>

# Stripe (for payment processing)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_ENTERPRISE_PRICE_ID=price_...
APP_URL=https://your-app.onrender.com

# Email Service (for password reset)
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=noreply@yourdomain.com

# Security
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
```

## Render-Specific Configuration

### Service Settings

**Service Type:** Web Service

**Build Command:**
```bash
npm ci && npm run build
```

**Start Command:**
```bash
npm run start
```

**Health Check Path:**
```
/health
```

**Health Check Interval:** 30 seconds

### Instance Configuration

**Minimum Recommended:**
- Instance Type: Starter ($7/month)
- RAM: 512 MB
- CPU: 0.5 CPU

**Recommended for Production:**
- Instance Type: Standard ($25/month)
- RAM: 2 GB
- CPU: 1 CPU

### Auto-Deploy

Enable auto-deploy on your main/production branch for continuous deployment.

## Port Configuration

The application is designed to work with Render's default port configuration:

- **Default PORT:** 10000 (Render's default)
- **Fallback PORT:** 5000 (if PORT not set)
- **Binding:** 0.0.0.0 (all interfaces)

The server automatically:
1. Reads `PORT` from environment variable
2. Falls back to 5000 if not set
3. Binds to `HOST` environment variable (default: 0.0.0.0)
4. Logs the listening address on startup

## Validation Commands

Run these before deploying:

```bash
# Validate production readiness
npm run production:validate

# Validate configuration
npm run config:validate

# Check TypeScript types
npm run check

# Run linter
npm run lint

# Run tests
npm run test:run
```

## Post-Deployment Verification

After deployment, verify:

1. **Health Check:**
   ```bash
   curl https://your-app.onrender.com/health
   ```
   Expected: 200 OK with health status JSON

2. **Application Access:**
   - Visit your app URL
   - Verify frontend loads
   - Test authentication
   - Test repository analysis

3. **Monitor Logs:**
   - Check Render dashboard logs
   - Look for startup messages
   - Verify no errors

4. **Performance:**
   - Check response times
   - Monitor memory usage
   - Verify database connections

## Troubleshooting

### Build Fails

**Symptoms:** Deployment fails during build phase

**Solutions:**
- Run `npm run build` locally to reproduce
- Check for TypeScript errors: `npm run check`
- Verify all dependencies are in `package.json`
- Check build logs in Render dashboard

### Health Check Fails

**Symptoms:** Deployment succeeds but service marked unhealthy

**Solutions:**
- Verify `DATABASE_URL` is correct
- Check database connectivity
- Ensure health endpoint returns 200 status
- Review runtime logs for errors

### Port Binding Issues

**Symptoms:** Server fails to start or can't be reached

**Solutions:**
- Verify `PORT` environment variable is set
- Ensure server binds to `0.0.0.0` (not `localhost`)
- Check Render logs for port binding errors

### Configuration Errors

**Symptoms:** Application crashes on startup

**Solutions:**
- Run `npm run config:validate` locally
- Verify all required environment variables are set
- Check for default values in production (SESSION_SECRET, etc.)
- Review configuration validation errors in logs

## Security Checklist

Before going live:

- [ ] Change SESSION_SECRET from default value
- [ ] Change SESSION_ENCRYPTION_KEY from default value
- [ ] Enable FORCE_HTTPS=true
- [ ] Enable SECURITY_HEADERS_ENABLED=true
- [ ] Configure CSP_ENABLED=true
- [ ] Use SSL for database connection (sslmode=require)
- [ ] Use production Stripe keys (sk_live_)
- [ ] Set secure APP_URL (https://)
- [ ] Review and configure rate limiting
- [ ] Enable Redis for session storage (multi-instance)

## Scaling Considerations

### Single Instance (Default)
- Works out of the box
- No Redis required
- Sessions stored in PostgreSQL
- WebSocket works without adapter

### Multi-Instance (Horizontal Scaling)
- **Required:** Redis for session sharing
- **Required:** Redis adapter for Socket.io
- Configure in Render: Set instance count > 1
- Automatic load balancing by Render

### Vertical Scaling
- Upgrade instance type in Render dashboard
- Increase DB_POOL_MAX for larger instances
- Increase CACHE_MEMORY_MAX_SIZE

## Support Resources

- **Documentation:** See `docs/` directory
- **Render Docs:** https://render.com/docs
- **Health Check Guide:** `docs/HEALTH_CHECK_GUIDE.md`
- **Performance Config:** `docs/PERFORMANCE_CONFIGURATION.md`
- **Deployment Guide:** `.kiro/specs/render-deployment/design.md`
