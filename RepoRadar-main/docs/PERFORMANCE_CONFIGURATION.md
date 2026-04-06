# Performance Configuration Guide

This document provides comprehensive guidance on configuring RepoRadar's performance optimization features.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Files](#configuration-files)
3. [Environment Variables](#environment-variables)
4. [Database Performance](#database-performance)
5. [Cache Configuration](#cache-configuration)
6. [Compression Settings](#compression-settings)
7. [GitHub API Optimization](#github-api-optimization)
8. [Frontend Performance](#frontend-performance)
9. [Monitoring and Alerting](#monitoring-and-alerting)
10. [Fallback Configuration](#fallback-configuration)
11. [Deployment Options](#deployment-options)
12. [Troubleshooting](#troubleshooting)

## Overview

RepoRadar includes comprehensive performance optimization features across three main areas:

- **Database Performance**: Connection pooling, query monitoring, and indexing
- **API Performance**: Response caching, compression, and GitHub API optimization
- **Frontend Performance**: Code splitting, lazy loading, and bundle optimization

All performance features can be configured through environment variables or the centralized configuration system.

## Configuration Files

### Main Configuration File

The primary configuration is managed through `config/performance.config.ts`:

```typescript
import { PerformanceConfigManager } from './config/performance.config.js';

// Create configuration manager with custom settings
const configManager = new PerformanceConfigManager({
  database: {
    connectionPool: {
      maxConnections: 20
    }
  }
});

// Get specific configuration sections
const dbConfig = configManager.getDatabaseConfig();
const cacheConfig = configManager.getCacheConfig();
```

### Environment Configuration

Copy `.env.example` to `.env` and customize the values:

```bash
cp .env.example .env
```

## Environment Variables

### Database Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_MIN` | `2` | Minimum database connections in pool |
| `DB_POOL_MAX` | `10` | Maximum database connections in pool |
| `DB_POOL_IDLE_TIMEOUT` | `30000` | Connection idle timeout (ms) |
| `DB_POOL_CONNECTION_TIMEOUT` | `5000` | Connection acquisition timeout (ms) |
| `DB_POOL_HEALTH_CHECK_INTERVAL` | `60000` | Health check interval (ms) |
| `DB_QUERY_MONITORING_ENABLED` | `true` | Enable query performance monitoring |
| `DB_SLOW_QUERY_THRESHOLD` | `1000` | Slow query threshold (ms) |
| `DB_AUTO_CREATE_INDEXES` | `true` | Automatically create missing indexes |

### Cache Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CACHE_ENABLED` | `true` | Enable response caching |
| `CACHE_TYPE` | `memory` | Cache type: `memory`, `redis`, or `hybrid` |
| `CACHE_MEMORY_MAX_SIZE` | `100` | Maximum memory cache size (MB) |
| `CACHE_MEMORY_MAX_ENTRIES` | `10000` | Maximum number of cache entries |
| `CACHE_DEFAULT_TTL` | `3600` | Default cache TTL (seconds) |
| `CACHE_COMPRESSION_ENABLED` | `true` | Enable cache entry compression |

### Compression Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPRESSION_ENABLED` | `true` | Enable response compression |
| `COMPRESSION_THRESHOLD` | `1024` | Minimum response size to compress (bytes) |
| `COMPRESSION_ALGORITHMS` | `gzip,brotli` | Supported compression algorithms |
| `COMPRESSION_LEVEL` | `6` | Compression level (1-9 for gzip, 1-11 for brotli) |

### GitHub API Optimization

| Variable | Default | Description |
|----------|---------|-------------|
| `GITHUB_OPTIMIZATION_ENABLED` | `true` | Enable GitHub API optimizations |
| `GITHUB_BATCH_SIZE` | `10` | Number of requests to batch together |
| `GITHUB_BATCH_DELAY` | `100` | Delay between batched requests (ms) |
| `GITHUB_CACHING_ENABLED` | `true` | Enable GitHub API response caching |
| `GITHUB_CACHE_TTL` | `300` | GitHub API cache TTL (seconds) |

### Frontend Performance

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_CODE_SPLITTING_ENABLED` | `true` | Enable code splitting |
| `FRONTEND_LAZY_LOADING_ENABLED` | `true` | Enable lazy loading |
| `FRONTEND_TREE_SHAKING_ENABLED` | `true` | Enable tree shaking |
| `FRONTEND_SERVICE_WORKER_ENABLED` | `false` | Enable service worker caching |

### Monitoring and Alerting

| Variable | Default | Description |
|----------|---------|-------------|
| `PERFORMANCE_MONITORING_ENABLED` | `true` | Enable performance monitoring |
| `PERFORMANCE_ALERTING_ENABLED` | `true` | Enable performance alerting |
| `METRICS_COLLECTION_INTERVAL` | `60` | Metrics collection interval (seconds) |
| `METRICS_RETENTION_DAYS` | `30` | Metrics retention period (days) |

## Database Performance

### Connection Pooling

Configure database connection pooling for optimal performance:

```typescript
// Recommended settings for different environments
const connectionPoolConfig = {
  development: {
    minConnections: 2,
    maxConnections: 5,
    idleTimeoutMs: 30000
  },
  staging: {
    minConnections: 5,
    maxConnections: 15,
    idleTimeoutMs: 60000
  },
  production: {
    minConnections: 10,
    maxConnections: 30,
    idleTimeoutMs: 300000
  }
};
```

### Query Monitoring

Monitor slow queries and optimize performance:

```bash
# Enable query monitoring
DB_QUERY_MONITORING_ENABLED=true
DB_SLOW_QUERY_THRESHOLD=1000  # Log queries > 1 second
DB_LOG_SLOW_QUERIES=true
```

### Index Management

Automatic index creation and optimization:

```bash
# Enable automatic indexing
DB_AUTO_CREATE_INDEXES=true
DB_ANALYZE_QUERIES_ENABLED=true
DB_OPTIMIZATION_INTERVAL_HOURS=24
```

## Cache Configuration

### Memory Cache

Configure in-memory caching:

```bash
CACHE_TYPE=memory
CACHE_MEMORY_MAX_SIZE=256  # 256MB
CACHE_MEMORY_MAX_ENTRIES=50000
CACHE_DEFAULT_TTL=3600     # 1 hour
```

### Redis Cache

Configure Redis for distributed caching:

```bash
CACHE_TYPE=redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_KEY_PREFIX=reporadar:
```

### Hybrid Cache

Use both memory and Redis:

```bash
CACHE_TYPE=hybrid
# Memory cache for frequently accessed data
# Redis cache for shared data across instances
```

## Compression Settings

### Response Compression

Configure HTTP response compression:

```bash
COMPRESSION_ENABLED=true
COMPRESSION_THRESHOLD=1024        # Compress responses > 1KB
COMPRESSION_ALGORITHMS=gzip,brotli
COMPRESSION_LEVEL=6               # Balance between speed and ratio
```

### Content Type Exclusions

Exclude certain content types from compression:

```bash
COMPRESSION_EXCLUDE_CONTENT_TYPES=image/*,video/*,audio/*,application/zip
```

## GitHub API Optimization

### Request Batching

Optimize GitHub API usage:

```bash
GITHUB_OPTIMIZATION_ENABLED=true
GITHUB_BATCH_SIZE=10              # Batch up to 10 requests
GITHUB_BATCH_DELAY=100            # 100ms delay between batches
```

### Rate Limit Management

Handle GitHub API rate limits:

```bash
GITHUB_RATE_LIMIT_BUFFER=10       # Reserve 10% of rate limit
GITHUB_MAX_RETRIES=3
GITHUB_BACKOFF_MULTIPLIER=2
GITHUB_MAX_BACKOFF=30000          # Max 30 second backoff
```

### Caching Strategy

Cache GitHub API responses:

```bash
GITHUB_CACHING_ENABLED=true
GITHUB_CACHE_TTL=300              # 5 minute cache
GITHUB_CACHABLE_ENDPOINTS=/repos,/users,/orgs
GITHUB_EXCLUDE_ENDPOINTS=/user/emails,/user/keys
```

## Frontend Performance

### Code Splitting

Configure code splitting strategy:

```bash
FRONTEND_CODE_SPLITTING_ENABLED=true
FRONTEND_CODE_SPLITTING_STRATEGY=hybrid  # route, component, or hybrid
FRONTEND_CHUNK_SIZE_WARNING=1000         # Warn for chunks > 1MB
FRONTEND_PRELOAD_CRITICAL_CHUNKS=true
```

### Lazy Loading

Configure component lazy loading:

```bash
FRONTEND_LAZY_LOADING_ENABLED=true
FRONTEND_LAZY_LOADING_THRESHOLD=0.1      # Load when 10% visible
FRONTEND_LAZY_LOADING_ROOT_MARGIN=50px   # 50px margin
FRONTEND_PRELOAD_DISTANCE=200            # Preload 200px before viewport
```

### Bundle Optimization

Optimize JavaScript bundles:

```bash
FRONTEND_TREE_SHAKING_ENABLED=true
FRONTEND_STATIC_CACHE_DURATION=31536000  # 1 year
FRONTEND_JS_CACHE_DURATION=31536000      # 1 year
FRONTEND_CSS_CACHE_DURATION=31536000     # 1 year
```

## Monitoring and Alerting

### Metrics Collection

Configure performance metrics:

```bash
PERFORMANCE_MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60           # Collect every minute
METRICS_BATCH_SIZE=100                   # Batch 100 metrics
METRICS_RETENTION_DAYS=30                # Keep for 30 days
```

### Alert Thresholds

Set performance alert thresholds:

```bash
PERFORMANCE_ALERTING_ENABLED=true
ALERT_THRESHOLD_DB_QUERY_TIME=1000       # Alert if query > 1s
ALERT_THRESHOLD_API_RESPONSE_TIME=2000   # Alert if API > 2s
ALERT_THRESHOLD_FRONTEND_LOAD_TIME=3000  # Alert if load > 3s
ALERT_THRESHOLD_CACHE_HIT_RATE=80        # Alert if hit rate < 80%
ALERT_THRESHOLD_ERROR_RATE=5             # Alert if error rate > 5%
```

### Alert Channels

Configure alert delivery:

```bash
ALERT_CHANNELS=console,webhook,email
ALERT_WEBHOOK_URL=https://your-webhook-url
ALERT_EMAIL_RECIPIENTS=admin@example.com
```

## Fallback Configuration

### Database Fallbacks

Configure database fallback strategies:

```bash
DB_CONNECTION_POOL_FALLBACK_ENABLED=true
DB_DIRECT_CONNECTION_TIMEOUT=10000       # 10 second timeout
DB_FALLBACK_MAX_RETRY_ATTEMPTS=3
```

### Cache Fallbacks

Configure cache fallback strategies:

```bash
CACHE_FALLBACK_TO_DIRECT_RETRIEVAL=true
CACHE_RECOVERY_BACKOFF=5000              # 5 second backoff
CACHE_MAX_RECOVERY_ATTEMPTS=3
```

### Frontend Fallbacks

Configure frontend fallback strategies:

```bash
FRONTEND_SYNCHRONOUS_FALLBACK_ENABLED=true
FRONTEND_IMMEDIATE_FALLBACK_ENABLED=true
FRONTEND_FALLBACK_TIMEOUT=5000           # 5 second timeout
```

## Deployment Options

### Standard Deployment

Deploy with performance optimizations:

```bash
# Linux/macOS
./scripts/deploy.sh --environment production --performance true

# Windows
.\scripts\deploy.ps1 -Environment production -EnablePerformanceOptimizations $true
```

### Docker Deployment

Deploy using Docker with performance optimizations:

```bash
# Build and run with performance configuration
docker-compose -f docker/docker-compose.performance.yml up -d

# Scale for high availability
docker-compose -f docker/docker-compose.performance.yml up -d --scale reporadar=3
```

### Environment-Specific Configurations

#### Development

```bash
NODE_ENV=development
DB_POOL_MAX=5
CACHE_DEFAULT_TTL=300
COMPRESSION_LEVEL=1
METRICS_RETENTION_DAYS=7
```

#### Staging

```bash
NODE_ENV=staging
DB_POOL_MAX=15
CACHE_DEFAULT_TTL=3600
COMPRESSION_LEVEL=6
METRICS_RETENTION_DAYS=30
```

#### Production

```bash
NODE_ENV=production
DB_POOL_MAX=30
CACHE_DEFAULT_TTL=7200
COMPRESSION_LEVEL=9
METRICS_RETENTION_DAYS=90
```

## Troubleshooting

### Common Issues

#### High Database Connection Usage

```bash
# Increase connection pool size
DB_POOL_MAX=20

# Reduce idle timeout
DB_POOL_IDLE_TIMEOUT=15000

# Enable connection pool fallback
DB_CONNECTION_POOL_FALLBACK_ENABLED=true
```

#### Low Cache Hit Rate

```bash
# Increase cache size
CACHE_MEMORY_MAX_SIZE=512
CACHE_MEMORY_MAX_ENTRIES=100000

# Increase TTL for stable data
CACHE_DEFAULT_TTL=7200

# Enable cache compression
CACHE_COMPRESSION_ENABLED=true
```

#### Slow API Responses

```bash
# Enable compression
COMPRESSION_ENABLED=true
COMPRESSION_THRESHOLD=512

# Optimize GitHub API usage
GITHUB_BATCH_SIZE=15
GITHUB_CACHING_ENABLED=true

# Enable response caching
CACHE_ENABLED=true
```

#### High Frontend Load Times

```bash
# Enable code splitting
FRONTEND_CODE_SPLITTING_ENABLED=true

# Enable lazy loading
FRONTEND_LAZY_LOADING_ENABLED=true

# Enable service worker
FRONTEND_SERVICE_WORKER_ENABLED=true
```

### Performance Monitoring

#### View Performance Metrics

```bash
# Access performance dashboard
curl http://localhost:3000/api/performance/dashboard

# Get specific metrics
curl http://localhost:3000/api/performance/metrics?category=database

# Check health status
curl http://localhost:3000/health
```

#### Log Analysis

```bash
# View performance logs
tail -f logs/performance/performance.log

# Analyze slow queries
grep "slow query" logs/performance/database.log

# Monitor cache performance
grep "cache" logs/performance/cache.log
```

### Configuration Validation

Validate your configuration:

```javascript
const { performanceConfig } = require('./config/performance.config.js');
const validation = performanceConfig.validateConfig();

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
} else {
  console.log('Configuration is valid');
}
```

## Best Practices

1. **Start with defaults**: Use the default configuration and adjust based on monitoring data
2. **Monitor continuously**: Enable performance monitoring in all environments
3. **Test changes**: Validate configuration changes in staging before production
4. **Scale gradually**: Increase limits gradually based on actual usage patterns
5. **Use fallbacks**: Always enable fallback mechanisms for reliability
6. **Regular maintenance**: Review and optimize configuration regularly

## Support

For additional support with performance configuration:

1. Check the [troubleshooting section](#troubleshooting)
2. Review performance logs in `logs/performance/`
3. Monitor metrics at `/api/performance/dashboard`
4. Validate configuration using the built-in validation tools