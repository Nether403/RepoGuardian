/**
 * Performance Configuration Management
 * Centralized configuration for all performance optimization settings
 */

export interface PerformanceConfig {
  database: DatabaseConfig;
  cache: CacheConfig;
  compression: CompressionConfig;
  github: GitHubConfig;
  frontend: FrontendConfig;
  monitoring: MonitoringConfig;
  fallback: FallbackConfig;
}

export interface DatabaseConfig {
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

export interface CacheConfig {
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

export interface CompressionConfig {
  enabled: boolean;
  threshold: number; // minimum response size in bytes
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  level: number; // compression level
  chunkSize: number;
  memLevel: number;
  excludeContentTypes: string[];
}

export interface GitHubConfig {
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

export interface FrontendConfig {
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

export interface MonitoringConfig {
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

export interface FallbackConfig {
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

/**
 * Default performance configuration
 */
export const defaultPerformanceConfig: PerformanceConfig = {
  database: {
    connectionPool: {
      minConnections: parseInt(process.env.DB_POOL_MIN || '2'),
      maxConnections: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMs: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMs: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000'),
      healthCheckIntervalMs: parseInt(process.env.DB_POOL_HEALTH_CHECK_INTERVAL || '60000'),
      maxRetries: parseInt(process.env.DB_POOL_MAX_RETRIES || '3'),
    },
    queryMonitoring: {
      enabled: process.env.DB_QUERY_MONITORING_ENABLED !== 'false',
      slowQueryThresholdMs: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000'),
      logSlowQueries: process.env.DB_LOG_SLOW_QUERIES !== 'false',
      retentionDays: parseInt(process.env.DB_METRICS_RETENTION_DAYS || '30'),
    },
    indexing: {
      autoCreateIndexes: process.env.DB_AUTO_CREATE_INDEXES !== 'false',
      analyzeQueriesEnabled: process.env.DB_ANALYZE_QUERIES_ENABLED !== 'false',
      optimizationIntervalHours: parseInt(process.env.DB_OPTIMIZATION_INTERVAL_HOURS || '24'),
    },
  },
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false',
    type: (process.env.CACHE_TYPE as 'memory' | 'redis' | 'hybrid') || 'memory',
    memory: {
      maxSize: parseInt(process.env.CACHE_MEMORY_MAX_SIZE || '100'), // 100MB
      maxEntries: parseInt(process.env.CACHE_MEMORY_MAX_ENTRIES || '10000'),
      defaultTtlSeconds: parseInt(process.env.CACHE_DEFAULT_TTL || '3600'), // 1 hour
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'reporadar:',
    },
    compression: {
      enabled: process.env.CACHE_COMPRESSION_ENABLED !== 'false',
      threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD || '1024'), // 1KB
    },
    invalidation: {
      strategy: (process.env.CACHE_INVALIDATION_STRATEGY as 'time' | 'event' | 'manual') || 'time',
      patterns: (process.env.CACHE_INVALIDATION_PATTERNS || '').split(',').filter(Boolean),
    },
  },
  compression: {
    enabled: process.env.COMPRESSION_ENABLED !== 'false',
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'), // 1KB
    algorithms: (process.env.COMPRESSION_ALGORITHMS || 'gzip,brotli').split(',') as ('gzip' | 'brotli' | 'deflate')[],
    level: parseInt(process.env.COMPRESSION_LEVEL || '6'),
    chunkSize: parseInt(process.env.COMPRESSION_CHUNK_SIZE || '16384'), // 16KB
    memLevel: parseInt(process.env.COMPRESSION_MEM_LEVEL || '8'),
    excludeContentTypes: (process.env.COMPRESSION_EXCLUDE_CONTENT_TYPES || 'image/*,video/*,audio/*').split(','),
  },
  github: {
    optimization: {
      enabled: process.env.GITHUB_OPTIMIZATION_ENABLED !== 'false',
      batchSize: parseInt(process.env.GITHUB_BATCH_SIZE || '10'),
      batchDelayMs: parseInt(process.env.GITHUB_BATCH_DELAY || '100'),
      rateLimitBuffer: parseInt(process.env.GITHUB_RATE_LIMIT_BUFFER || '10'), // 10%
      defaultCacheTtlSeconds: parseInt(process.env.GITHUB_CACHE_TTL || '300'), // 5 minutes
    },
    rateLimit: {
      maxRetries: parseInt(process.env.GITHUB_MAX_RETRIES || '3'),
      backoffMultiplier: parseFloat(process.env.GITHUB_BACKOFF_MULTIPLIER || '2'),
      maxBackoffMs: parseInt(process.env.GITHUB_MAX_BACKOFF || '30000'), // 30 seconds
    },
    caching: {
      enabled: process.env.GITHUB_CACHING_ENABLED !== 'false',
      cachableEndpoints: (process.env.GITHUB_CACHABLE_ENDPOINTS || '/repos,/users,/orgs').split(','),
      excludeEndpoints: (process.env.GITHUB_EXCLUDE_ENDPOINTS || '/user/emails,/user/keys').split(','),
    },
  },
  frontend: {
    codeSplitting: {
      enabled: process.env.FRONTEND_CODE_SPLITTING_ENABLED !== 'false',
      strategy: (process.env.FRONTEND_CODE_SPLITTING_STRATEGY as 'route' | 'component' | 'hybrid') || 'hybrid',
      chunkSizeWarningLimit: parseInt(process.env.FRONTEND_CHUNK_SIZE_WARNING || '1000'), // 1MB
      preloadCriticalChunks: process.env.FRONTEND_PRELOAD_CRITICAL_CHUNKS !== 'false',
    },
    lazyLoading: {
      enabled: process.env.FRONTEND_LAZY_LOADING_ENABLED !== 'false',
      threshold: parseFloat(process.env.FRONTEND_LAZY_LOADING_THRESHOLD || '0.1'),
      rootMargin: process.env.FRONTEND_LAZY_LOADING_ROOT_MARGIN || '50px',
      preloadDistance: parseInt(process.env.FRONTEND_PRELOAD_DISTANCE || '200'),
    },
    bundleOptimization: {
      treeShaking: process.env.FRONTEND_TREE_SHAKING_ENABLED !== 'false',
      minification: process.env.NODE_ENV === 'production',
      sourceMaps: process.env.NODE_ENV !== 'production',
      dropConsole: process.env.NODE_ENV === 'production',
      dropDebugger: process.env.NODE_ENV === 'production',
    },
    caching: {
      staticAssetsCacheDuration: parseInt(process.env.FRONTEND_STATIC_CACHE_DURATION || '31536000'), // 1 year
      jsBundlesCacheDuration: parseInt(process.env.FRONTEND_JS_CACHE_DURATION || '31536000'), // 1 year
      cssCacheDuration: parseInt(process.env.FRONTEND_CSS_CACHE_DURATION || '31536000'), // 1 year
      serviceWorkerEnabled: process.env.FRONTEND_SERVICE_WORKER_ENABLED === 'true',
    },
  },
  monitoring: {
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
    metricsCollection: {
      interval: parseInt(process.env.METRICS_COLLECTION_INTERVAL || '60'), // 1 minute
      batchSize: parseInt(process.env.METRICS_BATCH_SIZE || '100'),
      retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30'),
    },
    alerting: {
      enabled: process.env.PERFORMANCE_ALERTING_ENABLED !== 'false',
      thresholds: {
        databaseQueryTime: parseInt(process.env.ALERT_THRESHOLD_DB_QUERY_TIME || '1000'),
        apiResponseTime: parseInt(process.env.ALERT_THRESHOLD_API_RESPONSE_TIME || '2000'),
        frontendLoadTime: parseInt(process.env.ALERT_THRESHOLD_FRONTEND_LOAD_TIME || '3000'),
        cacheHitRate: parseInt(process.env.ALERT_THRESHOLD_CACHE_HIT_RATE || '80'),
        errorRate: parseInt(process.env.ALERT_THRESHOLD_ERROR_RATE || '5'),
      },
      channels: (process.env.ALERT_CHANNELS || 'console').split(',') as ('console' | 'webhook' | 'email')[],
    },
    dashboard: {
      enabled: process.env.PERFORMANCE_DASHBOARD_ENABLED !== 'false',
      refreshInterval: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL || '30'), // 30 seconds
      historicalDataDays: parseInt(process.env.DASHBOARD_HISTORICAL_DATA_DAYS || '7'),
    },
  },
  fallback: {
    database: {
      connectionPoolFallback: process.env.DB_CONNECTION_POOL_FALLBACK_ENABLED !== 'false',
      directConnectionTimeout: parseInt(process.env.DB_DIRECT_CONNECTION_TIMEOUT || '10000'),
      maxRetryAttempts: parseInt(process.env.DB_FALLBACK_MAX_RETRY_ATTEMPTS || '3'),
    },
    cache: {
      fallbackToDirectRetrieval: process.env.CACHE_FALLBACK_TO_DIRECT_RETRIEVAL !== 'false',
      recoveryBackoffMs: parseInt(process.env.CACHE_RECOVERY_BACKOFF || '5000'),
      maxRecoveryAttempts: parseInt(process.env.CACHE_MAX_RECOVERY_ATTEMPTS || '3'),
    },
    frontend: {
      synchronousFallback: process.env.FRONTEND_SYNCHRONOUS_FALLBACK_ENABLED !== 'false',
      immediateFallback: process.env.FRONTEND_IMMEDIATE_FALLBACK_ENABLED !== 'false',
      fallbackTimeout: parseInt(process.env.FRONTEND_FALLBACK_TIMEOUT || '5000'),
    },
  },
};

/**
 * Configuration manager for performance settings
 */
export class PerformanceConfigManager {
  private config: PerformanceConfig;

