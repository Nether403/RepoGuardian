/**
 * Environment-Specific Configuration Module
 * Provides type-safe access to environment variables with validation
 * Supports different settings for development/staging/production
 */

import { log } from "../vite";

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production' | 'test';

/**
 * Configuration interface for all environment variables
 */
export interface EnvironmentConfig {
  // Core Application
  nodeEnv: Environment;
  port: number;
  host: string;
  appUrl: string;

  // Database
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
      idleTimeout: number;
      connectionTimeout: number;
      healthCheckInterval: number;
      maxRetries: number;
    };
    monitoring: {
      enabled: boolean;
      slowQueryThreshold: number;
      logSlowQueries: boolean;
      retentionDays: number;
    };
    indexing: {
      autoCreate: boolean;
      analyzeEnabled: boolean;
      optimizationInterval: number;
    };
  };

  // Cache
  cache: {
    enabled: boolean;
    type: 'memory' | 'redis' | 'hybrid';
    memory: {
      maxSize: number;
      maxEntries: number;
      defaultTtl: number;
    };
    redis: {
      url?: string;
      host?: string;
      port?: number;
      password?: string;
      db?: number;
      keyPrefix: string;
    };
    compression: {
      enabled: boolean;
      threshold: number;
    };
  };

  // Session
  session: {
    secret: string;
    encryptionKey: string;
    useRedis: boolean;
    timeout: number;
    regenerateOnLogin: boolean;
    trackMetadata: boolean;
    slidingWindow: boolean;
    suspiciousActivityCheck: boolean;
  };

  // Security
  security: {
    forceHttps: boolean;
    hstsMaxAge: number;
    hstsIncludeSubdomains: boolean;
    hstsPreload: boolean;
    headersEnabled: boolean;
    cspEnabled: boolean;
    cspDirectives: string;
    cookieDomain?: string;
  };

  // Compression
  compression: {
    enabled: boolean;
    threshold: number;
    algorithms: ('gzip' | 'brotli' | 'deflate')[];
    level: number;
    chunkSize: number;
    memLevel: number;
    excludeContentTypes: string[];
  };

  // External APIs
  apis: {
    gemini: {
      apiKey?: string;
    };
    openai: {
      apiKey?: string;
    };
    github: {
      token?: string;
      optimization: {
        enabled: boolean;
        batchSize: number;
        batchDelay: number;
        rateLimitBuffer: number;
        cacheTtl: number;
      };
      rateLimit: {
        maxRetries: number;
        backoffMultiplier: number;
        maxBackoff: number;
      };
      caching: {
        enabled: boolean;
        cachableEndpoints: string[];
        excludeEndpoints: string[];
      };
    };
    stripe?: {
      secretKey: string;
      publishableKey: string;
      webhookSecret: string;
      proPriceId: string;
      enterprisePriceId: string;
    };
  };

  // Authentication
  auth: {
    bcryptRounds: number;
    stackAuth?: {
      projectId: string;
      publishableKey: string;
      secretKey: string;
    };
    email?: {
      resendApiKey: string;
      from: string;
      fromName: string;
      passwordResetUrl: string;
    };
  };

  // Rate Limiting
  rateLimit: {
    storage: 'memory' | 'redis' | 'postgres';
    redisUrl?: string;
    auth: {
      login: { limit: number; window: number };
      signup: { limit: number; window: number };
      reset: { limit: number; window: number };
    };
    api: {
      free: { limit: number; window: number };
      pro: { limit: number; window: number };
    };
    analysis: {
      free: { limit: number; window: number };
      pro: { limit: number; window: number };
    };
  };

  // Performance Monitoring
  monitoring: {
    enabled: boolean;
    metricsCollection: {
      interval: number;
      batchSize: number;
      retentionDays: number;
    };
    alerting: {
      enabled: boolean;
      thresholds: {
        databaseQueryTime: number;
        apiResponseTime: number;
        frontendLoadTime: number;
        cacheHitRate: number;
        errorRate: number;
      };
      channels: ('console' | 'webhook' | 'email')[];
    };
    dashboard: {
      enabled: boolean;
      refreshInterval: number;
      historicalDataDays: number;
    };
  };

  // Feature Flags
  features: {
    loadingStates: boolean;
    errorHandling: boolean;
    analyticsTracking: boolean;
    backgroundJobs: boolean;
    mobileResponsive: boolean;
    accessibility: boolean;
    adminDashboard: boolean;
    healthChecks: boolean;
    horizontalScaling: boolean;
    monitoring: boolean;
  };

  // Frontend
  frontend: {
    codeSplitting: {
      enabled: boolean;
      strategy: 'route' | 'component' | 'hybrid';
      chunkSizeWarning: number;
      preloadCritical: boolean;
    };
    lazyLoading: {
      enabled: boolean;
      threshold: number;
      rootMargin: string;
      preloadDistance: number;
    };
    bundleOptimization: {
      treeShaking: boolean;
      minification: boolean;
      sourceMaps: boolean;
      dropConsole: boolean;
      dropDebugger: boolean;
    };
    caching: {
      staticAssets: number;
      jsBundles: number;
      css: number;
      serviceWorker: boolean;
    };
  };

  // Fallback Configuration
  fallback: {
    database: {
      poolFallback: boolean;
      directConnectionTimeout: number;
      maxRetryAttempts: number;
    };
    cache: {
      fallbackToDirectRetrieval: boolean;
      recoveryBackoff: number;
      maxRecoveryAttempts: number;
    };
    frontend: {
      synchronousFallback: boolean;
      immediateFallback: boolean;
      fallbackTimeout: number;
    };
  };
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Parse boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value !== 'false';
}

