# Monitoring and Observability Integration Guide

## Overview

This guide explains how to integrate the monitoring and observability system into your application.

## Quick Start

### 1. Add Logging Middleware

Add the logging middleware to your Express application:

```typescript
import express from 'express';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/logging';

const app = express();

// Add logging middleware early in the middleware stack
app.use(loggingMiddleware());

// ... your other middleware and routes ...

// Add error logging middleware after routes
app.use(errorLoggingMiddleware);
```

### 2. Use Structured Logging

Replace console.log with structured logging:

```typescript
import { logger } from './monitoring';

// Before
console.log('User logged in:', userId);

// After
logger.info('User logged in', { userId });
```

### 3. Track Performance

Wrap critical operations with performance tracking:

```typescript
import { trackPerformance } from './monitoring';

// Track async operations
const result = await trackPerformance(
  { name: 'database.query.users', threshold: 100 },
  async () => {
    return await db.query('SELECT * FROM users WHERE id = ?', [userId]);
  }
);

// Track sync operations
import { trackPerformanceSync } from './monitoring';

const result = trackPerformanceSync(
  { name: 'data.transform', threshold: 50 },
  () => {
    return transformData(rawData);
  }
);
```

### 4. Record Custom Metrics

Track application-specific metrics:

```typescript
import { metricsService } from './monitoring';

// Record custom metric
metricsService.recordCustomMetric('cache.hit.rate', hitRate);
metricsService.recordCustomMetric('active.users', activeUserCount);
```

## Advanced Usage

### Correlation ID Tracking

Track requests across services using correlation IDs:

```typescript
import { logger } from './monitoring';

// Correlation IDs are automatically extracted from headers:
// - X-Correlation-Id
// - X-Request-Id

// Or set manually
logger.withCorrelationId(correlationId, () => {
  logger.info('Processing request');
  // All logs within this context include the correlation ID
});
```

### Performance Checkpoints

Track multi-step operations:

```typescript
import { PerformanceCheckpoint } from './monitoring';

async function processOrder(order) {
  const checkpoint = new PerformanceCheckpoint('order.processing');
  
  checkpoint.mark('validation');
  await validateOrder(order);
  
  checkpoint.mark('inventory');
  await checkInventory(order);
  
  checkpoint.mark('payment');
  await processPayment(order);
  
  checkpoint.mark('fulfillment');
  await createFulfillment(order);
  
  checkpoint.complete(); // Logs: validation->inventory, inventory->payment, etc.
}
```

### Manual Performance Timing

Use PerformanceTimer for manual control:

```typescript
import { PerformanceTimer } from './monitoring';

const timer = new PerformanceTimer({
  name: 'batch.processing',
  threshold: 5000, // Warn if > 5 seconds
});

// ... do work ...

const duration = timer.stop(); // Returns duration in ms
console.log(`Processing took ${duration}ms`);
```

### Job Metrics

Track background job performance:

```typescript
import { metricsService } from './monitoring';

async function processJob(job) {
  const startTime = Date.now();
  
  try {
    await job.execute();
    
    metricsService.recordJob({
      jobType: job.type,
      jobId: job.id,
      duration: Date.now() - startTime,
      status: 'completed',
      timestamp: new Date(),
    });
  } catch (error) {
    metricsService.recordJob({
      jobType: job.type,
      jobId: job.id,
      duration: Date.now() - startTime,
      status: 'failed',
      timestamp: new Date(),
    });
    throw error;
  }
}
```

## Metrics API

### Get Response Time Metrics

```typescript
import { metricsService } from './monitoring';

// Get all response times
const metrics = metricsService.getResponseTimeMetrics();

// Get response times for specific path
const apiMetrics = metricsService.getResponseTimeMetrics(
  undefined,
  undefined,
  '/api/users'
);

// Get response times for last hour
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
const recentMetrics = metricsService.getResponseTimeMetrics(oneHourAgo);

console.log(`Average: ${metrics.avg}ms`);
console.log(`P50: ${metrics.p50}ms`);
console.log(`P95: ${metrics.p95}ms`);
console.log(`P99: ${metrics.p99}ms`);
```

### Get Error Metrics

```typescript
import { metricsService } from './monitoring';

const errorRate = metricsService.getErrorRate();

console.log(`Total requests: ${errorRate.totalRequests}`);
console.log(`Total errors: ${errorRate.totalErrors}`);
console.log(`Error rate: ${(errorRate.errorRate * 100).toFixed(2)}%`);
console.log(`Errors by code:`, errorRate.errorsByCode);
```

