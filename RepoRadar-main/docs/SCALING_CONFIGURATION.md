# Scaling Configuration Guide

This guide covers vertical and horizontal scaling options for RepoRadar on Render.

## Overview

RepoRadar supports two scaling approaches:
- **Vertical Scaling**: Increase resources (CPU/RAM) of a single instance
- **Horizontal Scaling**: Run multiple instances with shared state via Redis

## Vertical Scaling

### Available Instance Types on Render

| Type | CPU | RAM | Best For |
|------|-----|-----|----------|
| Starter | 0.5 | 512MB | Development/Testing |
| Standard | 1 | 2GB | Small production workloads |
| Pro | 2 | 4GB | Medium production workloads |
| Pro Plus | 4 | 8GB | High-traffic production |
| Pro Max | 8 | 16GB | Enterprise workloads |

### When to Scale Vertically

Scale up when you observe:
- High CPU usage (>80% sustained)
- Memory pressure or OOM errors
- Slow response times with single instance
- Database connection pool exhaustion

### How to Scale Vertically

1. Go to Render Dashboard
2. Select your web service
3. Navigate to Settings > Instance Type
4. Choose a larger instance type
5. Click Save Changes (triggers redeployment)

### Vertical Scaling Recommendations

**Starter → Standard**
- When traffic exceeds 100 requests/minute
- When memory usage consistently >400MB

**Standard → Pro**
- When CPU usage >70% sustained
- When handling >500 requests/minute
- When running background jobs alongside web server

**Pro → Pro Plus**
- When traffic exceeds 2000 requests/minute
- When running intensive AI analysis operations
- When database queries become CPU-bound

**Pro Plus → Pro Max**
- Enterprise workloads with >5000 requests/minute
- Heavy concurrent AI processing
- Large-scale batch operations

## Horizontal Scaling

### Prerequisites

Horizontal scaling requires Redis for shared state:
- Session storage
- Cache coordination
- WebSocket adapter
- Job queue coordination

### Redis Setup

1. **Add Redis Service on Render**
   - Create new Redis instance
   - Choose appropriate plan (Starter: 25MB, Standard: 100MB, Pro: 1GB)
   - Note the Internal Redis URL

2. **Configure Environment Variables**
```
REDIS_URL=redis://red-xxxxx:6379
ENABLE_REDIS=true
```

3. **Verify Redis Connection**
```bash
npm run health:check
```

### Enabling Horizontal Scaling

1. **Update Instance Count**
   - Go to Render Dashboard → Your Service → Settings
   - Set "Number of Instances" to desired count (2-10)
   - Click Save Changes

2. **Verify Multi-Instance Setup**
```bash
# Check health endpoint shows Redis enabled
curl https://your-app.onrender.com/health

# Should show:
# "redis": { "status": "connected", "mode": "redis" }
```

### Load Balancing Behavior

Render automatically load balances across instances:

**Round-Robin Distribution**
- Requests distributed evenly across instances
- No sticky sessions needed (sessions in Redis)
- WebSocket connections balanced via Redis adapter

**Health Check Integration**
- Unhealthy instances removed from rotation
- Health checks run every 30 seconds
- Failed instances automatically restarted

**Connection Handling**
- Each instance maintains own database pool
- Redis connections pooled per instance
- WebSocket connections coordinated via Redis

## Auto-Scaling Configuration

### Render Auto-Scaling

Render supports auto-scaling on Pro plans and above.

**Configuration Steps:**

1. **Enable Auto-Scaling**
   - Dashboard → Service → Settings → Auto-Scaling
   - Toggle "Enable Auto-Scaling"

2. **Set Scaling Rules**
```
Min Instances: 2
Max Instances: 10
Target CPU: 70%
Target Memory: 80%
```

3. **Configure Scale-Up/Down Behavior**
```
Scale Up When:
- CPU > 70% for 2 minutes
- Memory > 80% for 2 minutes

Scale Down When:
- CPU < 40% for 5 minutes
- Memory < 50% for 5 minutes
```

