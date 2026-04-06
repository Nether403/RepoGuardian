# Rate Limiting Guide

This guide explains how rate limiting is configured and used in RepoRadar for production deployments.

## Overview

RepoRadar implements comprehensive rate limiting to protect against abuse and ensure fair resource allocation across different subscription tiers. The rate limiting system supports:

- **Distributed rate limiting** using Redis for multi-instance deployments
- **Memory-based fallback** for single-instance deployments
- **Tier-based limits** (Free, Pro, Enterprise)
- **Standard rate limit headers** for client transparency
- **Automatic violation logging** for security monitoring

## Architecture

### Storage Backends

#### Redis Storage (Production)
- **Use case**: Multi-instance deployments requiring distributed rate limiting
- **Benefits**: Shared state across instances, persistent counters
- **Configuration**: Set `RATE_LIMIT_STORAGE=redis` and provide `RATE_LIMIT_REDIS_URL`

#### Memory Storage (Development/Single-Instance)
- **Use case**: Development or single-instance deployments
- **Benefits**: No external dependencies, automatic cleanup
- **Configuration**: Set `RATE_LIMIT_STORAGE=memory` (default)

### Rate Limit Headers

All responses include standard rate limit headers:

```
X-RateLimit-Limit: 100              # Maximum requests allowed
X-RateLimit-Remaining: 95           # Requests remaining in window
X-RateLimit-Reset: 2025-10-15T...   # When the limit resets
X-RateLimit-Policy: 100;w=3600      # Policy: limit per window (seconds)
```

When rate limit is exceeded:
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-10-15T...
Retry-After: 3456                   # Seconds until reset

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "API rate limit exceeded. Please upgrade your plan for higher limits.",
  "retryAfter": 3456,
  "limit": 100,
  "resetAt": "2025-10-15T12:00:00Z"
}
```

## Configuration

### Environment Variables

```bash
# Storage backend: memory, redis, or postgres
RATE_LIMIT_STORAGE=redis

# Redis URL for distributed rate limiting (if using Redis)
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Authentication rate limits (IP-based)
RATE_LIMIT_AUTH_LOGIN_LIMIT=5           # 5 login attempts
RATE_LIMIT_AUTH_LOGIN_WINDOW=900000     # per 15 minutes
RATE_LIMIT_AUTH_SIGNUP_LIMIT=3          # 3 signup attempts
RATE_LIMIT_AUTH_SIGNUP_WINDOW=3600000   # per hour
RATE_LIMIT_AUTH_RESET_LIMIT=3           # 3 password reset requests
RATE_LIMIT_AUTH_RESET_WINDOW=3600000    # per hour

# API rate limits (user-based)
RATE_LIMIT_API_FREE_LIMIT=100           # Free tier: 100 requests
RATE_LIMIT_API_FREE_WINDOW=3600000      # per hour
RATE_LIMIT_API_PRO_LIMIT=1000           # Pro tier: 1000 requests
RATE_LIMIT_API_PRO_WINDOW=3600000       # per hour

# Analysis rate limits (user-based)
RATE_LIMIT_ANALYSIS_FREE_LIMIT=10       # Free tier: 10 analyses
RATE_LIMIT_ANALYSIS_FREE_WINDOW=86400000 # per day
RATE_LIMIT_ANALYSIS_PRO_LIMIT=100       # Pro tier: 100 analyses
RATE_LIMIT_ANALYSIS_PRO_WINDOW=86400000 # per day
```

### Subscription Tiers

Rate limits are automatically adjusted based on user subscription tier:

| Tier | API Requests | Analyses | Cost |
|------|-------------|----------|------|
| **Free** | 100/hour | 10/day | Free |
| **Pro** | 1,000/hour | 100/day | $9.99/month |
| **Enterprise** | Unlimited | Unlimited | Custom |

## Usage

### Applying Rate Limiters

#### Authentication Endpoints

```typescript
import { createAuthRateLimit } from './middleware/rateLimiter';

const authRateLimit = createAuthRateLimit();

app.post('/api/auth/login', authRateLimit, loginHandler);
app.post('/api/auth/signup', authRateLimit, signupHandler);
```

#### API Endpoints

```typescript
import { createApiRateLimit } from './middleware/rateLimiter';

const apiRateLimit = createApiRateLimit();

app.get('/api/repositories', apiRateLimit, getRepositories);
app.post('/api/repositories', apiRateLimit, createRepository);
```

#### Analysis Endpoints

```typescript
import { createAnalysisRateLimit } from './middleware/rateLimiter';

