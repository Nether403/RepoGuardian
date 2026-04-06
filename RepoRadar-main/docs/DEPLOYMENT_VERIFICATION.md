# Deployment Verification Guide

This guide explains how to use the deployment verification script to test your deployed RepoRadar application.

## Overview

The deployment verification script (`scripts/verify-deployment.js`) is a comprehensive testing tool that validates your deployed application by:

- Testing the health endpoint
- Testing critical API endpoints
- Checking WebSocket connectivity
- Validating environment configuration
- Testing performance metrics

## Usage

### Basic Usage

```bash
# Verify a deployed application
npm run verify:deployment https://your-app.onrender.com

# Or use the script directly
node scripts/verify-deployment.js https://your-app.onrender.com
```

### Using Environment Variables

```bash
# Set deployment URL via environment variable
export DEPLOYMENT_URL=https://your-app.onrender.com
npm run verify:deployment

# With authentication token for protected endpoints
export DEPLOYMENT_URL=https://your-app.onrender.com
export VERIFY_AUTH_TOKEN=your-auth-token
npm run verify:deployment
```

### Windows Usage

```powershell
# PowerShell
$env:DEPLOYMENT_URL="https://your-app.onrender.com"
npm run verify:deployment

# Command Prompt
set DEPLOYMENT_URL=https://your-app.onrender.com
npm run verify:deployment
```

## What Gets Tested

### 1. Health Endpoint Tests

The script verifies that the `/health` endpoint:

- Is accessible and responds within a reasonable time
- Returns the correct status format
- Includes all required health checks (database, Redis, memory, CPU)
- Returns appropriate HTTP status codes (200 for healthy/degraded, 503 for unhealthy)
- Provides detailed metrics for each check

**Example output:**
```
🏥 Testing Health Endpoint
✅ Health endpoint accessible (145ms)
✅ Health status: healthy
✅ Health response includes timestamp
✅ Server uptime: 3600s
✅ Health checks present
✅ Database: healthy (15ms)
✅ Redis: healthy (5ms)
✅ Memory usage: 45.2%
✅ CPU usage: 23.5%
✅ Health endpoint returns 200 OK
```

### 2. Critical API Endpoint Tests

The script tests key API endpoints:

- **Root endpoint (`/`)**: Verifies the application serves HTML
- **API health check (`/api/health`)**: Optional separate health endpoint
- **User session endpoint (`/api/user`)**: Tests authentication
- **Repositories endpoint (`/api/repositories`)**: Tests core functionality

**Example output:**
```
🔌 Testing Critical API Endpoints
✅ Root endpoint: 200 (234ms)
✅ Root endpoint serves HTML
⏭️  API health check: Endpoint not implemented
✅ User session endpoint: Requires authentication (401)
✅ Repositories list endpoint: Requires authentication (401)
```

### 3. WebSocket Connectivity Tests

The script verifies WebSocket functionality:

- Establishes a WebSocket connection
- Tests Socket.io protocol
- Verifies message exchange
- Checks connection stability

**Example output:**
```
🔌 Testing WebSocket Connectivity
ℹ️  Connecting to: wss://your-app.onrender.com/socket.io/?EIO=4&transport=websocket
✅ WebSocket connection established
✅ WebSocket message received: 0{"sid":"abc123..."}
```

### 4. Environment Configuration Validation

The script validates production configuration:

- **HTTPS enforcement**: Verifies SSL/TLS is enabled
- **HTTP to HTTPS redirect**: Tests automatic redirection
- **Security headers**: Checks for required security headers
  - Strict-Transport-Security (HSTS)
  - X-Content-Type-Options
  - X-Frame-Options
  - Content-Security-Policy (optional)
- **Response compression**: Verifies gzip/brotli compression
- **Static asset caching**: Checks cache headers for assets

**Example output:**
```
⚙️  Validating Environment Configuration
✅ Deployment uses HTTPS
✅ HTTP redirects to HTTPS
✅ Security header present: Strict-Transport-Security
✅ Security header present: X-Content-Type-Options
✅ Security header present: X-Frame-Options
✅ Response compression enabled: gzip
✅ Static asset caching configured: public, max-age=31536000, immutable
```

### 5. Performance Metrics Tests

The script measures response times:

- Health endpoint response time (< 1000ms expected)
- Root page response time (< 2000ms expected)

**Example output:**
```
⚡ Testing Performance Metrics
✅ Health endpoint response time: 145ms (< 1000ms)
✅ Root page response time: 567ms (< 2000ms)
```

## Understanding Results

### Exit Codes

- **0**: All tests passed (or passed with warnings)
- **1**: One or more tests failed

### Result Categories

- **✅ Passed**: Test completed successfully
- **⚠️ Warning**: Test passed but with suboptimal configuration
- **❌ Failed**: Test failed and requires attention
- **⏭️ Skipped**: Test was skipped (optional feature not configured)

### Summary Report

At the end of the verification, you'll see a summary:

```
📊 Verification Summary

✅ Passed: 25
⚠️  Warnings: 3
❌ Failed: 0
⏭️  Skipped: 2

✅ DEPLOYMENT VERIFICATION PASSED WITH WARNINGS

💡 Consider addressing the warnings above.
```

