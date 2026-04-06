# Quick Reference Guide

## Deployment Verification

### Verify Deployed Application
```bash
# Basic verification
npm run verify:deployment https://your-app.onrender.com

# With environment variable
export DEPLOYMENT_URL=https://your-app.onrender.com
npm run verify:deployment

# With authentication
export VERIFY_AUTH_TOKEN=your-token
npm run verify:deployment https://your-app.onrender.com
```

### What Gets Tested
- ✅ Health endpoint (database, Redis, memory, CPU)
- ✅ Critical API endpoints
- ✅ WebSocket connectivity
- ✅ Security configuration (HTTPS, headers, compression)
- ✅ Performance metrics

### Understanding Results
- **✅ Passed**: Test successful
- **⚠️ Warning**: Suboptimal configuration
- **❌ Failed**: Requires attention
- **⏭️ Skipped**: Optional feature not configured

### Exit Codes
- `0`: All tests passed (or with warnings)
- `1`: One or more tests failed

## Production Validation

### Before Deployment
```bash
# Validate production readiness
npm run production:validate

# Test production build locally
npm run production:test
```

### After Deployment
```bash
# Verify deployment
npm run verify:deployment https://your-app.onrender.com

# Check health endpoint
curl https://your-app.onrender.com/health
```

## Environment Configuration

### Validate Configuration
```bash
# Validate environment variables
npm run config:env:validate

# View configuration summary
npm run config:summary

# Export configuration
npm run config:export
```

### Required Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
SESSION_SECRET=...
SESSION_ENCRYPTION_KEY=...
```

## Health Checks

### Check Server Health
```bash
# Local
npm run health:check

# Production
curl https://your-app.onrender.com/health
```

### Health Endpoints
- `/health` - Full health check
- `/ready` - Readiness probe
- `/live` - Liveness probe

## Performance Testing

### Run Performance Tests
```bash
# Performance benchmarks
npm run test:performance

# Load testing
npm run test:load

# Lighthouse audit
npm run lighthouse
```

## Troubleshooting

### Common Issues

**Health Check Fails**
```bash
# Check logs
# Verify DATABASE_URL
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"
```

**Redis Warnings**
```bash
# Expected if Redis not configured
# Application works in degraded mode
# To enable: Add REDIS_URL environment variable
```

**Slow Performance**
```bash
# Enable Redis caching
# Check database indexes
# Review slow query logs
# Consider upgrading instance
```

## CI/CD Integration

### GitHub Actions
```yaml
- run: npm run verify:deployment ${{ secrets.DEPLOYMENT_URL }}
```

### GitLab CI
```yaml
verify:
  script:
    - npm run verify:deployment $DEPLOYMENT_URL
```

## Related Documentation

- [Deployment Verification Guide](./DEPLOYMENT_VERIFICATION.md)
- [Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)
- [Health Check Guide](./HEALTH_CHECK_GUIDE.md)
- [Production Validation](./PRODUCTION_VALIDATION.md)
- [Troubleshooting](./RENDER_TROUBLESHOOTING.md)