### Auto-Scaling Recommendations

**Conservative (Cost-Optimized)**
```
Min: 1, Max: 3
CPU Target: 80%
Memory Target: 85%
```
- Best for: Predictable traffic patterns
- Cost: Lower
- Risk: Slower response to spikes

**Balanced (Recommended)**
```
Min: 2, Max: 5
CPU Target: 70%
Memory Target: 80%
```
- Best for: Most production workloads
- Cost: Moderate
- Risk: Good balance

**Aggressive (Performance-Optimized)**
```
Min: 3, Max: 10
CPU Target: 60%
Memory Target: 70%
```
- Best for: High-traffic, latency-sensitive apps
- Cost: Higher
- Risk: Better performance, higher availability

### Scaling Triggers

**CPU-Based Scaling**
- Monitors average CPU across all instances
- Scales up when sustained high usage
- Scales down during low usage periods

**Memory-Based Scaling**
- Monitors memory usage per instance
- Prevents OOM errors
- More aggressive than CPU scaling

**Custom Metrics (Advanced)**
For custom scaling logic, use Render API:
```javascript
// Example: Scale based on queue depth
const queueDepth = await getQueueDepth();
if (queueDepth > 1000) {
  await renderAPI.scaleService(serviceId, { instances: 5 });
}
```

## Scaling Decision Matrix

| Scenario | Vertical | Horizontal | Both |
|----------|----------|------------|------|
| CPU-bound operations | ✓ | | ✓ |
| Memory-intensive tasks | ✓ | | |
| High request volume | | ✓ | ✓ |
| WebSocket connections | | ✓ | |
| Background jobs | ✓ | ✓ | ✓ |
| Database bottleneck | ✓ | | |
| Geographic distribution | | ✓ | |

## Monitoring Scaling Performance

### Key Metrics to Track

1. **Response Time**
```bash
# Should decrease or stay stable after scaling
curl -w "@curl-format.txt" -o /dev/null -s https://your-app.onrender.com/api/health
```

2. **Error Rate**
```bash
# Should remain low (<1%)
# Check Render logs for 5xx errors
```

3. **Resource Utilization**
- CPU: Target 60-70% average
- Memory: Target 70-80% average
- Database connections: <80% of pool

4. **Instance Health**
```bash
# All instances should be healthy
curl https://your-app.onrender.com/health
```

### Scaling Validation Checklist

After scaling changes:

- [ ] All instances pass health checks
- [ ] Response times within acceptable range (<500ms p95)
- [ ] Error rate <1%
- [ ] Redis connection stable across instances
- [ ] Database pool not exhausted
- [ ] WebSocket connections working
- [ ] Session persistence working
- [ ] Background jobs processing
- [ ] No memory leaks over 24 hours

## Cost Optimization

### Right-Sizing Instances

**Over-Provisioned Signs:**
- CPU usage consistently <30%
- Memory usage consistently <50%
- Low request volume (<100/min)

**Under-Provisioned Signs:**
- CPU usage consistently >80%
- Memory usage >90%
- Frequent OOM errors
- Slow response times

### Scaling Cost Comparison

**Scenario: 1000 req/min**

Option 1: Single Pro Plus (/mo)
- 4 CPU, 8GB RAM
- Simple setup
- Single point of failure

Option 2: 2x Pro (/mo each = /mo)
- 2 CPU, 4GB RAM each
- High availability
- Better fault tolerance
- Requires Redis (+/mo)

Option 3: Auto-scale 2-4 Pro (-/mo)
- Scales with demand
- Cost-efficient for variable traffic
- Requires Redis (+/mo)

### Cost-Saving Tips

1. **Use Auto-Scaling**
   - Scale down during off-peak hours
   - Pay only for what you use

2. **Optimize Before Scaling**
   - Enable caching (reduces CPU/DB load)
   - Optimize database queries
   - Use CDN for static assets