## Common Scenarios

### Scenario 1: Fresh Deployment

After deploying to Render for the first time:

```bash
# Wait for deployment to complete
# Then verify
npm run verify:deployment https://your-app.onrender.com
```

**Expected results:**
- Health endpoint should be accessible
- Database should be healthy
- Redis might show warnings if not configured (degraded mode is OK)
- Security headers should be present
- WebSocket should connect

### Scenario 2: After Configuration Changes

After updating environment variables:

```bash
# Trigger a redeploy in Render
# Wait for deployment to complete
# Then verify
npm run verify:deployment https://your-app.onrender.com
```

**What to check:**
- New configuration is reflected in health checks
- No new errors introduced
- Performance remains acceptable

### Scenario 3: Production Monitoring

Regular verification of production deployment:

```bash
# Run verification as part of monitoring
npm run verify:deployment https://your-app.onrender.com

# Or schedule with cron (Linux/macOS)
# 0 */6 * * * cd /path/to/project && npm run verify:deployment https://your-app.onrender.com
```

### Scenario 4: Testing with Authentication

To test protected endpoints:

```bash
# Get an auth token from your application
# Then run verification with token
export VERIFY_AUTH_TOKEN="your-jwt-token"
npm run verify:deployment https://your-app.onrender.com
```

## Troubleshooting

### Health Endpoint Not Accessible

**Symptoms:**
```
❌ Health endpoint accessibility: HTTP 404
```

**Solutions:**
1. Verify the deployment completed successfully
2. Check Render logs for startup errors
3. Ensure health endpoint is implemented in `server/health.ts`
4. Verify the route is registered in `server/routes.ts`

### Database Connection Failed

**Symptoms:**
```
⚠️  Database health: Status: unhealthy
```

**Solutions:**
1. Verify `DATABASE_URL` environment variable is set correctly
2. Check Neon database is running and accessible
3. Verify SSL mode is enabled in connection string
4. Check database connection pool settings

### Redis Warnings

**Symptoms:**
```
⚠️  Redis health: Redis unavailable (degraded mode)
```

**Solutions:**
- This is expected if Redis is not configured
- Application should work in degraded mode
- To enable Redis: Add `REDIS_URL` environment variable
- Verify Redis service is running if configured

### WebSocket Connection Failed

**Symptoms:**
```
⚠️  WebSocket connection: Connection timeout (10s)
```

**Solutions:**
1. Verify WebSocket support is enabled in Render
2. Check CORS configuration allows WebSocket connections
3. Ensure Socket.io is properly initialized
4. Check for firewall or proxy issues

### Security Headers Missing

**Symptoms:**
```
⚠️  Security headers: Missing: Strict-Transport-Security
```

**Solutions:**
1. Verify Helmet.js middleware is configured
2. Check `FORCE_HTTPS` environment variable is set to `true`
3. Ensure security middleware is applied before routes
4. Review `server/middleware/httpsEnforcement.ts`

### Slow Response Times

**Symptoms:**
```
⚠️  Health endpoint performance: Slow response: 2500ms (expected < 1000ms)
```

**Solutions:**
1. Check database query performance
2. Verify Redis caching is enabled
3. Review server resource usage (CPU/memory)
4. Consider upgrading Render instance type
5. Check for slow external API calls

### HTTPS Not Enforced

**Symptoms:**
```
⚠️  HTTPS enforcement: HTTP does not redirect to HTTPS
```

**Solutions:**
1. Verify `FORCE_HTTPS=true` in environment variables
2. Check HTTPS enforcement middleware is enabled
3. Ensure middleware is applied before routes
4. Review Render SSL/TLS configuration

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Verify Deployment

on:
  deployment_status:

jobs:
  verify:
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run verify:deployment ${{ github.event.deployment_status.target_url }}
```

### GitLab CI Example

```yaml
verify-deployment:
  stage: verify
  script:
    - npm ci
    - npm run verify:deployment $DEPLOYMENT_URL
  only:
    - main
  when: manual
```

## Best Practices

1. **Run after every deployment**: Verify immediately after deploying
2. **Schedule regular checks**: Run verification periodically (e.g., every 6 hours)
3. **Monitor trends**: Track warnings and performance over time
4. **Address warnings**: Don't ignore warnings, they indicate suboptimal configuration
5. **Test with authentication**: Use auth tokens to test protected endpoints
6. **Document failures**: Keep a log of verification failures and resolutions
7. **Automate in CI/CD**: Integrate verification into your deployment pipeline

## Related Documentation

- [Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)
- [Health Check Guide](./HEALTH_CHECK_GUIDE.md)
- [Production Validation](./PRODUCTION_VALIDATION.md)
- [Render Troubleshooting](./RENDER_TROUBLESHOOTING.md)
- [Environment Configuration](./ENVIRONMENT_CONFIGURATION.md)

## Support

If you encounter issues with the verification script:

1. Check the [Troubleshooting](#troubleshooting) section above
2. Review [Render Troubleshooting Guide](./RENDER_TROUBLESHOOTING.md)
3. Check Render deployment logs
4. Verify environment variables are set correctly
5. Test locally with production build first
