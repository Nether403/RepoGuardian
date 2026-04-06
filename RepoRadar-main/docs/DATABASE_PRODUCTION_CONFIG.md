# Database Production Configuration

## Overview

This document describes the production database configuration for RepoRadar deployment on Render with Neon PostgreSQL.

## SSL Configuration

### Requirement 2.2: SSL Mode for Secure Connections

The application automatically enables SSL connections in production mode:

```typescript
// Automatic SSL configuration based on NODE_ENV
ssl: isProduction ? { rejectUnauthorized: true } : undefined
```

**Neon Connection String Format:**
```
postgresql://user:password@host/database?sslmode=require
```

Neon requires SSL connections by default. The application enforces this in production by:
- Setting `ssl: { rejectUnauthorized: true }` in the pool configuration
- Validating SSL certificates to prevent man-in-the-middle attacks

## Connection Pooling

### Requirement 2.5: Production-Appropriate Pool Settings

The connection pool is configured with production-optimized defaults:

| Setting | Development | Production | Description |
|---------|-------------|------------|-------------|
| `max` | 20 | 10 | Maximum connections (adjust based on instance size) |
| `min` | 2 | 2 | Minimum idle connections |
| `idleTimeoutMillis` | 60000 | 30000 | Close idle connections after 30s |
| `connectionTimeoutMillis` | 10000 | 5000 | Faster failure detection in production |

### Adjusting Pool Size for Instance Type

**Render Starter (512 MB RAM, 0.5 CPU):**
```env
DB_POOL_MAX=10
DB_POOL_MIN=2
```

**Render Standard (2 GB RAM, 1 CPU):**
```env
DB_POOL_MAX=20
DB_POOL_MIN=5
```

**Render Pro (4 GB RAM, 2 CPU):**
```env
DB_POOL_MAX=30
DB_POOL_MIN=5
```

### Pool Monitoring

The health check endpoint exposes connection pool statistics:

```json
{
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 15,
      "details": {
        "total": 5,
        "idle": 3,
        "waiting": 0
      }
    }
  }
}
```

**Pool Statistics:**
- `total`: Total number of connections in the pool
- `idle`: Number of idle connections available
- `waiting`: Number of requests waiting for a connection

**Warning Signs:**
- `waiting > 0`: Pool exhaustion, consider increasing `DB_POOL_MAX`
- `idle = 0`: All connections in use, may need more capacity
- `total = max`: Pool at capacity, monitor for bottlenecks

## Health Check Integration

### Requirement 2.3: Database Connectivity Verification

The application verifies database connectivity through multiple mechanisms:

### 1. Startup Verification

The application validates the database connection on startup:
```typescript
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}
```

### 2. Health Check Endpoint

**Endpoint:** `GET /health`

The health check performs a connectivity test:
```typescript
await pool.query('SELECT 1');
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 15,
      "details": {
        "total": 5,
        "idle": 3,
        "waiting": 0
      }
    }
  }
}
```

**Status Codes:**
- `200`: Database healthy or degraded (Redis unavailable)
- `503`: Database unhealthy (connection failed)

### 3. Render Health Check Configuration

Configure in Render dashboard:
- **Health Check Path:** `/health`
- **Health Check Interval:** 30 seconds
- **Failure Threshold:** 3 consecutive failures
- **Success Threshold:** 2 consecutive successes

## Environment Variables

### Required Variables

```env
# Database connection string (Neon)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Node environment (enables production optimizations)
NODE_ENV=production
```

### Optional Pool Configuration

```env
# Connection pool settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000
```

### Optional Monitoring

```env
# Query monitoring
DB_QUERY_MONITORING_ENABLED=true
DB_SLOW_QUERY_THRESHOLD=1000
DB_LOG_SLOW_QUERIES=true
```

## Neon-Specific Configuration

### Serverless PostgreSQL

Neon provides serverless PostgreSQL with:
- **Automatic scaling:** Scales to zero when idle
- **Connection pooling:** Built-in connection pooling
- **Branching:** Database branching for development/staging
- **Point-in-time recovery:** Automatic backups

### Best Practices