/**
 * Parse integer environment variable
 */
function parseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float environment variable
 */
function parseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array environment variable
 */
function parseArray(value: string | undefined, defaultValue: string[]): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(Boolean);
}

/**
 * Get current environment
 */
function getEnvironment(): Environment {
  const env = process.env.NODE_ENV?.toLowerCase();
  if (env === 'production' || env === 'staging' || env === 'test') {
    return env as Environment;
  }
  return 'development';
}

/**
 * Load and parse environment configuration
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  const nodeEnv = getEnvironment();
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';

  return {
    // Core Application
    nodeEnv,
    port: parseInt(process.env.PORT, 5000),
    host: process.env.HOST || '0.0.0.0',
    appUrl: process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`,

    // Database
    database: {
      url: process.env.DATABASE_URL || '',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN, isProduction ? 2 : 1),
        max: parseInt(process.env.DB_POOL_MAX, isProduction ? 10 : 5),
        idleTimeout: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 30000),
        connectionTimeout: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 5000),
        healthCheckInterval: parseInt(process.env.DB_POOL_HEALTH_CHECK_INTERVAL, 60000),
        maxRetries: parseInt(process.env.DB_POOL_MAX_RETRIES, 3),
      },
      monitoring: {
        enabled: parseBoolean(process.env.DB_QUERY_MONITORING_ENABLED, true),
        slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD, 1000),
        logSlowQueries: parseBoolean(process.env.DB_LOG_SLOW_QUERIES, true),
        retentionDays: parseInt(process.env.DB_METRICS_RETENTION_DAYS, 30),
      },
      indexing: {
        autoCreate: parseBoolean(process.env.DB_AUTO_CREATE_INDEXES, true),
        analyzeEnabled: parseBoolean(process.env.DB_ANALYZE_QUERIES_ENABLED, true),
        optimizationInterval: parseInt(process.env.DB_OPTIMIZATION_INTERVAL_HOURS, 24),
      },
    },

    // Cache
    cache: {
      enabled: parseBoolean(process.env.CACHE_ENABLED, true),
      type: (process.env.CACHE_TYPE as 'memory' | 'redis' | 'hybrid') || 'memory',
      memory: {
        maxSize: parseInt(process.env.CACHE_MEMORY_MAX_SIZE, 100),
        maxEntries: parseInt(process.env.CACHE_MEMORY_MAX_ENTRIES, 10000),
        defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL, 3600),
      },
      redis: {
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 6379),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB, 0),
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'reporadar:',
      },
      compression: {
        enabled: parseBoolean(process.env.CACHE_COMPRESSION_ENABLED, true),
        threshold: parseInt(process.env.CACHE_COMPRESSION_THRESHOLD, 1024),
      },
    },

    // Session
    session: {
      secret: process.env.SESSION_SECRET || '',
      encryptionKey: process.env.SESSION_ENCRYPTION_KEY || '',
      useRedis: parseBoolean(process.env.USE_REDIS_SESSIONS, false),
      timeout: parseInt(process.env.SESSION_TIMEOUT, 604800000), // 7 days
      regenerateOnLogin: parseBoolean(process.env.SESSION_REGENERATE_ON_LOGIN, true),
      trackMetadata: parseBoolean(process.env.SESSION_TRACK_METADATA, true),
      slidingWindow: parseBoolean(process.env.SESSION_SLIDING_WINDOW, true),
      suspiciousActivityCheck: parseBoolean(process.env.SESSION_SUSPICIOUS_ACTIVITY_CHECK, true),
    },

    // Security
    security: {
      forceHttps: parseBoolean(process.env.FORCE_HTTPS, isProduction),
      hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE, 31536000),
      hstsIncludeSubdomains: parseBoolean(process.env.HSTS_INCLUDE_SUBDOMAINS, true),
      hstsPreload: parseBoolean(process.env.HSTS_PRELOAD, false),
      headersEnabled: parseBoolean(process.env.SECURITY_HEADERS_ENABLED, true),
      cspEnabled: parseBoolean(process.env.CSP_ENABLED, true),
      cspDirectives: process.env.CSP_DIRECTIVES || "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.github.com https://accounts.google.com https://github.com",
      cookieDomain: process.env.COOKIE_DOMAIN,
    },

    // Compression
    compression: {
      enabled: parseBoolean(process.env.COMPRESSION_ENABLED, true),
      threshold: parseInt(process.env.COMPRESSION_THRESHOLD, 1024),
      algorithms: parseArray(process.env.COMPRESSION_ALGORITHMS, ['gzip', 'brotli']) as ('gzip' | 'brotli' | 'deflate')[],
      level: parseInt(process.env.COMPRESSION_LEVEL, 6),
      chunkSize: parseInt(process.env.COMPRESSION_CHUNK_SIZE, 16384),
      memLevel: parseInt(process.env.COMPRESSION_MEM_LEVEL, 8),
      excludeContentTypes: parseArray(process.env.COMPRESSION_EXCLUDE_CONTENT_TYPES, ['image/*', 'video/*', 'audio/*']),
    },

    // External APIs
    apis: {
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
      },
      github: {
        token: process.env.GITHUB_TOKEN,
        optimization: {
          enabled: parseBoolean(process.env.GITHUB_OPTIMIZATION_ENABLED, true),
          batchSize: parseInt(process.env.GITHUB_BATCH_SIZE, 10),
          batchDelay: parseInt(process.env.GITHUB_BATCH_DELAY, 100),
          rateLimitBuffer: parseInt(process.env.GITHUB_RATE_LIMIT_BUFFER, 10),
          cacheTtl: parseInt(process.env.GITHUB_CACHE_TTL, 300),
        },
        rateLimit: {
          maxRetries: parseInt(process.env.GITHUB_MAX_RETRIES, 3),
          backoffMultiplier: parseFloat(process.env.GITHUB_BACKOFF_MULTIPLIER, 2),
          maxBackoff: parseInt(process.env.GITHUB_MAX_BACKOFF, 30000),
        },
        caching: {
          enabled: parseBoolean(process.env.GITHUB_CACHING_ENABLED, true),
          cachableEndpoints: parseArray(process.env.GITHUB_CACHABLE_ENDPOINTS, ['/repos', '/users', '/orgs']),
          excludeEndpoints: parseArray(process.env.GITHUB_EXCLUDE_ENDPOINTS, ['/user/emails', '/user/keys']),
        },
      },
      stripe: process.env.STRIPE_SECRET_KEY ? {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
        proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
        enterprisePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
      } : undefined,
    },

    // Authentication
    auth: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 12),
      stackAuth: process.env.NEXT_PUBLIC_STACK_PROJECT_ID ? {
        projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID,
        publishableKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || '',
        secretKey: process.env.STACK_SECRET_SERVER_KEY || '',
      } : undefined,
      email: process.env.RESEND_API_KEY ? {
        resendApiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM || 'noreply@reporadar.com',
        fromName: process.env.EMAIL_FROM_NAME || 'RepoRadar',
        passwordResetUrl: process.env.PASSWORD_RESET_URL || `${process.env.APP_URL || 'http://localhost:5000'}/reset-password`,
      } : undefined,
    },

    // Rate Limiting
    rateLimit: {
      storage: (process.env.RATE_LIMIT_STORAGE as 'memory' | 'redis' | 'postgres') || 'memory',
      redisUrl: process.env.RATE_LIMIT_REDIS_URL,
      auth: {
        login: {
          limit: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_LIMIT, 5),
          window: parseInt(process.env.RATE_LIMIT_AUTH_LOGIN_WINDOW, 900000),
        },
        signup: {
          limit: parseInt(process.env.RATE_LIMIT_AUTH_SIGNUP_LIMIT, 3),
          window: parseInt(process.env.RATE_LIMIT_AUTH_SIGNUP_WINDOW, 3600000),
        },
        reset: {
          limit: parseInt(process.env.RATE_LIMIT_AUTH_RESET_LIMIT, 3),
          window: parseInt(process.env.RATE_LIMIT_AUTH_RESET_WINDOW, 3600000),
        },
      },
      api: {
        free: {
          limit: parseInt(process.env.RATE_LIMIT_API_FREE_LIMIT, 100),
          window: parseInt(process.env.RATE_LIMIT_API_FREE_WINDOW, 3600000),
        },
        pro: {
          limit: parseInt(process.env.RATE_LIMIT_API_PRO_LIMIT, 1000),
          window: parseInt(process.env.RATE_LIMIT_API_PRO_WINDOW, 3600000),
        },
      },
      analysis: {
        free: {
          limit: parseInt(process.env.RATE_LIMIT_ANALYSIS_FREE_LIMIT, 10),
          window: parseInt(process.env.RATE_LIMIT_ANALYSIS_FREE_WINDOW, 86400000),
        },
        pro: {
          limit: parseInt(process.env.RATE_LIMIT_ANALYSIS_PRO_LIMIT, 100),
          window: parseInt(process.env.RATE_LIMIT_ANALYSIS_PRO_WINDOW, 86400000),
        },
      },
    },

    // Performance Monitoring
    monitoring: {
      enabled: parseBoolean(process.env.PERFORMANCE_MONITORING_ENABLED, true),
      metricsCollection: {
        interval: parseInt(process.env.METRICS_COLLECTION_INTERVAL, 60),
        batchSize: parseInt(process.env.METRICS_BATCH_SIZE, 100),
        retentionDays: parseInt(process.env.METRICS_RETENTION_DAYS, 30),
      },
      alerting: {
        enabled: parseBoolean(process.env.PERFORMANCE_ALERTING_ENABLED, true),
        thresholds: {
          databaseQueryTime: parseInt(process.env.ALERT_THRESHOLD_DB_QUERY_TIME, 1000),
          apiResponseTime: parseInt(process.env.ALERT_THRESHOLD_API_RESPONSE_TIME, 2000),
          frontendLoadTime: parseInt(process.env.ALERT_THRESHOLD_FRONTEND_LOAD_TIME, 3000),
          cacheHitRate: parseInt(process.env.ALERT_THRESHOLD_CACHE_HIT_RATE, 80),
          errorRate: parseInt(process.env.ALERT_THRESHOLD_ERROR_RATE, 5),
        },
        channels: parseArray(process.env.ALERT_CHANNELS, ['console']) as ('console' | 'webhook' | 'email')[],
      },
      dashboard: {
        enabled: parseBoolean(process.env.PERFORMANCE_DASHBOARD_ENABLED, true),
        refreshInterval: parseInt(process.env.DASHBOARD_REFRESH_INTERVAL, 30),
        historicalDataDays: parseInt(process.env.DASHBOARD_HISTORICAL_DATA_DAYS, 7),
      },
    },

    // Feature Flags
    features: {
      loadingStates: parseBoolean(process.env.FEATURE_LOADINGSTATES, true),
      errorHandling: parseBoolean(process.env.FEATURE_ERRORHANDLING, true),
      analyticsTracking: parseBoolean(process.env.FEATURE_ANALYTICSTRACKING, true),
      backgroundJobs: parseBoolean(process.env.FEATURE_BACKGROUNDJOBS, true),
      mobileResponsive: parseBoolean(process.env.FEATURE_MOBILERESPONSIVE, true),
      accessibility: parseBoolean(process.env.FEATURE_ACCESSIBILITY, true),
      adminDashboard: parseBoolean(process.env.FEATURE_ADMINDASHBOARD, true),
      healthChecks: parseBoolean(process.env.FEATURE_HEALTHCHECKS, true),
      horizontalScaling: parseBoolean(process.env.FEATURE_HORIZONTALSCALING, true),
      monitoring: parseBoolean(process.env.FEATURE_MONITORING, true),
    },

    // Frontend
    frontend: {
      codeSplitting: {
        enabled: parseBoolean(process.env.FRONTEND_CODE_SPLITTING_ENABLED, true),
        strategy: (process.env.FRONTEND_CODE_SPLITTING_STRATEGY as 'route' | 'component' | 'hybrid') || 'hybrid',
        chunkSizeWarning: parseInt(process.env.FRONTEND_CHUNK_SIZE_WARNING, 1000),
        preloadCritical: parseBoolean(process.env.FRONTEND_PRELOAD_CRITICAL_CHUNKS, true),
      },
      lazyLoading: {
        enabled: parseBoolean(process.env.FRONTEND_LAZY_LOADING_ENABLED, true),
        threshold: parseFloat(process.env.FRONTEND_LAZY_LOADING_THRESHOLD, 0.1),
        rootMargin: process.env.FRONTEND_LAZY_LOADING_ROOT_MARGIN || '50px',
        preloadDistance: parseInt(process.env.FRONTEND_PRELOAD_DISTANCE, 200),
      },
      bundleOptimization: {
        treeShaking: parseBoolean(process.env.FRONTEND_TREE_SHAKING_ENABLED, true),
        minification: isProduction,
        sourceMaps: !isProduction,
        dropConsole: isProduction,
        dropDebugger: isProduction,
      },
      caching: {
        staticAssets: parseInt(process.env.FRONTEND_STATIC_CACHE_DURATION, 31536000),
        jsBundles: parseInt(process.env.FRONTEND_JS_CACHE_DURATION, 31536000),
        css: parseInt(process.env.FRONTEND_CSS_CACHE_DURATION, 31536000),
        serviceWorker: parseBoolean(process.env.FRONTEND_SERVICE_WORKER_ENABLED, false),
      },
    },

    // Fallback Configuration
    fallback: {
      database: {
        poolFallback: parseBoolean(process.env.DB_CONNECTION_POOL_FALLBACK_ENABLED, true),
        directConnectionTimeout: parseInt(process.env.DB_DIRECT_CONNECTION_TIMEOUT, 10000),
        maxRetryAttempts: parseInt(process.env.DB_FALLBACK_MAX_RETRY_ATTEMPTS, 3),
      },
      cache: {
        fallbackToDirectRetrieval: parseBoolean(process.env.CACHE_FALLBACK_TO_DIRECT_RETRIEVAL, true),
        recoveryBackoff: parseInt(process.env.CACHE_RECOVERY_BACKOFF, 5000),
        maxRecoveryAttempts: parseInt(process.env.CACHE_MAX_RECOVERY_ATTEMPTS, 3),
      },
      frontend: {
        synchronousFallback: parseBoolean(process.env.FRONTEND_SYNCHRONOUS_FALLBACK_ENABLED, true),
        immediateFallback: parseBoolean(process.env.FRONTEND_IMMEDIATE_FALLBACK_ENABLED, true),
        fallbackTimeout: parseInt(process.env.FRONTEND_FALLBACK_TIMEOUT, 5000),
      },
    },
  };
}

/**
 * Validate environment configuration
 */