const analysisRateLimit = createAnalysisRateLimit();

app.post('/api/analyze', analysisRateLimit, analyzeRepository);
app.post('/api/batch-analyze', analysisRateLimit, batchAnalyze);
```

### Custom Rate Limiters

Create custom rate limiters for specific use cases:

```typescript
import { createRateLimit, MemoryRateLimitStorage } from './middleware/rateLimiter';

const customLimiter = createRateLimit({
  windowMs: 60000,              // 1 minute window
  maxRequests: 10,              // 10 requests per window
  keyGenerator: (req) => {
    // Custom key generation logic
    return `custom:${req.user?.id || req.ip}`;
  },
  storage: new MemoryRateLimitStorage(),
  message: 'Custom rate limit exceeded',
});

app.post('/api/custom-endpoint', customLimiter, handler);
```

### Tier-Based Rate Limiting

```typescript
import { createRateLimit } from './middleware/rateLimiter';

const tierBasedLimiter = createRateLimit({
  windowMs: 3600000,            // 1 hour
  maxRequests: 100,             // Default for free tier
  tierLimits: {
    free: { limit: 100, window: 3600000 },
    pro: { limit: 1000, window: 3600000 },
    enterprise: { limit: -1, window: 0 }, // Unlimited
  },
  keyGenerator: (req) => `api:${req.user?.id || req.ip}`,
});
```

## Monitoring

### Rate Limit Violations

Rate limit violations are automatically logged for security monitoring:

```typescript
import { getRateLimitViolations, clearRateLimitViolations } from './middleware/rateLimiter';

// Get recent violations
const violations = getRateLimitViolations(100); // Last 100 violations