1. **Use connection pooling:** Always use the pool, not direct connections
2. **Keep pool size reasonable:** Start with 10, adjust based on load
3. **Monitor pool statistics:** Check health endpoint regularly
4. **Use SSL:** Always enable SSL in production
5. **Set timeouts:** Configure appropriate connection timeouts

### Connection String Format

```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Example:**
```
postgresql://myuser:mypassword@ep-cool-darkness-123456.us-east-2.aws.neon.tech/reporadar?sslmode=require
```

## Error Handling

### Connection Errors

The application handles connection errors gracefully:

```typescript
pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});
```

**Common Errors:**

1. **Connection timeout:**
   - Cause: Network issues or database unavailable
   - Solution: Check DATABASE_URL, verify Neon service status

2. **SSL certificate error:**
   - Cause: Invalid or expired SSL certificate
   - Solution: Ensure `sslmode=require` in connection string

3. **Pool exhausted:**
   - Cause: Too many concurrent connections
   - Solution: Increase `DB_POOL_MAX` or optimize queries

4. **Authentication failed:**
   - Cause: Invalid credentials
   - Solution: Verify DATABASE_URL credentials

### Graceful Shutdown

The application closes database connections gracefully on shutdown:

```typescript
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('Database pool closed');
}
```

This ensures:
- Active queries complete before shutdown
- Connections are properly closed
- No connection leaks

## Monitoring and Alerts

### Key Metrics

Monitor these database metrics:

1. **Response Time:** Should be < 100ms for healthy status
2. **Pool Utilization:** `total / max` should be < 80%
3. **Waiting Connections:** Should be 0 under normal load
4. **Error Rate:** Should be < 1%

### Alert Thresholds

Configure alerts for:
- Response time > 1000ms (slow queries)
- Pool utilization > 90% (capacity issues)
- Waiting connections > 5 (pool exhaustion)
- Health check failures (connectivity issues)

## Troubleshooting

### Issue: Health Check Fails

**Symptoms:** `/health` returns 503 status

**Causes:**
1. Database connection string incorrect
2. Network connectivity issues
3. Neon service unavailable
4. SSL configuration mismatch

**Solutions:**
1. Verify `DATABASE_URL` in Render environment variables
2. Test connection from local machine: `psql $DATABASE_URL -c "SELECT 1"`
3. Check Neon dashboard for service status
4. Ensure `sslmode=require` in connection string

### Issue: Slow Database Queries

**Symptoms:** Response time > 100ms in health check

**Causes:**
1. Missing indexes
2. Complex queries
3. High database load
4. Network latency

**Solutions:**
1. Enable slow query logging: `DB_LOG_SLOW_QUERIES=true`
2. Review slow query logs
3. Add indexes for frequently queried columns
4. Optimize query patterns
5. Consider upgrading Neon plan

### Issue: Pool Exhaustion

**Symptoms:** `waiting > 0` in pool statistics

**Causes:**
1. Pool size too small
2. Long-running queries
3. Connection leaks
4. High concurrent load

**Solutions:**
1. Increase `DB_POOL_MAX`
2. Optimize slow queries
3. Review connection usage patterns
4. Scale horizontally (multiple instances)

## Testing

### Local Testing with Production Settings

Test production configuration locally:

```bash
# Set production environment
export NODE_ENV=production
export DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Build and start
npm run build
npm run start

# Test health endpoint
curl http://localhost:3000/health
```

### Verify SSL Connection

```bash
# Test SSL connection
psql "$DATABASE_URL" -c "SELECT version();"
```

### Load Testing

Test connection pool under load:

```bash
# Run performance tests
npm run test:performance

# Run load tests
npm run test:load
```

## Migration Strategy

### Running Migrations

Migrations should be run before deployment:

```bash
# Push schema changes to database
npm run db:push
```

### Deployment Process

1. **Pre-deployment:** Run migrations on staging branch
2. **Deployment:** Deploy application code
3. **Post-deployment:** Verify health check passes
4. **Rollback:** If issues occur, rollback and investigate

### Zero-Downtime Migrations

For production migrations:
1. Use Neon branching for testing
2. Run migrations on a branch first
3. Test thoroughly
4. Merge to main branch
5. Deploy application

## References

- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL Connection Pooling](https://node-postgres.com/features/pooling)
- [Render Health Checks](https://render.com/docs/health-checks)
