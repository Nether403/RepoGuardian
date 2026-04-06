# Production Validation Guide

This guide explains how to validate your production configuration locally before deploying to Render.

## Overview

Before deploying to production, it's critical to validate that:
1. The production build process works correctly
2. Environment variables are properly configured and validated
3. The health endpoint responds correctly with production settings
4. Graceful shutdown handles all cleanup properly

## Quick Start

Run the complete production validation suite:

```bash
npm run production:test
```

This will:
- Build the application for production
- Verify all build artifacts exist
- Test the production server startup
- Validate health endpoint functionality
- Test graceful shutdown

## Detailed Validation Steps

### 1. Production Build Validation

#### Run the Build

```bash
npm run build
```

#### Verify Build Artifacts

The build should create:
- `dist/` - Root distribution directory
- `dist/index.js` - Compiled server bundle
- `dist/public/` - Client assets directory
- `dist/public/index.html` - Client HTML entry point
- `dist/public/assets/` - Bundled JavaScript and CSS

#### Check Build Script

```bash
npm run production:validate
```

This validates:
- All required build artifacts exist
- package.json has correct build and start scripts
- Server uses PORT environment variable
- Server binds to all interfaces (0.0.0.0)

### 2. Environment Variable Validation

#### Required Variables

For production, you must set:

```bash
NODE_ENV=production
PORT=10000                    # Or any port Render assigns
DATABASE_URL=postgresql://... # Neon connection string
SESSION_SECRET=...            # 32+ character random string
SESSION_ENCRYPTION_KEY=...    # 64 character hex string
GEMINI_API_KEY=...           # Google Gemini API key
```

#### Recommended Variables

```bash
REDIS_URL=...                # Redis connection string
GITHUB_TOKEN=...             # GitHub personal access token
STRIPE_SECRET_KEY=...        # Stripe secret key
FORCE_HTTPS=true             # Enforce HTTPS in production
```

#### Test Configuration Validation

```bash
npm run config:validate
```

This checks:
- All required variables are present
- Variable formats are correct (URLs, keys, etc.)
- Variable lengths meet security requirements
- Warns about missing optional variables

#### Generate Secure Secrets

```bash
# Generate SESSION_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Health Endpoint Testing

#### Start Production Server Locally

```bash
# Set required environment variables
export NODE_ENV=production
export PORT=5000
export DATABASE_URL="your-neon-connection-string"
export SESSION_SECRET="your-secret"
export SESSION_ENCRYPTION_KEY="your-key"
export GEMINI_API_KEY="your-api-key"

# Start the server
npm run start
```

#### Test Health Endpoint

```bash
curl http://localhost:5000/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15
    },
    "redis": {
      "status": "unavailable"
    },
    "memory": {
      "status": "healthy",
      "usage": 45.2
    },
    "cpu": {
      "status": "healthy",
      "usage": 23.5
    }
  }
}
```

#### Health Status Meanings

- **healthy**: All critical services operational
- **degraded**: Redis unavailable but core functionality works
- **unhealthy**: Database unavailable or critical error

#### Test Without Redis

The application should work without Redis by falling back to:
- Memory cache for caching
- PostgreSQL for session storage
- Disabled background jobs
- Single-instance WebSocket mode

### 4. Graceful Shutdown Testing

#### Test SIGTERM Handling

```bash
# Start server in background
npm run start &
SERVER_PID=$!

# Wait for startup
sleep 3

# Send SIGTERM
kill -TERM $SERVER_PID

# Check logs for graceful shutdown messages
```

Expected behavior:
- Server stops accepting new connections
- Existing connections complete
- Database connections close
- Redis connections close (if configured)
- Background jobs complete
- Server exits with code 0

#### Test SIGINT Handling

```bash
# Start server
npm run start

# Press Ctrl+C
# Server should shut down gracefully
```

#### Verify Shutdown Timeout

The server should complete shutdown within the configured timeout (default: 30 seconds).

```bash
# Set custom timeout
export GRACEFUL_SHUTDOWN_TIMEOUT=5000

