# Render Deployment Guide

Complete guide for deploying RepoRadar to Render's platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Environment Variables](#environment-variables)
5. [Health Check Configuration](#health-check-configuration)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Scaling Configuration](#scaling-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)
10. [Maintenance](#maintenance)

## Prerequisites

Before deploying to Render, ensure you have:

- [ ] GitHub/GitLab/Bitbucket repository with RepoRadar code
- [ ] Neon PostgreSQL database (sign up at https://neon.tech)
- [ ] Google Gemini API key (get from https://makersuite.google.com/app/apikey)
- [ ] Render account (sign up at https://render.com)
- [ ] Optional: Redis instance for caching and sessions
- [ ] Optional: GitHub personal access token for higher API rate limits
- [ ] Optional: Stripe account for payment processing

## Quick Start

For experienced users who want to deploy quickly:

```bash
# 1. Create Neon database and copy connection string
# 2. Create Render Web Service
# 3. Set environment variables (see Environment Variables section)
# 4. Deploy!
```

**Minimum Required Environment Variables:**
```
NODE_ENV=production
DATABASE_URL=<neon-connection-string>
GEMINI_API_KEY=<your-gemini-key>
SESSION_SECRET=<generate-random-32-bytes>
SESSION_ENCRYPTION_KEY=<generate-random-64-char-hex>
```


## Step-by-Step Setup

### Step 1: Prepare Your Database

#### Create Neon PostgreSQL Database

1. Go to https://neon.tech and sign up/login
2. Click "Create Project"
3. Choose a project name (e.g., "reporadar-production")
4. Select a region close to your users (e.g., US East for North America)
5. Click "Create Project"
6. Copy the connection string from the dashboard
   - Format: `postgresql://user:password@host/database?sslmode=require`
   - Keep this secure - you'll need it for Render

#### Run Database Migrations

Before deploying, push your schema to the database:

```bash
# Set your DATABASE_URL temporarily
export DATABASE_URL="<your-neon-connection-string>"

# Push schema to database
npm run db:push
```

### Step 2: Generate Secure Secrets

Generate cryptographically secure secrets for your application:

```bash
# Generate SESSION_SECRET (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save these values - you'll need them for environment variables.

### Step 3: Create Render Web Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your Git repository:
   - Click "Connect account" for GitHub/GitLab/Bitbucket
   - Authorize Render to access your repositories
   - Select the RepoRadar repository
4. Configure the service:
   - **Name**: `reporadar` (or your preferred name)
   - **Region**: Choose based on your users' location
   - **Branch**: `main` (or your production branch)
   - **Runtime**: Node (detected automatically)
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm run start`
5. Choose an instance type:
   - **Free**: Limited, sleeps after inactivity (not recommended for production)
   - **Starter**: $7/month, 512 MB RAM, 0.5 CPU (good for small apps)
   - **Standard**: $25/month, 2 GB RAM, 1 CPU (recommended for production)
   - **Pro**: $85/month, 4 GB RAM, 2 CPU (for high traffic)


### Step 4: Configure Environment Variables

In the Render dashboard, go to the "Environment" tab and add these variables:

#### Required Variables

```bash
# Application Environment
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# Database (from Neon)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# AI Service (Primary)
GEMINI_API_KEY=your_gemini_api_key_here

# Session Security (generated in Step 2)
SESSION_SECRET=your_64_char_hex_secret_here
SESSION_ENCRYPTION_KEY=your_64_char_hex_key_here

# Security
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000
```

#### Recommended Optional Variables

```bash
# Redis (for caching and sessions - improves performance)
REDIS_URL=redis://user:password@host:port

# GitHub API (for higher rate limits)
GITHUB_TOKEN=ghp_your_github_token_here

# AI Fallback (optional but recommended)
OPENAI_API_KEY=sk-your_openai_api_key_here

# Application URL (for CORS and redirects)
APP_URL=https://your-app.onrender.com

# Email Service (for notifications)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=RepoRadar

# Stripe (if using payments)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
```

#### Performance Configuration (Optional)

```bash
# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000

# Cache Configuration
CACHE_ENABLED=true
CACHE_TYPE=redis
CACHE_DEFAULT_TTL=3600
CACHE_COMPRESSION_ENABLED=true

# Compression
COMPRESSION_ENABLED=true
COMPRESSION_ALGORITHMS=gzip,brotli
COMPRESSION_LEVEL=6

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60
```


### Step 5: Configure Health Checks

1. In Render dashboard, go to "Settings" tab
2. Scroll to "Health Check" section
3. Configure:
   - **Health Check Path**: `/health`
   - **Health Check Interval**: 30 seconds (default)
   - **Health Check Timeout**: 10 seconds (default)
   - **Unhealthy Threshold**: 3 failures (default)

The health check endpoint verifies:
- Database connectivity
- Redis connectivity (if configured)
- Memory usage
- CPU usage
- Application uptime

### Step 6: Deploy

1. Click "Create Web Service" at the bottom
2. Render will automatically:
   - Clone your repository
   - Install dependencies (`npm ci`)
   - Build the application (`npm run build`)
   - Start the server (`npm run start`)
   - Run health checks
3. Monitor the deployment in the "Events" tab
4. Watch logs in the "Logs" tab for any errors

### Step 7: Configure Custom Domain (Optional)

1. In Render dashboard, go to "Settings" tab
2. Scroll to "Custom Domain" section
3. Click "Add Custom Domain"
4. Enter your domain (e.g., `reporadar.com`)
5. Follow DNS configuration instructions
6. Render will automatically provision SSL certificate

Update your environment variables:
```bash
APP_URL=https://yourdomain.com
COOKIE_DOMAIN=yourdomain.com
```

## Environment Variables

### Complete Reference

See the [Environment Variables Template](#environment-variables-template) section below for a complete `.env` template you can copy to Render.

### Variable Categories

#### Core Application
- `NODE_ENV`: Environment (always `production` for Render)
- `PORT`: Port number (Render sets this automatically to 10000)
- `HOST`: Bind address (use `0.0.0.0` for Render)
- `APP_URL`: Full URL of your application

#### Database
- `DATABASE_URL`: PostgreSQL connection string from Neon (required)
- `DB_POOL_MIN`: Minimum database connections (default: 2)
- `DB_POOL_MAX`: Maximum database connections (default: 10)
- `DB_POOL_IDLE_TIMEOUT`: Close idle connections after ms (default: 30000)
- `DB_POOL_CONNECTION_TIMEOUT`: Connection timeout in ms (default: 5000)

#### AI Services
- `GEMINI_API_KEY`: Google Gemini API key (required)
- `OPENAI_API_KEY`: OpenAI API key (optional, for fallback)

#### Security
- `SESSION_SECRET`: Secret for session signing (required, 64 hex chars)
- `SESSION_ENCRYPTION_KEY`: Key for session encryption (required, 64 hex chars)
- `FORCE_HTTPS`: Force HTTPS redirects (set to `true`)
- `SECURITY_HEADERS_ENABLED`: Enable security headers (set to `true`)
- `CSP_ENABLED`: Enable Content Security Policy (set to `true`)
- `HSTS_MAX_AGE`: HSTS max age in seconds (default: 31536000)


#### Caching & Performance
- `REDIS_URL`: Redis connection string (optional but recommended)
- `CACHE_ENABLED`: Enable caching (default: true)
- `CACHE_TYPE`: Cache type - `memory`, `redis`, or `hybrid` (default: memory)
- `CACHE_DEFAULT_TTL`: Default cache TTL in seconds (default: 3600)
- `COMPRESSION_ENABLED`: Enable response compression (default: true)
- `COMPRESSION_ALGORITHMS`: Compression algorithms (default: gzip,brotli)

#### External Services
- `GITHUB_TOKEN`: GitHub personal access token (optional, for higher rate limits)
- `STRIPE_SECRET_KEY`: Stripe secret key (optional, for payments)
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable key (optional)
- `RESEND_API_KEY`: Resend API key (optional, for emails)
- `EMAIL_FROM`: Email sender address (optional)

#### Feature Flags
All default to `true`, set to `false` to disable:
- `FEATURE_BACKGROUNDJOBS`: Background job processing
- `FEATURE_HEALTHCHECKS`: Health check endpoints
- `FEATURE_MONITORING`: Performance monitoring
- `FEATURE_ADMINDASHBOARD`: Admin dashboard
- `FEATURE_HORIZONTALSCALING`: Horizontal scaling support

### Environment Variables Template

Copy this template to Render's environment variables section:

```bash
# === REQUIRED VARIABLES ===

NODE_ENV=production
PORT=10000
HOST=0.0.0.0
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
GEMINI_API_KEY=your_gemini_api_key_here
SESSION_SECRET=your_64_char_hex_secret_here
SESSION_ENCRYPTION_KEY=your_64_char_hex_key_here
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000

# === RECOMMENDED OPTIONAL ===

REDIS_URL=redis://user:password@host:port
GITHUB_TOKEN=ghp_your_github_token_here
OPENAI_API_KEY=sk-your_openai_api_key_here
APP_URL=https://your-app.onrender.com

# === PERFORMANCE (OPTIONAL) ===

DB_POOL_MIN=2
DB_POOL_MAX=10
CACHE_ENABLED=true
CACHE_TYPE=redis
COMPRESSION_ENABLED=true
COMPRESSION_ALGORITHMS=gzip,brotli
PERFORMANCE_MONITORING_ENABLED=true

# === EXTERNAL SERVICES (OPTIONAL) ===

RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=RepoRadar
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```


## Health Check Configuration

### Overview

RepoRadar includes a comprehensive health check endpoint at `/health` that monitors:
- Database connectivity and latency
- Redis connectivity and latency (if configured)
- Memory usage and availability
- CPU usage
- Application uptime

### Render Configuration

**Recommended Settings:**
- **Path**: `/health`
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Unhealthy Threshold**: 3 consecutive failures

### Health Check Response

**Healthy Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15,
      "connections": { "active": 5, "idle": 3 }
    },
    "redis": {
      "status": "healthy",
      "latency": 5
    },
    "memory": {
      "status": "healthy",
      "usage": 45.2,
      "total": "512MB",
      "free": "280MB"
    },
    "cpu": {
      "status": "healthy",
      "usage": 23.5
    }
  }
}
```

**Degraded Response (200 OK):**
```json
{
  "status": "degraded",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "healthy", "latency": 15 },
    "redis": { "status": "unavailable", "error": "Connection refused" },
    "memory": { "status": "healthy", "usage": 45.2 },
    "cpu": { "status": "healthy", "usage": 23.5 }
  }
}
```

**Unhealthy Response (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "unhealthy", "error": "Connection timeout" }
  }
}
```

### Health Status Logic

- **Healthy**: All critical services (database) are operational
- **Degraded**: Redis unavailable but core functionality works (returns 200)
- **Unhealthy**: Database unavailable or critical error (returns 503)

### Automatic Restart Behavior

Render will automatically restart your service when:
1. Health check returns 503 (unhealthy)
2. Health check times out (no response within 10 seconds)
3. 3 consecutive health check failures occur


## Post-Deployment Verification

### Step 1: Check Deployment Status

1. Go to Render dashboard → Your service
2. Check "Events" tab for deployment status
3. Verify "Deploy succeeded" message
4. Note the service URL (e.g., `https://your-app.onrender.com`)

### Step 2: Verify Health Endpoint

```bash
# Check health endpoint
curl https://your-app.onrender.com/health

# Expected: 200 OK with JSON response showing "healthy" status
```

### Step 3: Test Application Functionality

1. **Frontend Access**:
   - Visit `https://your-app.onrender.com`
   - Verify the React application loads
   - Check browser console for errors

2. **API Endpoints**:
   ```bash
   # Test API health
   curl https://your-app.onrender.com/api/health
   
   # Test authentication (should return 401 if not logged in)
   curl https://your-app.onrender.com/api/user
   ```

3. **Database Connectivity**:
   - Try logging in or signing up
   - Verify data persists across page refreshes
   - Check Render logs for database connection messages

4. **WebSocket Connections** (if applicable):
   - Open browser developer tools → Network tab
   - Look for WebSocket connection to `/socket.io`
   - Verify connection status is "connected"

### Step 4: Review Logs

```bash
# In Render dashboard, go to "Logs" tab
# Look for:
# - "Server started on port 10000"
# - "Database connected successfully"
# - "Redis connected" (if configured)
# - No error messages
```

### Step 5: Monitor Performance

1. Check Render dashboard metrics:
   - CPU usage (should be < 50% under normal load)
   - Memory usage (should be < 80% of allocated)
   - Request rate and response times

2. Access performance dashboard:
   ```bash
   curl https://your-app.onrender.com/api/performance/dashboard
   ```

### Step 6: Test Critical User Flows

- [ ] User registration
- [ ] User login
- [ ] Repository analysis
- [ ] Viewing analysis results
- [ ] Bookmarking repositories
- [ ] Exporting results (PDF/CSV)


## Scaling Configuration

RepoRadar supports both vertical and horizontal scaling on Render. For comprehensive scaling guidance, see the **[Scaling Configuration Guide](./SCALING_CONFIGURATION.md)**.

### Quick Scaling Overview

**Vertical Scaling (Upgrade Instance Size):**
- Increase CPU/RAM for single instance
- Best for: CPU-bound operations, memory-intensive tasks
- How: Dashboard → Settings → Instance Type

**Horizontal Scaling (Multiple Instances):**
- Run multiple instances with load balancing
- Requires: Redis for session/cache sharing
- Best for: High request volume, WebSocket connections
- How: Dashboard → Settings → Number of Instances

**Auto-Scaling (Pro Plans):**
- Automatically scale based on CPU/memory metrics
- Configure min/max instances and target thresholds
- How: Dashboard → Settings → Auto-Scaling

### Scaling Quick Reference

**When to Scale Vertically:**
- CPU usage > 80% sustained
- Memory usage > 85%
- Response times > 2 seconds
- Database connection pool exhaustion

**When to Scale Horizontally:**
- High request volume (>1000 req/min)
- Need high availability
- WebSocket connections at scale
- Geographic distribution

**Redis Setup for Horizontal Scaling:**
```bash
# Required environment variables
REDIS_URL=redis://red-xxxxx:6379
ENABLE_REDIS=true
CACHE_TYPE=redis
```

**Database Pool Adjustment:**
```bash
# Adjust based on instance count
DB_POOL_MAX=20  # Per instance for horizontal scaling
DB_POOL_MAX=30  # For larger vertical instances
```

For detailed scaling strategies, cost optimization, troubleshooting, and best practices, see the **[Scaling Configuration Guide](./SCALING_CONFIGURATION.md)**.


## Troubleshooting

### Common Issues and Solutions

#### Issue: Build Fails

**Symptoms:**
- Deployment fails during build phase
- Error message in Events tab: "Build failed"

**Common Causes:**
1. TypeScript compilation errors
2. Missing dependencies
3. Build script errors
4. Out of memory during build

**Solutions:**

```bash
# 1. Test build locally
npm run build

# 2. Check for TypeScript errors
npm run check

# 3. Verify dependencies
npm ci
npm run build

# 4. Check build logs in Render dashboard
# Look for specific error messages

# 5. If out of memory, upgrade instance type temporarily for build
```

**Prevention:**
- Always test `npm run build` locally before pushing
- Keep dependencies up to date
- Run `npm run check` before committing

---

#### Issue: Health Check Fails

**Symptoms:**
- Deployment succeeds but service marked unhealthy
- Service restarts frequently
- 503 errors when accessing application

**Common Causes:**
1. Database connection failure
2. Missing environment variables
3. Application crashes on startup
4. Health endpoint not responding

**Solutions:**

```bash
# 1. Check runtime logs in Render dashboard
# Look for error messages during startup

# 2. Verify DATABASE_URL is correct
# Test connection from local machine:
psql "$DATABASE_URL" -c "SELECT 1"

# 3. Verify all required environment variables are set
# Check Environment tab in Render dashboard

# 4. Test health endpoint manually
curl https://your-app.onrender.com/health

# 5. Check for port binding issues
# Ensure PORT environment variable is used (Render sets this automatically)
```

**Prevention:**
- Test with production-like environment variables locally
- Use `npm run config:validate` to check configuration
- Monitor health endpoint after deployment

---

#### Issue: Application Crashes

**Symptoms:**
- Service restarts frequently
- "Application error" messages
- Intermittent 503 errors

**Common Causes:**
1. Unhandled promise rejections
2. Memory leaks
3. Database connection exhaustion
4. Uncaught exceptions

**Solutions:**

```bash
# 1. Review error logs for stack traces
# In Render dashboard → Logs tab
# Filter by "ERROR" level

# 2. Check memory usage trends
# In Render dashboard → Metrics tab
# Look for increasing memory usage

# 3. Verify database connection pool settings
DB_POOL_MAX=10  # Don't set too high
DB_POOL_IDLE_TIMEOUT=30000

# 4. Enable detailed error logging
NODE_ENV=production
DEBUG=*  # Temporarily for debugging

# 5. Check for memory leaks
# Monitor memory usage over time
# Look for gradual increase
```

**Prevention:**
- Add proper error handling for all async operations
- Use try-catch blocks
- Monitor memory usage regularly
- Set up error tracking (e.g., Sentry)


---

#### Issue: Slow Performance

**Symptoms:**
- High response times (> 2 seconds)
- Timeouts
- Slow page loads

**Common Causes:**
1. Database queries not optimized
2. Missing indexes
3. Cache not configured
4. Insufficient instance resources
5. No compression enabled

**Solutions:**

```bash
# 1. Enable Redis caching
REDIS_URL=redis://user:password@host:port
CACHE_ENABLED=true
CACHE_TYPE=redis

# 2. Enable compression
COMPRESSION_ENABLED=true
COMPRESSION_ALGORITHMS=gzip,brotli

# 3. Optimize database queries
# Enable slow query logging
DB_LOG_SLOW_QUERIES=true
DB_SLOW_QUERY_THRESHOLD=1000

# 4. Check database indexes
# Review slow queries in logs
# Add indexes as needed

# 5. Upgrade instance type if needed
# Check CPU and memory usage in dashboard
```

**Prevention:**
- Configure Redis from the start
- Enable performance monitoring
- Review slow query logs regularly
- Load test before production

---

#### Issue: WebSocket Disconnections

**Symptoms:**
- Real-time features not working
- WebSocket connection drops
- "Connection lost" messages

**Common Causes:**
1. Redis not configured (multi-instance)
2. CORS misconfiguration
3. Load balancer timeout
4. Firewall blocking WebSocket

**Solutions:**

```bash
# 1. For single instance (no Redis needed)
# Ensure only 1 instance is running

# 2. For multiple instances (requires Redis)
REDIS_URL=redis://user:password@host:port

# 3. Verify CORS settings
APP_URL=https://your-app.onrender.com

# 4. Check WebSocket connection in browser
# Open DevTools → Network → WS tab
# Look for connection status

# 5. Test WebSocket endpoint
# Use a WebSocket client to test connection
```

**Prevention:**
- Configure Redis if using multiple instances
- Test WebSocket connections after deployment
- Monitor WebSocket connection status

---

#### Issue: Session Loss / Users Logged Out

**Symptoms:**
- Users logged out unexpectedly
- Session data not persisting
- "Please log in again" messages

**Common Causes:**
1. Session store not configured
2. Redis connection issues
3. Cookie settings incorrect
4. Multiple instances without Redis

**Solutions:**

```bash
# 1. Use PostgreSQL session store (default)
# No Redis required, sessions persist in database

# 2. Or use Redis session store (recommended for multiple instances)
REDIS_URL=redis://user:password@host:port
USE_REDIS_SESSIONS=true

# 3. Verify cookie settings
FORCE_HTTPS=true
COOKIE_DOMAIN=yourdomain.com

# 4. Check session configuration
SESSION_SECRET=your_secret_here
SESSION_ENCRYPTION_KEY=your_key_here

# 5. Verify Redis connectivity
redis-cli -u "$REDIS_URL" ping
```

**Prevention:**
- Use PostgreSQL sessions for single instance
- Use Redis sessions for multiple instances
- Test session persistence after deployment


---

#### Issue: Environment Variables Not Working

**Symptoms:**
- Application uses default values
- Features not working as expected
- "Missing environment variable" errors

**Common Causes:**
1. Variables not set in Render dashboard
2. Typos in variable names
3. Variables not saved
4. Service not redeployed after changes

**Solutions:**

```bash
# 1. Verify variables in Render dashboard
# Go to Environment tab
# Check all required variables are present

# 2. Check for typos
# Variable names are case-sensitive
# Compare with .env.example

# 3. Redeploy after adding variables
# Go to Manual Deploy → Deploy latest commit

# 4. Test configuration validation
# Check logs for configuration errors
# Look for "Missing required environment variable" messages

# 5. Use environment variable template
# Copy from Environment Variables Template section
```

**Prevention:**
- Use the environment variables template
- Double-check variable names
- Redeploy after adding variables
- Use `npm run config:validate` locally

---

#### Issue: Database Connection Errors

**Symptoms:**
- "Connection refused" errors
- "Connection timeout" errors
- Database queries fail

**Common Causes:**
1. Incorrect DATABASE_URL
2. SSL mode not configured
3. Neon database paused/deleted
4. Connection pool exhausted
5. Network issues

**Solutions:**

```bash
# 1. Verify DATABASE_URL format
# Should include ?sslmode=require
DATABASE_URL=postgresql://user:password@host/db?sslmode=require

# 2. Test connection from local machine
psql "$DATABASE_URL" -c "SELECT 1"

# 3. Check Neon dashboard
# Verify database is active
# Check for any alerts

# 4. Adjust connection pool settings
DB_POOL_MAX=10
DB_POOL_CONNECTION_TIMEOUT=5000

# 5. Check Render logs for specific errors
# Look for database connection messages
```

**Prevention:**
- Always include `?sslmode=require` in DATABASE_URL
- Test connection before deploying
- Monitor connection pool usage
- Set appropriate pool limits

---

#### Issue: Redis Connection Errors

**Symptoms:**
- "Redis connection failed" warnings
- Cache not working
- Sessions not persisting (if using Redis sessions)

**Common Causes:**
1. Incorrect REDIS_URL
2. Redis instance not running
3. Network connectivity issues
4. Redis password incorrect

**Solutions:**

```bash
# 1. Verify REDIS_URL format
REDIS_URL=redis://user:password@host:port

# 2. Test Redis connection
redis-cli -u "$REDIS_URL" ping
# Expected: PONG

# 3. Check Redis instance status
# In Redis provider dashboard
# Verify instance is running

# 4. Application should work without Redis
# Check logs for "Falling back to memory cache"
# Core functionality should still work

# 5. If Redis is optional, remove REDIS_URL
# Application will use memory cache instead
```

**Prevention:**
- Test Redis connection before deploying
- Redis is optional - app works without it
- Monitor Redis connectivity in health checks
- Use Redis for production, memory cache for development


---

### Debugging Tools and Commands

#### View Logs

```bash
# In Render dashboard:
# 1. Go to your service
# 2. Click "Logs" tab
# 3. Filter by level: ERROR, WARN, INFO
# 4. Search for specific errors
# 5. Download logs for offline analysis
```

#### Test Health Endpoint

```bash
# Basic health check
curl https://your-app.onrender.com/health

# Verbose output with headers
curl -v https://your-app.onrender.com/health

# Pretty print JSON response
curl https://your-app.onrender.com/health | jq .
```

#### Test Database Connection

```bash
# From local machine
psql "$DATABASE_URL" -c "SELECT 1"

# Check connection pool status
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_database';"
```

#### Test Redis Connection

```bash
# From local machine
redis-cli -u "$REDIS_URL" ping

# Check Redis info
redis-cli -u "$REDIS_URL" info

# Check memory usage
redis-cli -u "$REDIS_URL" info memory
```

#### Monitor Performance

```bash
# Access performance dashboard
curl https://your-app.onrender.com/api/performance/dashboard

# Check specific metrics
curl https://your-app.onrender.com/api/performance/metrics

# View slow queries
# Check logs for "Slow query detected" messages
```

#### Test API Endpoints

```bash
# Test authentication
curl https://your-app.onrender.com/api/user

# Test repository analysis
curl -X POST https://your-app.onrender.com/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/user/repo"}'

# Test health check
curl https://your-app.onrender.com/api/health
```


## Rollback Procedures

### Automatic Rollback

Render automatically rolls back deployments when:
- Health checks fail after deployment
- Application crashes during startup
- Build fails

**No manual intervention required** - Render reverts to the last working version.

### Manual Rollback

#### Option 1: Rollback via Dashboard

1. Go to Render dashboard → Your service
2. Click "Events" tab
3. Find the previous successful deployment
4. Click the three dots (⋯) next to the deployment
5. Select "Rollback to this version"
6. Confirm rollback
7. Monitor deployment in Events tab

#### Option 2: Rollback via Git

```bash
# 1. Find the commit hash of the working version
git log --oneline

# 2. Revert to that commit
git revert <commit-hash>

# 3. Push to trigger deployment
git push origin main

# Or force push to specific commit (use with caution)
git reset --hard <commit-hash>
git push --force origin main
```

### Rollback Considerations

#### Database Migrations

**Important**: Database migrations may not be automatically reversed during rollback.

**Before Rollback:**
1. Check if recent deployment included database migrations
2. Review migration files in `server/migrations/`
3. Determine if migrations need manual reversal

**Manual Migration Reversal:**
```bash
# Connect to database
psql "$DATABASE_URL"

# Review recent migrations
SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 5;

# If needed, manually reverse schema changes
# Example: DROP TABLE, DROP COLUMN, etc.
```

**Best Practice**: Test migrations in a staging environment before production.

#### Environment Variables

**Check Compatibility:**
1. Verify old code version is compatible with current environment variables
2. If variables were added/changed, may need to revert them
3. Go to Environment tab and review recent changes

**Revert Variables if Needed:**
1. Remove newly added variables
2. Restore old variable values
3. Click "Save Changes"
4. Redeploy if necessary

#### External Services

**Verify Compatibility:**
- API versions (Gemini, OpenAI, GitHub, Stripe)
- Webhook configurations
- Third-party integrations

**If Issues Arise:**
1. Check external service dashboards for errors
2. Verify API keys are still valid
3. Review webhook logs
4. Test integrations after rollback

### Rollback Verification

After rollback, verify:

```bash
# 1. Check deployment status
# In Render dashboard → Events tab

# 2. Test health endpoint
curl https://your-app.onrender.com/health

# 3. Test critical functionality
# - User login
# - Repository analysis
# - Data persistence

# 4. Review logs for errors
# In Render dashboard → Logs tab

# 5. Monitor performance
# Check CPU, memory, response times
```

### Preventing Rollback Needs

**Best Practices:**
1. Test thoroughly in staging environment
2. Use feature flags for gradual rollout
3. Monitor deployments closely for first 30 minutes
4. Have rollback plan ready before deploying
5. Document all changes in CHANGELOG.md
6. Test database migrations in development first
7. Use canary deployments for major changes


## Maintenance

### Regular Maintenance Tasks

#### Daily
- [ ] Monitor error logs for critical issues
- [ ] Check health endpoint status
- [ ] Review performance metrics (response times, CPU, memory)
- [ ] Monitor user-reported issues

#### Weekly
- [ ] Review slow query logs
- [ ] Check database connection pool usage
- [ ] Monitor cache hit rates
- [ ] Review security logs
- [ ] Check for dependency updates

#### Monthly
- [ ] Update dependencies (`npm update`)
- [ ] Review and optimize database indexes
- [ ] Analyze performance trends
- [ ] Review and rotate secrets if needed
- [ ] Check for Render platform updates
- [ ] Review and optimize costs

#### Quarterly
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Review and update documentation
- [ ] Disaster recovery test

### Monitoring Checklist

**Application Health:**
```bash
# Check health endpoint
curl https://your-app.onrender.com/health

# Expected: 200 OK with "healthy" status
```

**Performance Metrics:**
- Response time < 2 seconds (95th percentile)
- CPU usage < 70% average
- Memory usage < 80% average
- Cache hit rate > 80%
- Error rate < 1%

**Database Health:**
- Connection pool usage < 80%
- Query time < 1 second (95th percentile)
- No connection errors
- Slow query count < 10 per hour

**External Services:**
- Gemini API: Response time < 3 seconds
- GitHub API: Rate limit > 20% remaining
- Redis: Memory usage < 80%
- Stripe: No webhook failures

### Updating the Application

#### Minor Updates (Bug Fixes, Small Features)

```bash
# 1. Make changes in development branch
git checkout -b fix/bug-name

# 2. Test locally
npm run build
npm run test:run

# 3. Commit and push
git add .
git commit -m "Fix: description"
git push origin fix/bug-name

# 4. Create pull request and merge to main

# 5. Render automatically deploys
# Monitor in Events tab
```

#### Major Updates (Breaking Changes, Database Migrations)

```bash
# 1. Test in staging environment first
# 2. Create database backup
# 3. Document rollback procedure
# 4. Schedule maintenance window
# 5. Deploy during low-traffic period
# 6. Monitor closely for 1 hour
# 7. Be ready to rollback if issues arise
```

### Database Maintenance

#### Backup Strategy

**Neon Automatic Backups:**
- Neon automatically backs up your database
- Point-in-time recovery available
- No manual backup needed

**Manual Backup (Optional):**
```bash
# Create backup
pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d).sql

# Restore from backup
psql "$DATABASE_URL" < backup-20250115.sql
```

#### Database Optimization

```bash
# Connect to database
psql "$DATABASE_URL"

# Analyze tables (updates statistics)
ANALYZE;

# Vacuum (reclaim storage)
VACUUM;

# Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

### Security Maintenance

#### Rotate Secrets

```bash
# 1. Generate new secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Update in Render dashboard
# Go to Environment tab
# Update SESSION_SECRET and SESSION_ENCRYPTION_KEY

# 3. Redeploy
# Click Manual Deploy → Deploy latest commit

# 4. Verify users can still log in
```

#### Update Dependencies

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Update major versions (carefully)
npm install package@latest

# Test thoroughly
npm run build
npm run test:run

# Commit and push
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

#### Security Audit

```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Review security advisories
# Check GitHub security alerts
```

### Cost Optimization

**Monitor Usage:**
- Instance size vs actual usage
- Database storage and compute
- Redis memory usage
- Bandwidth usage

**Optimization Tips:**
1. Use appropriate instance size (don't over-provision)
2. Enable caching to reduce database queries
3. Optimize images and assets
4. Use compression
5. Monitor and optimize slow queries
6. Consider Neon's autoscaling for database

### Support and Resources

**Render Support:**
- Documentation: https://render.com/docs
- Community Forum: https://community.render.com
- Support: support@render.com (paid plans)

**RepoRadar Documentation:**
- API Documentation: `docs/API_DOCUMENTATION.md`
- Performance Guide: `docs/PERFORMANCE_CONFIGURATION.md`
- Security Guide: `docs/SECURITY_CONFIGURATION.md`
- Health Checks: `docs/HEALTH_CHECK_GUIDE.md`

**External Services:**
- Neon: https://neon.tech/docs
- Google Gemini: https://ai.google.dev/docs
- GitHub API: https://docs.github.com/en/rest
- Stripe: https://stripe.com/docs

---

## Quick Reference

### Essential Commands

```bash
# Test build locally
npm run build

# Validate configuration
npm run config:validate

# Test health endpoint
curl https://your-app.onrender.com/health

# View logs (in Render dashboard)
# Dashboard → Logs tab

# Rollback deployment
# Dashboard → Events → Select deployment → Rollback
```

### Essential URLs

- **Render Dashboard**: https://dashboard.render.com
- **Service URL**: https://your-app.onrender.com
- **Health Check**: https://your-app.onrender.com/health
- **API Health**: https://your-app.onrender.com/api/health
- **Performance Dashboard**: https://your-app.onrender.com/api/performance/dashboard

### Emergency Contacts

- **Render Status**: https://status.render.com
- **Neon Status**: https://neonstatus.com
- **Render Support**: support@render.com

---

**Last Updated**: January 2025  
**Version**: 1.0.0

For questions or issues, refer to the troubleshooting section or contact support.