  constructor(customConfig?: Partial<PerformanceConfig>) {
    this.config = this.mergeConfigs(defaultPerformanceConfig, customConfig || {});
  }

  /**
   * Get the complete configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig(): DatabaseConfig {
    return { ...this.config.database };
  }

  /**
   * Get cache configuration
   */
  getCacheConfig(): CacheConfig {
    return { ...this.config.cache };
  }

  /**
   * Get compression configuration
   */
  getCompressionConfig(): CompressionConfig {
    return { ...this.config.compression };
  }

  /**
   * Get GitHub optimization configuration
   */
  getGitHubConfig(): GitHubConfig {
    return { ...this.config.github };
  }

  /**
   * Get frontend configuration
   */
  getFrontendConfig(): FrontendConfig {
    return { ...this.config.frontend };
  }

  /**
   * Get monitoring configuration
   */
  getMonitoringConfig(): MonitoringConfig {
    return { ...this.config.monitoring };
  }

  /**
   * Get fallback configuration
   */
  getFallbackConfig(): FallbackConfig {
    return { ...this.config.fallback };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<PerformanceConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  /**
   * Validate configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate database config
    if (this.config.database.connectionPool.minConnections < 1) {
      errors.push('Database minimum connections must be at least 1');
    }
    if (this.config.database.connectionPool.maxConnections < this.config.database.connectionPool.minConnections) {
      errors.push('Database maximum connections must be greater than or equal to minimum connections');
    }

    // Validate cache config
    if (this.config.cache.memory.maxSize < 1) {
      errors.push('Cache memory max size must be at least 1MB');
    }
    if (this.config.cache.memory.maxEntries < 1) {
      errors.push('Cache memory max entries must be at least 1');
    }

    // Validate compression config
    if (this.config.compression.level < 1 || this.config.compression.level > 11) {
      errors.push('Compression level must be between 1 and 11');
    }

    // Validate monitoring config
    if (this.config.monitoring.metricsCollection.interval < 1) {
      errors.push('Metrics collection interval must be at least 1 second');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export configuration to JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(jsonConfig: string): void {
    try {
      const parsedConfig = JSON.parse(jsonConfig);
      this.config = this.mergeConfigs(defaultPerformanceConfig, parsedConfig);
    } catch (error) {
      throw new Error(`Invalid JSON configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deep merge two configuration objects
   */
  private mergeConfigs(base: PerformanceConfig, override: Partial<PerformanceConfig>): PerformanceConfig {
    const result = { ...base };

    for (const key in override) {
      const overrideValue = override[key as keyof PerformanceConfig];
      if (overrideValue !== undefined) {
        if (typeof overrideValue === 'object' && !Array.isArray(overrideValue)) {
          result[key as keyof PerformanceConfig] = {
            ...result[key as keyof PerformanceConfig],
            ...overrideValue,
          } as any;
        } else {
          result[key as keyof PerformanceConfig] = overrideValue as any;
        }
      }
    }

    return result;
  }
}

/**
 * Global configuration manager instance
 */
export const performanceConfig = new PerformanceConfigManager();