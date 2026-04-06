# Performance Testing Quick Start Guide

## Overview

This guide provides quick instructions for running performance and load tests on RepoRadar.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running
- Redis running (optional, for job queue and session tests)
- Application built and ready to run

## Quick Start

### Option 1: Automated Testing (Recommended)

The automated scripts will start the server, run tests, and stop the server automatically.

**Windows (PowerShell):**
```powershell
.\scripts\run-performance-tests.ps1
```

**Linux/Mac (Bash):**
```bash
./scripts/run-performance-tests.sh
```

**Using npm:**
```bash
# Windows
npm run test:load:windows

# Linux/Mac
npm run test:load:unix
```

### Option 2: Manual Testing

If you prefer to manage the server yourself:

**Step 1: Start the server**
```bash
npm run dev
```

**Step 2: Run tests (in another terminal)**
```bash
npm run test:load
```

## Test Options

### Run Specific Test Patterns

**Test only concurrent users:**
```bash
npm run test:load -- -t "Concurrent User"
```

**Test only job queue:**
```bash
npm run test:load -- -t "Job Queue"
```

**Test only analytics:**
```bash
npm run test:load -- -t "Analytics"
```

**Test only multi-instance:**
```bash
npm run test:load -- -t "Multi-Instance"
```

### Test Against Different URLs

**Custom base URL:**
```bash
TEST_BASE_URL=http://localhost:8080 npm run test:load
```

**With PowerShell script:**
```powershell
.\scripts\run-performance-tests.ps1 -BaseUrl http://localhost:8080
```

**With Bash script:**
```bash
./scripts/run-performance-tests.sh --base-url http://localhost:8080
```

## Multi-Instance Testing

To test with multiple instances:

**Step 1: Start multi-instance deployment**
```bash
cd docker
docker-compose -f docker-compose.multi-instance.yml up
```

**Step 2: Run tests against load balancer**
```bash
TEST_BASE_URL=http://localhost:8080 npm run test:load
```

## Understanding Test Results

### Console Output

Tests provide detailed progress and results:

```
🚀 Starting load test: 100 Concurrent Users
   Concurrency: 100, Total Requests: 500
   Progress: 100% (500/500)
✅ Load test completed
   Duration: 12.45s
   Success Rate: 98.40%
   Avg Response Time: 245ms
   P95 Response Time: 890ms
   Requests/sec: 40.16
```

### Key Metrics

- **Success Rate**: Percentage of successful requests (target: > 95%)
- **Avg Response Time**: Average time to complete requests (target: < 2s)
- **P95 Response Time**: 95th percentile response time (target: < 5s)
- **Requests/sec**: Throughput (target: > 10 req/s)
- **Error Rate**: Percentage of failed requests (target: < 5%)

### Performance Thresholds

| Test | Error Rate | Avg Response | P95 Response | Throughput |
|------|-----------|--------------|--------------|------------|
| Concurrent Users | < 5% | < 2s | < 5s | > 10 req/s |
| Job Queue | < 10% | < 1s | < 3s | > 5 req/s |
| Analytics | < 15% | < 1s | < 3s | > 10 events/s |
| Multi-Instance | < 5% | < 500ms | < 2s | > 20 req/s |

## Test Categories

### 1. Concurrent User Load Testing

Simulates 100 concurrent users making various API requests:
- Health checks
- Repository searches
- Analysis requests

**What it tests:**
- API endpoint performance
- Database query efficiency
- Cache effectiveness
- Error handling under load

### 2. Job Queue Load Testing

Creates and tracks 100 concurrent background jobs:
- Job creation
- Job status tracking
- Job processing

**What it tests:**
- Job queue scalability
- Redis performance
- Worker processing capacity
- Job status API performance

### 3. Analytics Load Testing

Sends 1000 analytics events over 60 seconds:
- Event tracking
- Async processing
- Database writes

**What it tests:**
- Analytics throughput
- Async event processing
- Database write performance
- Event batching efficiency

### 4. Multi-Instance Load Distribution

Tests load balancing across multiple instances:
- Instance detection
- Load distribution
- Session consistency

**What it tests:**
- Load balancer configuration
- Session sharing via Redis
- Instance health
- Request distribution

## Troubleshooting

### Server Not Running

**Error:**
```
❌ Server health check failed
Error: Server is not running
```

**Solution:**
- Use automated scripts (they start the server)
- Or manually start server: `npm run dev`

### High Error Rates