### Get Job Metrics

```typescript
import { metricsService } from './monitoring';

const jobMetrics = metricsService.getJobMetrics();

console.log(`Total jobs: ${jobMetrics.totalJobs}`);
console.log(`Success rate: ${(jobMetrics.successRate * 100).toFixed(2)}%`);
console.log(`Average duration: ${jobMetrics.avgDuration}ms`);
console.log(`Duration by type:`, jobMetrics.durationByType);
```

### Get All Metrics

```typescript
import { metricsService } from './monitoring';

const allMetrics = metricsService.getAllMetrics();

console.log('Response Times:', allMetrics.responseTimes);
console.log('Errors:', allMetrics.errors);
console.log('Jobs:', allMetrics.jobs);
console.log('Custom:', allMetrics.custom);
```

## Configuration

### Log Level

Set the log level via environment variable:

```bash
# Development
LOG_LEVEL=debug

# Production
LOG_LEVEL=info
```

Supported levels: `debug`, `info`, `warn`, `error`

### Custom Log Handlers

Add custom handlers for external logging services:

```typescript
import { logger } from './monitoring';

// Add handler for external service
logger.addHandler((entry) => {
  // Send to external logging service
  externalLogger.log({
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    context: entry.context,
    correlationId: entry.correlationId,
  });
});
```

## Best Practices

### 1. Use Structured Logging

Always include context in logs:

```typescript
// Good
logger.info('User action completed', {
  userId: user.id,
  action: 'purchase',
  amount: order.total,
});

// Bad
logger.info(`User ${user.id} completed purchase of ${order.total}`);
```

### 2. Set Appropriate Thresholds

Set thresholds based on expected performance:

```typescript
// Database queries should be fast
await trackPerformance(
  { name: 'db.query', threshold: 100 },
  async () => await db.query(sql)
);

// External API calls can be slower
await trackPerformance(
  { name: 'external.api', threshold: 1000 },
  async () => await fetch(url)
);
```

### 3. Use Correlation IDs

Always propagate correlation IDs:

```typescript
// In middleware
const correlationId = req.headers['x-correlation-id'] || generateId();
res.setHeader('X-Correlation-Id', correlationId);

// In service calls
await fetch(url, {
  headers: {
    'X-Correlation-Id': correlationId,
  },
});
```

### 4. Monitor Critical Paths

Focus on operations that impact user experience:

```typescript
// Monitor user-facing operations
await trackPerformance(
  { name: 'user.login', threshold: 500 },
  async () => await authenticateUser(credentials)
);

// Monitor background operations
await trackPerformance(
  { name: 'job.process', threshold: 5000 },
  async () => await processBackgroundJob(job)
);
```

### 5. Clean Up Metrics

Metrics are automatically cleaned up after 24 hours, but you can manually clean up:

```typescript
import { metricsService } from './monitoring';

// Clean up metrics older than 12 hours
const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
// Note: Cleanup is automatic, but you can clear all metrics if needed
metricsService.clear();
```

## Monitoring Dashboard

Create a monitoring endpoint to expose metrics:

```typescript
import express from 'express';
import { metricsService } from './monitoring';

const router = express.Router();

router.get('/metrics', (req, res) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const metrics = {
    responseTimes: metricsService.getResponseTimeMetrics(oneHourAgo),
    errors: metricsService.getErrorRate(oneHourAgo),
    jobs: metricsService.getJobMetrics(oneHourAgo),
    custom: metricsService.getAllMetrics(oneHourAgo).custom,
  };
  
  res.json(metrics);
});

export default router;
```

## Troubleshooting

### High Memory Usage

If metrics are consuming too much memory:

1. Reduce retention time
2. Reduce max metrics count
3. Clear metrics more frequently

### Missing Correlation IDs

If correlation IDs are not appearing in logs:

1. Ensure logging middleware is applied
2. Check that correlation ID is in request headers
3. Verify AsyncLocalStorage is working (Node.js 12.17.0+)

### Performance Overhead

If performance tracking is adding too much overhead:

1. Disable metric recording for non-critical paths
2. Increase thresholds to reduce logging
3. Use sampling for high-frequency operations

## Examples

See `TASK_23_MONITORING_OBSERVABILITY_SUMMARY.md` for more examples and test results.