3. **Right-Size Redis**
   - Starter (25MB): 1-2 instances
   - Standard (100MB): 3-5 instances
   - Pro (1GB): 6-10 instances

4. **Monitor and Adjust**
   - Review metrics weekly
   - Adjust instance types based on actual usage
   - Remove unused instances

## Troubleshooting Scaling Issues

### Issue: Instances Not Scaling

**Symptoms:**
- Auto-scaling enabled but instance count unchanged
- High CPU/memory but no scale-up

**Solutions:**
1. Check auto-scaling is enabled in dashboard
2. Verify scaling thresholds are appropriate
3. Ensure you're on Pro plan or higher
4. Check Render status page for platform issues

### Issue: Uneven Load Distribution

**Symptoms:**
- Some instances at 90% CPU, others at 20%
- Inconsistent response times

**Solutions:**
1. Verify Redis is properly configured
2. Check for sticky sessions (should be disabled)
3. Ensure health checks are passing on all instances
4. Review WebSocket adapter configuration

### Issue: Session Loss After Scaling

**Symptoms:**
- Users logged out randomly
- Session data not persisting

**Solutions:**
1. Verify REDIS_URL is set correctly
2. Check Redis connection in health endpoint
3. Ensure session store is using Redis
4. Verify Redis instance is not full

### Issue: High Redis Memory Usage

**Symptoms:**
- Redis memory >90%
- Eviction warnings in logs

**Solutions:**
1. Upgrade Redis plan
2. Reduce session TTL
3. Implement cache eviction policies
4. Review what's being stored in Redis

## Best Practices

1. **Start Small, Scale Gradually**
   - Begin with single Standard instance
   - Add horizontal scaling when needed
   - Monitor before making changes

2. **Always Use Redis for Multi-Instance**
   - Required for session persistence
   - Required for WebSocket coordination
   - Required for job queue sharing

3. **Set Appropriate Health Checks**
   - Use /health endpoint
   - Set reasonable timeout (10s)
   - Check critical dependencies

4. **Monitor Continuously**
   - Set up alerts for high CPU/memory
   - Track error rates
   - Monitor response times

5. **Test Scaling Changes**
   - Use staging environment first
   - Verify session persistence
   - Test WebSocket functionality
   - Run load tests

6. **Plan for Peak Traffic**
   - Set max instances above expected peak
   - Use auto-scaling for traffic spikes
   - Keep buffer capacity (20-30%)

7. **Document Your Configuration**
   - Record instance types and counts
   - Document scaling decisions
   - Track cost changes

## Quick Reference

### Scaling Commands

```bash
# Check current configuration
npm run config:summary

# Verify health across instances
curl https://your-app.onrender.com/health

# Test Redis connection
npm run health:check

# Validate production readiness
npm run validate:production
```

### Environment Variables for Scaling

```bash
# Required for horizontal scaling
REDIS_URL=redis://red-xxxxx:6379
ENABLE_REDIS=true

# Optional optimizations
DB_POOL_SIZE=20                    # Per instance
CACHE_TTL=3600                     # 1 hour
SESSION_MAX_AGE=86400000           # 24 hours
```

### Render Dashboard Quick Links

- Instance Type: Settings → Instance Type
- Instance Count: Settings → Scaling
- Auto-Scaling: Settings → Auto-Scaling
- Redis: Dashboard → Redis → Your Instance
- Metrics: Metrics tab
- Logs: Logs tab

## Related Documentation

- [Database Production Config](./DATABASE_PRODUCTION_CONFIG.md)
- [Environment Configuration](./ENVIRONMENT_CONFIGURATION.md)
- [Render Deployment Guide](./RENDER_DEPLOYMENT_GUIDE.md)
- [Production Validation](./PRODUCTION_VALIDATION.md)
- [Graceful Shutdown](./GRACEFUL_SHUTDOWN_GUIDE.md)