**Symptoms:**
- Error rate > 10%
- Many failed requests

**Solutions:**
1. Check server logs for errors
2. Verify database is running and accessible
3. Check Redis connectivity
4. Ensure adequate system resources
5. Reduce concurrency if system is overloaded

### Slow Response Times

**Symptoms:**
- Average response time > 2s
- P95 response time > 5s

**Solutions:**
1. Check database query performance
2. Verify cache is working
3. Monitor external API calls (GitHub, Gemini)
4. Check for connection pool exhaustion
5. Review server resource usage (CPU, memory)

### Job Queue Tests Failing

**Symptoms:**
```
ℹ️  Job queue endpoint not found
```

**Solution:**
- This is expected if job queue is not fully implemented
- Tests will continue and report appropriately
- Implement job queue endpoints to enable full testing

### Analytics Tests Failing

**Symptoms:**
```
ℹ️  Analytics endpoint not found
```

**Solution:**
- This is expected if analytics is not fully implemented
- Tests will continue and report appropriately
- Implement analytics endpoints to enable full testing

### Multi-Instance Not Detected

**Symptoms:**
```
ℹ️  Single instance detected
```

**Solution:**
- This is expected if running single instance
- Deploy with Docker Compose for multi-instance testing
- Ensure load balancer is configured correctly

## CI/CD Integration

### GitHub Actions

Add to `.github/workflows/performance.yml`:

```yaml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run build
      - run: npm start &
      - run: sleep 10
      - run: npm run test:load
```

### GitLab CI

Add to `.gitlab-ci.yml`:

```yaml
performance-tests:
  stage: test
  services:
    - postgres:15
    - redis:7
  script:
    - npm ci
    - npm run build
    - npm start &
    - sleep 10
    - npm run test:load
  only:
    - schedules
```

## Best Practices

### Before Running Tests

1. **Clean environment**: Start with fresh database and cache
2. **Adequate resources**: Ensure sufficient CPU, memory, and connections
3. **Baseline metrics**: Run tests on known-good state for comparison
4. **Monitor resources**: Watch CPU, memory, and network during tests

### During Tests

1. **Don't interfere**: Let tests run without manual intervention
2. **Monitor logs**: Watch for errors or warnings
3. **Check resources**: Ensure system isn't overloaded
4. **Note anomalies**: Document any unusual behavior

### After Tests

1. **Review metrics**: Compare against thresholds and baselines
2. **Analyze errors**: Investigate any failures or high error rates
3. **Identify bottlenecks**: Look for slow queries or endpoints
4. **Document results**: Save metrics for trend analysis
5. **Optimize**: Address any performance issues found

## Performance Optimization Tips

### Database

- Add indexes for frequently queried columns
- Optimize slow queries
- Increase connection pool size
- Enable query result caching

### Caching

- Increase Redis cache TTL for stable data
- Implement cache warming for critical data
- Monitor cache hit rates
- Use cache for expensive computations

### Application

- Enable compression for responses
- Implement request batching
- Use async processing for heavy operations
- Optimize external API calls

### Infrastructure

- Add more instances for horizontal scaling
- Configure load balancer properly
- Use CDN for static assets
- Enable auto-scaling based on metrics

## Monitoring in Production

### Key Metrics to Track

1. **Response Times**: P50, P95, P99
2. **Error Rates**: Overall and by endpoint
3. **Throughput**: Requests per second
4. **Resource Usage**: CPU, memory, connections
5. **Cache Performance**: Hit rate, evictions
6. **Job Queue**: Queue depth, processing time

### Alerting Thresholds

- **Critical**: Error rate > 10%, P95 > 5s
- **Warning**: Error rate > 5%, P95 > 2s
- **Info**: Throughput < 10 req/s

## Additional Resources

- **Detailed Documentation**: `TASK_26_PERFORMANCE_LOAD_TESTING.md`
- **Verification Checklist**: `TASK_26_VERIFICATION_CHECKLIST.md`
- **Test Implementation**: `tests/PerformanceLoad.test.ts`
- **Helper Scripts**: `scripts/run-performance-tests.*`

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review server logs for errors
3. Verify all prerequisites are met
4. Check system resources
5. Consult detailed documentation

## Summary

Performance testing is essential for ensuring RepoRadar can handle production load. Run these tests regularly to:

- Validate performance under load
- Catch performance regressions early
- Identify optimization opportunities
- Ensure scalability readiness
- Build confidence in production deployment

Happy testing! 🚀