export function validateEnvironmentConfig(config: EnvironmentConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.nodeEnv === 'production';

  // Core validation
  if (!config.database.url) {
    errors.push('DATABASE_URL is required');
  } else if (!config.database.url.startsWith('postgresql://') && !config.database.url.startsWith('postgres://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
  }

  if (!config.session.secret) {
    errors.push('SESSION_SECRET is required');
  } else if (config.session.secret.includes('dev_') || config.session.secret === 'your_session_secret_here_change_in_production') {
    if (isProduction) {
      errors.push('SESSION_SECRET must be changed from default value in production');
    } else {
      warnings.push('SESSION_SECRET is using default value. Change for production.');
    }
  } else if (config.session.secret.length < 32) {
    warnings.push('SESSION_SECRET should be at least 32 characters long');
  }

  if (!config.session.encryptionKey) {
    errors.push('SESSION_ENCRYPTION_KEY is required');
  } else if (config.session.encryptionKey.includes('dev_') || config.session.encryptionKey === 'your_64_char_hex_encryption_key_here_change_in_production') {
    if (isProduction) {
      errors.push('SESSION_ENCRYPTION_KEY must be changed from default value in production');
    } else {
      warnings.push('SESSION_ENCRYPTION_KEY is using default value. Change for production.');
    }
  } else if (config.session.encryptionKey.length !== 64) {
    errors.push('SESSION_ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex-encoded)');
  }

  // Port validation
  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // Database pool validation
  if (config.database.pool.min < 1) {
    errors.push('DB_POOL_MIN must be at least 1');
  }
  if (config.database.pool.max < config.database.pool.min) {
    errors.push('DB_POOL_MAX must be greater than or equal to DB_POOL_MIN');
  }
  if (isProduction && config.database.pool.max < 5) {
    warnings.push('DB_POOL_MAX is low for production. Consider increasing to at least 10.');
  }

  // Cache validation
  if (config.cache.enabled) {
    if (config.cache.type === 'redis' && !config.cache.redis.url && !config.cache.redis.host) {
      errors.push('CACHE_TYPE is set to redis but REDIS_URL or REDIS_HOST is not configured');
    }
    if (config.cache.memory.maxSize < 1) {
      errors.push('CACHE_MEMORY_MAX_SIZE must be at least 1MB');
    }
    if (config.cache.memory.maxEntries < 1) {
      errors.push('CACHE_MEMORY_MAX_ENTRIES must be at least 1');
    }
  }

  // Session storage validation
  if (config.session.useRedis && !config.cache.redis.url && !config.cache.redis.host) {
    errors.push('USE_REDIS_SESSIONS is enabled but REDIS_URL or REDIS_HOST is not configured');
  }

  // Compression validation
  if (config.compression.enabled) {
    if (config.compression.level < 1 || config.compression.level > 11) {
      errors.push('COMPRESSION_LEVEL must be between 1 and 11');
    }
    if (config.compression.algorithms.length === 0) {
      warnings.push('No compression algorithms configured');
    }
  }

  // Authentication validation
  if (config.auth.bcryptRounds < 10 || config.auth.bcryptRounds > 15) {
    warnings.push('BCRYPT_ROUNDS should be between 10 and 15 (default: 12)');
  }

  if (config.auth.stackAuth) {
    if (!config.auth.stackAuth.projectId) {
      errors.push('NEXT_PUBLIC_STACK_PROJECT_ID is required when Stack Auth is configured');
    }
    if (!config.auth.stackAuth.publishableKey) {
      errors.push('NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY is required when Stack Auth is configured');
    }
    if (!config.auth.stackAuth.secretKey) {
      errors.push('STACK_SECRET_SERVER_KEY is required when Stack Auth is configured');
    }
  }

  if (config.auth.email) {
    if (!config.auth.email.resendApiKey) {
      errors.push('RESEND_API_KEY is required when email service is configured');
    }
    if (!config.auth.email.from) {
      errors.push('EMAIL_FROM is required when email service is configured');
    }
    try {
      new URL(config.auth.email.passwordResetUrl);
    } catch {
      errors.push('PASSWORD_RESET_URL must be a valid URL');
    }
  }

  // Rate limiting validation
  if (config.rateLimit.storage === 'redis' && !config.rateLimit.redisUrl) {
    errors.push('RATE_LIMIT_STORAGE is set to redis but RATE_LIMIT_REDIS_URL is not configured');
  }

  // Stripe validation
  if (config.apis.stripe) {
    const isTestKey = config.apis.stripe.secretKey.startsWith('sk_test_');
    const isProdKey = config.apis.stripe.secretKey.startsWith('sk_live_');

    if (!isTestKey && !isProdKey) {
      errors.push('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
    }

    if (isProduction && isTestKey) {
      warnings.push('Using Stripe test keys in production environment');
    }

    if (!isProduction && isProdKey) {
      warnings.push('Using Stripe live keys in non-production environment');
    }

    if (!config.apis.stripe.publishableKey) {
      errors.push('STRIPE_PUBLISHABLE_KEY is required when Stripe is configured');
    }
    if (!config.apis.stripe.webhookSecret) {
      errors.push('STRIPE_WEBHOOK_SECRET is required when Stripe is configured');
    }
    if (!config.apis.stripe.proPriceId) {
      warnings.push('STRIPE_PRO_PRICE_ID is not configured');
    }
    if (!config.apis.stripe.enterprisePriceId) {
      warnings.push('STRIPE_ENTERPRISE_PRICE_ID is not configured');
    }
  }

  // Production-specific validations
  if (isProduction) {
    if (!config.security.forceHttps) {
      warnings.push('FORCE_HTTPS should be enabled in production');
    }

    if (!config.apis.gemini.apiKey && !config.apis.openai.apiKey) {
      errors.push('At least one AI API key (GEMINI_API_KEY or OPENAI_API_KEY) is required in production');
    }

    if (!config.auth.email) {
      warnings.push('Email service (RESEND_API_KEY) is not configured. Password reset will not work.');
    }

    if (config.rateLimit.storage === 'memory') {
      warnings.push('Using memory-based rate limiting in production. Consider using Redis for multi-instance deployments.');
    }

    if (!config.session.useRedis && config.features.horizontalScaling) {
      warnings.push('Redis sessions are not enabled but horizontal scaling is enabled. Consider enabling Redis sessions for multi-instance deployments.');
    }

    if (!config.apis.stripe) {
      warnings.push('Stripe is not configured. Payment processing will not be available.');
    }

    if (!config.appUrl || config.appUrl.includes('localhost')) {
      warnings.push('APP_URL should be set to production domain');
    }

    if (config.database.pool.max < 10) {
      warnings.push('Consider increasing DB_POOL_MAX to at least 10 for production workloads');
    }
  }

  // Development-specific warnings
  if (!isProduction) {
    if (config.security.forceHttps) {
      warnings.push('FORCE_HTTPS is enabled in development. This may cause issues with localhost.');
    }
  }

  // Monitoring validation
  if (config.monitoring.enabled) {
    if (config.monitoring.metricsCollection.interval < 1) {
      errors.push('METRICS_COLLECTION_INTERVAL must be at least 1 second');
    }
    if (config.monitoring.metricsCollection.batchSize < 1) {
      errors.push('METRICS_BATCH_SIZE must be at least 1');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log configuration summary
 */
export function logConfigurationSummary(config: EnvironmentConfig): void {
  log('\n' + '='.repeat(70));
  log('⚙️  ENVIRONMENT CONFIGURATION');
  log('='.repeat(70));
  log(`Environment: ${config.nodeEnv.toUpperCase()}`);
  log(`Port: ${config.port}`);
  log(`Host: ${config.host}`);
  log(`App URL: ${config.appUrl}`);
  log('');

  log('Database:');
  log(`  Pool: ${config.database.pool.min}-${config.database.pool.max} connections`);
  log(`  Monitoring: ${config.database.monitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  Auto-indexing: ${config.database.indexing.autoCreate ? '✅ Enabled' : '❌ Disabled'}`);
  log('');

  log('Cache:');
  log(`  Type: ${config.cache.type}`);
  log(`  Enabled: ${config.cache.enabled ? '✅ Yes' : '❌ No'}`);
  if (config.cache.type === 'redis' || config.cache.type === 'hybrid') {
    log(`  Redis: ${config.cache.redis.url ? '✅ Configured' : '❌ Not configured'}`);
  }
  log('');

  log('Session:');
  log(`  Storage: ${config.session.useRedis ? 'Redis' : 'PostgreSQL'}`);
  log(`  Timeout: ${(config.session.timeout / 86400000).toFixed(0)} days`);
  log(`  Regenerate on login: ${config.session.regenerateOnLogin ? '✅ Yes' : '❌ No'}`);
  log(`  Track metadata: ${config.session.trackMetadata ? '✅ Yes' : '❌ No'}`);
  log('');

  log('Security:');
  log(`  HTTPS enforcement: ${config.security.forceHttps ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  Security headers: ${config.security.headersEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  CSP: ${config.security.cspEnabled ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  HSTS max age: ${(config.security.hstsMaxAge / 86400).toFixed(0)} days`);
  log('');

  log('External APIs:');
  log(`  Gemini: ${config.apis.gemini.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  log(`  OpenAI: ${config.apis.openai.apiKey ? '✅ Configured' : '❌ Not configured'}`);
  log(`  GitHub: ${config.apis.github.token ? '✅ Configured' : '❌ Not configured'}`);
  log(`  Stripe: ${config.apis.stripe ? '✅ Configured' : '❌ Not configured'}`);
  log('');

  log('Authentication:');
  log(`  Bcrypt rounds: ${config.auth.bcryptRounds}`);
  log(`  Stack Auth: ${config.auth.stackAuth ? '✅ Configured' : '❌ Not configured'}`);
  log(`  Email service: ${config.auth.email ? '✅ Configured' : '❌ Not configured'}`);
  log('');

  log('Rate Limiting:');
  log(`  Storage: ${config.rateLimit.storage}`);
  log(`  Login attempts: ${config.rateLimit.auth.login.limit} per ${(config.rateLimit.auth.login.window / 60000).toFixed(0)} minutes`);
  log(`  API (free): ${config.rateLimit.api.free.limit} per hour`);
  log(`  API (pro): ${config.rateLimit.api.pro.limit} per hour`);
  log('');

  log('Performance:');
  log(`  Compression: ${config.compression.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  Monitoring: ${config.monitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  log(`  Dashboard: ${config.monitoring.dashboard.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  log('');

  log('Feature Flags:');
  const features = Object.entries(config.features)
    .map(([key, value]) => `  ${key.padEnd(20)} ${value ? '✅ Enabled' : '❌ Disabled'}`)
    .join('\n');
  log(features);

  log('='.repeat(70) + '\n');
}

/**
 * Get feature status for runtime checks
 */
export function getFeatureStatus(config: EnvironmentConfig) {
  return {
    oauth: {
      enabled: !!config.auth.stackAuth,
      providers: {
        google: !!config.auth.stackAuth,
        github: !!config.auth.stackAuth,
      },
    },
    passwordReset: {
      enabled: !!config.auth.email,
      emailService: config.auth.email ? 'resend' : 'none',
    },
    stripe: {
      enabled: !!config.apis.stripe,
      mode: config.apis.stripe?.secretKey.startsWith('sk_test_') ? 'test' : 'live',
      proPriceId: config.apis.stripe?.proPriceId,
      enterprisePriceId: config.apis.stripe?.enterprisePriceId,
    },
    rateLimiting: {
      enabled: true,
      storage: config.rateLimit.storage,
      redis: !!config.rateLimit.redisUrl,
    },
    https: {
      enabled: config.security.forceHttps,
      hsts: config.security.forceHttps,
    },
    sessions: {
      redis: config.session.useRedis,
      regeneration: config.session.regenerateOnLogin,
      metadataTracking: config.session.trackMetadata,
    },
    security: {
      headers: config.security.headersEnabled,
      csp: config.security.cspEnabled,
    },
    cache: {
      enabled: config.cache.enabled,
      type: config.cache.type,
      redis: !!(config.cache.redis.url || config.cache.redis.host),
    },
    monitoring: {
      enabled: config.monitoring.enabled,
      alerting: config.monitoring.alerting.enabled,
      dashboard: config.monitoring.dashboard.enabled,
    },
    ai: {
      gemini: !!config.apis.gemini.apiKey,
      openai: !!config.apis.openai.apiKey,
      fallback: !!(config.apis.gemini.apiKey && config.apis.openai.apiKey),
    },
  };
}

/**
 * Configuration manager class
 */
export class ConfigurationManager {
  private config: EnvironmentConfig;
  private validated: boolean = false;

  constructor() {
    this.config = loadEnvironmentConfig();
  }

  /**
   * Get the complete configuration
   */
  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  /**
   * Get a specific configuration section
   */
  getDatabase() { return { ...this.config.database }; }
  getCache() { return { ...this.config.cache }; }
  getSession() { return { ...this.config.session }; }
  getSecurity() { return { ...this.config.security }; }
  getCompression() { return { ...this.config.compression }; }
  getAPIs() { return { ...this.config.apis }; }
  getAuth() { return { ...this.config.auth }; }
  getRateLimit() { return { ...this.config.rateLimit }; }
  getMonitoring() { return { ...this.config.monitoring }; }
  getFeatures() { return { ...this.config.features }; }
  getFrontend() { return { ...this.config.frontend }; }
  getFallback() { return { ...this.config.fallback }; }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  /**
   * Check if running in staging
   */
  isStaging(): boolean {
    return this.config.nodeEnv === 'staging';
  }

  /**
   * Check if running in test
   */
  isTest(): boolean {
    return this.config.nodeEnv === 'test';
  }

  /**
   * Validate configuration
   */
  validate(): ValidationResult {
    const result = validateEnvironmentConfig(this.config);
    this.validated = result.valid;
    return result;
  }

  /**
   * Initialize configuration with validation
   * Throws error if validation fails
   */
  initialize(): void {
    const result = this.validate();

    if (result.errors.length > 0) {
      log('\n❌ CONFIGURATION ERRORS:\n');
      result.errors.forEach(error => log(`  • ${error}`));
      log('\nPlease fix the above errors before starting the application.\n');
      throw new Error('Configuration validation failed');
    }

    if (result.warnings.length > 0) {
      log('\n⚠️  CONFIGURATION WARNINGS:\n');
      result.warnings.forEach(warning => log(`  • ${warning}`));
      log('');
    }

    logConfigurationSummary(this.config);
    this.validated = true;
  }

  /**
   * Check if configuration has been validated
   */
  isValidated(): boolean {
    return this.validated;
  }

  /**
   * Reload configuration from environment
   */
  reload(): void {
    this.config = loadEnvironmentConfig();
    this.validated = false;
  }

  /**
   * Export configuration as JSON
   */
  export(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Get environment-specific settings
   */
  getEnvironmentSettings() {
    const env = this.config.nodeEnv;
    
    return {
      development: {
        debug: true,
        verbose: true,
        hotReload: true,
        sourceMaps: true,
        minification: false,
      },
      staging: {
        debug: true,
        verbose: false,
        hotReload: false,
        sourceMaps: true,
        minification: true,
      },
      production: {
        debug: false,
        verbose: false,
        hotReload: false,
        sourceMaps: false,
        minification: true,
      },
      test: {
        debug: true,
        verbose: false,
        hotReload: false,
        sourceMaps: true,
        minification: false,
      },
    }[env];
  }
}

/**
 * Global configuration instance
 */
export const config = new ConfigurationManager();

/**
 * Initialize configuration on module load (for convenience)
 * Can be called explicitly if needed
 */
export function initializeConfiguration(): ConfigurationManager {
  config.initialize();
  return config;
}