// Clear violations
clearRateLimitViolations();
```

Violation data includes:
- IP address
- User ID (if authenticated)
- Endpoint path
- HTTP method
- User agent
- Timestamp
- Limit exceeded by

### Health Check Integration

Rate limiting status is included in the health check endpoint:

```bash
curl https://your-app.onrender.com/health
```

Response includes rate limiting information:
```json
{
  "status": "healthy",
  "checks": {
    "rateLimit": {
      "status": "healthy",
      "storage": "redis",
      "violations": 5
    }
  }
}
```

## Production Deployment

### Single-Instance Deployment

For single-instance deployments (e.g., Render Starter):

```bash
# .env
RATE_LIMIT_STORAGE=memory
```

Memory-based rate limiting is sufficient and requires no external dependencies.

### Multi-Instance Deployment

For multi-instance deployments (horizontal scaling):

```bash
# .env
RATE_LIMIT_STORAGE=redis
RATE_LIMIT_REDIS_URL=redis://your-redis-url:6379
```

Redis ensures rate limits are shared across all instances.

### Render Configuration

1. **Add Redis Service** (for multi-instance):
   - Go to Render Dashboard → New → Redis
   - Copy the internal connection URL
   - Add as `RATE_LIMIT_REDIS_URL` environment variable

2. **Configure Environment Variables**:
   ```
   RATE_LIMIT_STORAGE=redis
   RATE_LIMIT_REDIS_URL=<internal-redis-url>
   RATE_LIMIT_API_FREE_LIMIT=100
   RATE_LIMIT_API_PRO_LIMIT=1000
   ```

3. **Enable Horizontal Scaling**:
   - Set instance count to 2 or more
   - Rate limits will be shared across instances

## Best Practices

### 1. Choose Appropriate Limits

- **Authentication**: Strict limits (5-10 attempts per 15 minutes)
- **API Endpoints**: Moderate limits (100-1000 per hour)
- **Analysis**: Conservative limits (10-100 per day)
- **Search**: Generous limits (30-60 per minute)

### 2. Use Tier-Based Limits

Differentiate limits by subscription tier to encourage upgrades:
- Free tier: Basic limits for casual users
- Pro tier: Higher limits for power users
- Enterprise: Unlimited for large organizations

### 3. Monitor Violations

Regularly review rate limit violations to:
- Identify potential abuse
- Adjust limits based on usage patterns
- Detect bot traffic

### 4. Communicate Limits

- Include rate limit headers in all responses
- Document limits in API documentation
- Provide clear error messages when limits are exceeded

### 5. Use Redis for Production

For production deployments with multiple instances:
- Always use Redis-backed rate limiting
- Configure Redis with persistence
- Monitor Redis health and performance

## Troubleshooting

### Issue: Rate Limits Not Working

**Symptoms**: Requests not being rate limited

**Solutions**:
1. Check rate limit storage initialization:
   ```bash
   # Check logs for:
   "Rate limit storage initialized"
   ```

2. Verify environment variables:
   ```bash
   echo $RATE_LIMIT_STORAGE
   echo $RATE_LIMIT_API_FREE_LIMIT
   ```

3. Test rate limiting manually:
   ```bash
   # Make multiple requests quickly
   for i in {1..10}; do curl http://localhost:5000/api/test; done
   ```

### Issue: Redis Connection Failures

**Symptoms**: Rate limiting falls back to memory

**Solutions**:
1. Check Redis connectivity:
   ```bash
   redis-cli -u $RATE_LIMIT_REDIS_URL ping
   ```

2. Verify Redis URL format:
   ```
   redis://host:port
   rediss://host:port (for TLS)
   ```

3. Check Redis logs in Render dashboard

### Issue: Inconsistent Limits Across Instances

**Symptoms**: Different instances have different rate limit counters

**Solutions**:
1. Ensure Redis is configured:
   ```bash
   RATE_LIMIT_STORAGE=redis
   RATE_LIMIT_REDIS_URL=<redis-url>
   ```

2. Verify all instances use the same Redis URL

3. Check Redis key prefix consistency:
   ```bash
   REDIS_KEY_PREFIX=reporadar:
   ```

### Issue: Rate Limit Headers Missing

**Symptoms**: Responses don't include rate limit headers

**Solutions**:
1. Verify rate limiter is applied to route:
   ```typescript
   app.get('/api/endpoint', rateLimiter, handler);
   ```

2. Check middleware order (rate limiter should be early)

3. Ensure rate limiter doesn't error:
   ```bash
   # Check logs for:
   "Rate limiter error:"
   ```

## API Reference

### `createRateLimit(options)`

Creates a rate limiting middleware.

**Options**:
- `windowMs` (number): Time window in milliseconds
- `maxRequests` (number): Maximum requests per window
- `keyGenerator` (function): Function to generate rate limit key
- `storage` (RateLimitStorage): Storage backend
- `tierLimits` (object): Tier-based limits
- `message` (string): Error message when limit exceeded

**Returns**: Express middleware function

### `RedisRateLimitStorage`

Redis-backed storage for distributed rate limiting.

**Constructor**:
```typescript
new RedisRateLimitStorage(keyPrefix?: string)
```

### `MemoryRateLimitStorage`

Memory-backed storage for single-instance rate limiting.

**Constructor**:
```typescript
new MemoryRateLimitStorage()
```

### Predefined Rate Limiters

- `createAuthRateLimit()`: Authentication endpoints
- `createApiRateLimit()`: General API endpoints
- `createAnalysisRateLimit()`: Analysis endpoints
- `createSearchRateLimit()`: Search endpoints
- `createResetRateLimit()`: Password reset endpoints

## Examples

### Example 1: Basic Rate Limiting

```typescript
import { createRateLimit, MemoryRateLimitStorage } from './middleware/rateLimiter';

const limiter = createRateLimit({
  windowMs: 60000,              // 1 minute
  maxRequests: 10,              // 10 requests
  storage: new MemoryRateLimitStorage(),
});

app.use('/api', limiter);
```

### Example 2: Tier-Based Rate Limiting

```typescript
import { createApiRateLimit } from './middleware/rateLimiter';

const apiLimiter = createApiRateLimit();

app.use('/api', apiLimiter);
```

### Example 3: Custom Key Generation

```typescript
import { createRateLimit } from './middleware/rateLimiter';

const limiter = createRateLimit({
  windowMs: 3600000,
  maxRequests: 100,
  keyGenerator: (req) => {
    // Rate limit by API key
    const apiKey = req.headers['x-api-key'];
    return `api-key:${apiKey}`;
  },
});

app.use('/api', limiter);
```

### Example 4: Monitoring Violations

```typescript
import { getRateLimitViolations } from './middleware/rateLimiter';

app.get('/admin/rate-limit-violations', (req, res) => {
  const violations = getRateLimitViolations(100);
  res.json({ violations });
});
```

## Related Documentation

- [Security Configuration](./SECURITY_CONFIGURATION.md)
- [Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)
- [Environment Configuration](./ENVIRONMENT_CONFIGURATION.md)
- [Horizontal Scaling Guide](./HORIZONTAL_SCALING_GUIDE.md)
