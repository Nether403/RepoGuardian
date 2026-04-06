# Performance Configuration System

This directory contains the centralized performance configuration system for RepoRadar.

## Files

- `performance.config.ts` - Main configuration manager and interfaces
- `README.md` - This documentation file

## Quick Start

### 1. Basic Usage

```typescript
import { performanceConfig } from './config/performance.config.js';

// Get complete configuration
const config = performanceConfig.getConfig();

// Get specific configuration sections
const dbConfig = performanceConfig.getDatabaseConfig();
const cacheConfig = performanceConfig.getCacheConfig();
```

### 2. Custom Configuration

```typescript
import { PerformanceConfigManager } from './config/performance.config.js';

// Create custom configuration manager
const customConfig = new PerformanceConfigManager({
  database: {
    connectionPool: {
      maxConnections: 50
    }
  },
  cache: {
    memory: {
      maxSize: 512 // 512MB
    }
  }
});
```

### 3. Environment Variables

All configuration options can be overridden using environment variables. See `.env.example` for a complete list.

```bash
# Database settings
DB_POOL_MAX=20
DB_QUERY_MONITORING_ENABLED=true

# Cache settings
CACHE_ENABLED=true
CACHE_MEMORY_MAX_SIZE=256

# Compression settings
COMPRESSION_ENABLED=true
COMPRESSION_LEVEL=6
```

## Configuration Sections

### Database Configuration

Controls database connection pooling, query monitoring, and indexing:

```typescript
interface DatabaseConfig {
  connectionPool: {
    minConnections: number;
    maxConnections: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
    healthCheckIntervalMs: number;
    maxRetries: number;
  };
  queryMonitoring: {
    enabled: boolean;
    slowQueryThresholdMs: number;
    logSlowQueries: boolean;
    retentionDays: number;
  };
  indexing: {
    autoCreateIndexes: boolean;
    analyzeQueriesEnabled: boolean;
    optimizationIntervalHours: number;
  };
}
```

### Cache Configuration

Controls response caching behavior:

```typescript
interface CacheConfig {
  enabled: boolean;
  type: 'memory' | 'redis' | 'hybrid';
  memory: {
    maxSize: number; // in MB
    maxEntries: number;
    defaultTtlSeconds: number;
  };
  redis: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    keyPrefix: string;
  };
  compression: {
    enabled: boolean;
    threshold: number; // minimum size in bytes to compress
  };
  invalidation: {
    strategy: 'time' | 'event' | 'manual';
    patterns: string[];
  };
}
```

### Compression Configuration

Controls HTTP response compression:

```typescript
interface CompressionConfig {
  enabled: boolean;
  threshold: number; // minimum response size in bytes
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  level: number; // compression level
  chunkSize: number;
  memLevel: number;
  excludeContentTypes: string[];
}
```

### GitHub Configuration

Controls GitHub API optimization:

```typescript
interface GitHubConfig {
  optimization: {
    enabled: boolean;
    batchSize: number;
    batchDelayMs: number;
    rateLimitBuffer: number; // percentage of rate limit to reserve
    defaultCacheTtlSeconds: number;
  };
  rateLimit: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  caching: {
    enabled: boolean;
    cachableEndpoints: string[];
    excludeEndpoints: string[];
  };
}
```

### Frontend Configuration

Controls frontend performance optimizations:

```typescript
interface FrontendConfig {
  codeSplitting: {
    enabled: boolean;
    strategy: 'route' | 'component' | 'hybrid';
    chunkSizeWarningLimit: number;
    preloadCriticalChunks: boolean;
  };
  lazyLoading: {
    enabled: boolean;
    threshold: number; // intersection observer threshold
    rootMargin: string;
    preloadDistance: number; // pixels before viewport
  };
  bundleOptimization: {
    treeShaking: boolean;
    minification: boolean;
    sourceMaps: boolean;
    dropConsole: boolean;
    dropDebugger: boolean;
  };
  caching: {
    staticAssetsCacheDuration: number; // seconds
    jsBundlesCacheDuration: number;
    cssCacheDuration: number;
    serviceWorkerEnabled: boolean;
  };
}
```

### Monitoring Configuration

Controls performance monitoring and alerting:

```typescript
interface MonitoringConfig {
  enabled: boolean;
  metricsCollection: {
    interval: number; // seconds
    batchSize: number;
    retentionDays: number;
  };
  alerting: {
    enabled: boolean;
    thresholds: {
      databaseQueryTime: number; // ms
      apiResponseTime: number; // ms
      frontendLoadTime: number; // ms
      cacheHitRate: number; // percentage
      errorRate: number; // percentage
    };
    channels: ('console' | 'webhook' | 'email')[];
  };
  dashboard: {
    enabled: boolean;
    refreshInterval: number; // seconds
    historicalDataDays: number;
  };
}
```