npm run start
```

### 5. Automated Testing

#### Run Production Validation Tests

```bash
npm run test:run -- server/__tests__/production-validation.test.ts
```

This runs comprehensive tests for:
- Build artifact validation
- Environment variable validation
- Health endpoint functionality
- Graceful shutdown behavior
- Production configuration integration

#### Test Coverage

The tests validate:
- ✅ dist/ directory exists
- ✅ Compiled server entry point exists
- ✅ Built client assets exist
- ✅ Required environment variables validated
- ✅ Invalid configurations rejected
- ✅ Health endpoint responds correctly
- ✅ Database connectivity checked
- ✅ Redis fallback works
- ✅ SIGTERM handled gracefully
- ✅ SIGINT handled gracefully
- ✅ Shutdown completes within timeout

## Production Readiness Checklist

Before deploying to Render, verify:

### Build & Configuration
- [ ] `npm run build` completes successfully
- [ ] All build artifacts exist in `dist/`
- [ ] `npm run production:validate` passes
- [ ] `npm run config:validate` passes

### Environment Variables
- [ ] All required variables documented
- [ ] Secrets generated securely
- [ ] Database URL includes `?sslmode=require`
- [ ] SESSION_SECRET is 32+ characters
- [ ] SESSION_ENCRYPTION_KEY is 64 characters

### Server Functionality
- [ ] Server starts with production environment
- [ ] Health endpoint returns 200 OK
- [ ] Database connectivity verified
- [ ] Application works without Redis
- [ ] Static assets served correctly

### Shutdown & Cleanup
- [ ] SIGTERM triggers graceful shutdown
- [ ] SIGINT triggers graceful shutdown
- [ ] Shutdown completes within timeout
- [ ] No hanging connections or processes

### Testing
- [ ] Production validation tests pass
- [ ] Health endpoint tests pass
- [ ] Graceful shutdown tests pass
- [ ] No critical errors in logs

## Common Issues

### Build Fails

**Symptoms**: `npm run build` exits with error

**Solutions**:
- Run `npm run check` to find TypeScript errors
- Run `npm run lint` to find code issues
- Check that all dependencies are installed
- Verify Node.js version (18+)

### Server Won't Start

**Symptoms**: Server crashes immediately or fails to start

**Solutions**:
- Check environment variables are set
- Verify DATABASE_URL is correct
- Test database connectivity separately
- Check port is not already in use
- Review error logs for details

### Health Check Fails

**Symptoms**: `/health` returns 503 or times out

**Solutions**:
- Verify database is accessible
- Check DATABASE_URL includes SSL mode
- Ensure server has network access to database
- Review health check logs

### Graceful Shutdown Hangs

**Symptoms**: Server doesn't exit after SIGTERM

**Solutions**:
- Check for hanging database connections
- Verify Redis connections close properly
- Review background job cleanup
- Reduce shutdown timeout for testing

## Render-Specific Validation

### Port Configuration

Render sets `PORT` environment variable automatically (usually 10000).

Verify your server uses it:

```javascript
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

### SSL/TLS

Render provides automatic HTTPS. Your application should:
- Accept HTTP connections (Render's load balancer handles HTTPS)
- Check `x-forwarded-proto` header for HTTPS enforcement
- Not try to handle SSL certificates directly

### Health Checks

Render expects:
- Health check path: `/health`
- Response: 200 OK for healthy
- Response time: < 30 seconds
- Check interval: Every 30 seconds

### Build Command

Render runs: `npm ci && npm run build`

Ensure:
- `build` script is defined in package.json
- Build completes in < 15 minutes
- Build artifacts are in `dist/`

### Start Command

Render runs: `npm run start`

Ensure:
- `start` script runs production server
- Server binds to `0.0.0.0:${PORT}`
- Server starts in < 5 minutes

## Continuous Validation

### Pre-Commit Validation

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
npm run production:validate
```

### CI/CD Pipeline

Add to your CI configuration:

```yaml
- name: Validate Production Build
  run: npm run production:test

- name: Run Production Tests
  run: npm run test:run -- server/__tests__/production-validation.test.ts
```

### Monitoring After Deployment

After deploying to Render:

1. Check health endpoint:
   ```bash
   curl https://your-app.onrender.com/health
   ```

2. Monitor logs in Render dashboard

3. Test key functionality:
   - User authentication
   - Repository analysis
   - API endpoints

4. Check performance metrics:
   - Response times
   - Error rates
   - Resource usage

## Troubleshooting

### Validation Script Fails

If `npm run production:test` fails:

1. Check the error message carefully
2. Run individual validation steps:
   ```bash
   npm run build
   npm run production:validate
   npm run config:validate
   ```
3. Review logs for specific failures
4. Fix issues and re-run

### Tests Fail Locally

If tests pass but deployment fails:

1. Ensure production environment matches test environment
2. Verify all environment variables are set in Render
3. Check Render build logs for errors
4. Test with exact Render environment variables locally

### Performance Issues

If validation is slow:

1. Check database connectivity
2. Verify network latency to external services
3. Review resource usage (CPU, memory)
4. Consider upgrading Render instance type

## Additional Resources

- [Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)
- [Environment Configuration](./RENDER_ENV_TEMPLATE.md)
- [Troubleshooting Guide](./RENDER_TROUBLESHOOTING.md)
- [Health Check Configuration](../server/health.ts)
- [Graceful Shutdown Guide](./GRACEFUL_SHUTDOWN_GUIDE.md)