### Fallback Configuration

Controls graceful degradation strategies:

```typescript
interface FallbackConfig {
  database: {
    connectionPoolFallback: boolean;
    directConnectionTimeout: number; // ms
    maxRetryAttempts: number;
  };
  cache: {
    fallbackToDirectRetrieval: boolean;
    recoveryBackoffMs: number;
    maxRecoveryAttempts: number;
  };
  frontend: {
    synchronousFallback: boolean;
    immediateFallback: boolean;
    fallbackTimeout: number; // ms
  };
}
```

## Configuration Manager Methods

### Getting Configuration

```typescript
// Get complete configuration
const config = performanceConfig.getConfig();

// Get specific sections
const dbConfig = performanceConfig.getDatabaseConfig();
const cacheConfig = performanceConfig.getCacheConfig();
const compressionConfig = performanceConfig.getCompressionConfig();
const githubConfig = performanceConfig.getGitHubConfig();
const frontendConfig = performanceConfig.getFrontendConfig();
const monitoringConfig = performanceConfig.getMonitoringConfig();
const fallbackConfig = performanceConfig.getFallbackConfig();
```

### Updating Configuration

```typescript
// Update specific configuration sections
performanceConfig.updateConfig({
  database: {
    connectionPool: {
      maxConnections: 25
    }
  },
  cache: {
    memory: {
      maxSize: 512
    }
  }
});
```

### Validation

```typescript
// Validate current configuration
const validation = performanceConfig.validateConfig();

if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
} else {
  console.log('Configuration is valid');
}
```

### Import/Export

```typescript
// Export configuration as JSON
const jsonConfig = performanceConfig.exportConfig();
console.log(jsonConfig);

// Import configuration from JSON
const newConfig = '{"database": {"connectionPool": {"maxConnections": 30}}}';
performanceConfig.importConfig(newConfig);
```

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
DB_POOL_MAX=5
CACHE_MEMORY_MAX_SIZE=50
COMPRESSION_LEVEL=1
METRICS_RETENTION_DAYS=7
```

### Staging

```bash
NODE_ENV=staging
DB_POOL_MAX=15
CACHE_MEMORY_MAX_SIZE=128
COMPRESSION_LEVEL=6
METRICS_RETENTION_DAYS=30
```

### Production

```bash
NODE_ENV=production
DB_POOL_MAX=30
CACHE_MEMORY_MAX_SIZE=512
COMPRESSION_LEVEL=9
METRICS_RETENTION_DAYS=90
```

## Validation and Testing

### Validate Configuration

```bash
# Using npm script
npm run config:validate

# Using validation script directly
node scripts/validate-config.js

# Show configuration summary
node scripts/validate-config.js --summary

# Export configuration
node scripts/validate-config.js --export
```

### Test Configuration Changes

```typescript
// Test configuration in development
const testConfig = new PerformanceConfigManager({
  database: {
    connectionPool: {
      maxConnections: 50
    }
  }
});

const validation = testConfig.validateConfig();
if (validation.valid) {
  console.log('Test configuration is valid');
} else {
  console.error('Test configuration errors:', validation.errors);
}
```

## Best Practices

1. **Use Environment Variables**: Configure production settings through environment variables
2. **Validate Configuration**: Always validate configuration before deployment
3. **Start with Defaults**: Use default values and adjust based on monitoring data
4. **Test Changes**: Test configuration changes in staging before production
5. **Monitor Impact**: Monitor the impact of configuration changes on performance
6. **Document Changes**: Document any custom configuration changes

## Troubleshooting

### Common Issues

1. **Invalid Configuration Values**: Use the validation system to identify issues
2. **Environment Variable Conflicts**: Check for conflicting environment variables
3. **Type Mismatches**: Ensure environment variables are properly typed
4. **Missing Dependencies**: Ensure all required dependencies are installed

### Debug Configuration

```typescript
// Debug current configuration
console.log('Current configuration:', performanceConfig.getConfig());

// Debug specific section
console.log('Database config:', performanceConfig.getDatabaseConfig());

// Validate and show errors
const validation = performanceConfig.validateConfig();
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

## Support

For additional support:

1. Check the main documentation: `docs/PERFORMANCE_CONFIGURATION.md`
2. Run the validation script: `node scripts/validate-config.js`
3. Review environment variables in `.env.example`
4. Check the deployment scripts in `scripts/` directory