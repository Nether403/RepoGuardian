# Environment Configuration Guide

## Overview

RepoRadar uses a comprehensive environment-specific configuration system that provides type-safe access to all configuration values with automatic validation and environment-specific defaults.

## Quick Start

### Basic Usage

```typescript
import { config } from './server/config';

// Initialize configuration (validates and logs summary)
config.initialize();

// Access configuration
const dbConfig = config.getDatabase();
const port = config.getConfig().port;
const isProduction = config.isProduction();
```

### Validation Only

```typescript
import { config } from './server/config';

// Validate without initializing
const result = config.validate();

if (!result.valid) {
  console.error('Configuration errors:', result.errors);
  process.exit(1);
}
```

## Configuration Sections

### Core Application

```typescript
const appConfig = config.getConfig();
console.log(appConfig.nodeEnv);    // 'development' | 'staging' | 'production' | 'test'
console.log(appConfig.port);       // 5000
console.log(appConfig.host);       // '0.0.0.0'
console.log(appConfig.appUrl);     // 'http://localhost:5000'
```

### Database

```typescript
const dbConfig = config.getDatabase();

// Connection pool settings
console.log(dbConfig.pool.min);              // 2 (production) or 1 (development)
console.log(dbConfig.pool.max);              // 10 (production) or 5 (development)
console.log(dbConfig.pool.idleTimeout);      // 30000ms
console.log(dbConfig.pool.connectionTimeout); // 5000ms

// Monitoring settings
console.log(dbConfig.monitoring.enabled);           // true
console.log(dbConfig.monitoring.slowQueryThreshold); // 1000ms
console.log(dbConfig.monitoring.logSlowQueries);    // true

// Indexing settings
console.log(dbConfig.indexing.autoCreate);    // true
console.log(dbConfig.indexing.analyzeEnabled); // true
```

### Cache

```typescript
const cacheConfig = config.getCache();

console.log(cacheConfig.enabled);  // true
console.log(cacheConfig.type);     // 'memory' | 'redis' | 'hybrid'

// Memory cache settings
console.log(cacheConfig.memory.maxSize);      // 100 MB
console.log(cacheConfig.memory.maxEntries);   // 10000
console.log(cacheConfig.memory.defaultTtl);   // 3600 seconds

// Redis settings (if configured)
if (cacheConfig.redis.url) {
  console.log(cacheConfig.redis.url);
  console.log(cacheConfig.redis.keyPrefix);  // 'reporadar:'
}
```

### Session

```typescript
const sessionConfig = config.getSession();

console.log(sessionConfig.secret);              // Session secret
console.log(sessionConfig.encryptionKey);       // Encryption key
console.log(sessionConfig.useRedis);            // false (default)
console.log(sessionConfig.timeout);             // 604800000 (7 days)
console.log(sessionConfig.regenerateOnLogin);   // true
console.log(sessionConfig.trackMetadata);       // true
```

### Security

```typescript
const securityConfig = config.getSecurity();

console.log(securityConfig.forceHttps);           // true (production)
console.log(securityConfig.hstsMaxAge);           // 31536000 (1 year)
console.log(securityConfig.hstsIncludeSubdomains); // true
console.log(securityConfig.headersEnabled);       // true
console.log(securityConfig.cspEnabled);           // true
console.log(securityConfig.cspDirectives);        // CSP directives string
```

### External APIs

```typescript
const apis = config.getAPIs();

// AI providers
console.log(apis.gemini.apiKey);   // Gemini API key (if configured)
console.log(apis.openai.apiKey);   // OpenAI API key (if configured)

// GitHub
console.log(apis.github.token);    // GitHub token (if configured)
console.log(apis.github.optimization.enabled);  // true
console.log(apis.github.optimization.batchSize); // 10

// Stripe (if configured)
if (apis.stripe) {
  console.log(apis.stripe.secretKey);
  console.log(apis.stripe.publishableKey);
  console.log(apis.stripe.proPriceId);
}
```

### Authentication

```typescript
const authConfig = config.getAuth();

console.log(authConfig.bcryptRounds);  // 12

// Stack Auth (if configured)
if (authConfig.stackAuth) {
  console.log(authConfig.stackAuth.projectId);
  console.log(authConfig.stackAuth.publishableKey);
}

// Email service (if configured)
if (authConfig.email) {
  console.log(authConfig.email.from);
  console.log(authConfig.email.passwordResetUrl);
}
```

### Rate Limiting

```typescript
const rateLimitConfig = config.getRateLimit();

console.log(rateLimitConfig.storage);  // 'memory' | 'redis' | 'postgres'

// Auth rate limits
console.log(rateLimitConfig.auth.login.limit);   // 5 attempts
console.log(rateLimitConfig.auth.login.window);  // 900000ms (15 min)

// API rate limits
console.log(rateLimitConfig.api.free.limit);     // 100 requests
console.log(rateLimitConfig.api.free.window);    // 3600000ms (1 hour)
console.log(rateLimitConfig.api.pro.limit);      // 1000 requests
```

### Feature Flags

```typescript
const features = config.getFeatures();

console.log(features.loadingStates);      // true
console.log(features.errorHandling);      // true
console.log(features.backgroundJobs);     // true
console.log(features.healthChecks);       // true
console.log(features.horizontalScaling);  // true
console.log(features.monitoring);         // true
```

## Environment Detection

```typescript
import { config } from './server/config';

if (config.isProduction()) {
  // Production-specific code
  console.log('Running in production mode');
}

if (config.isDevelopment()) {
  // Development-specific code
  console.log('Running in development mode');
}

if (config.isStaging()) {
  // Staging-specific code
  console.log('Running in staging mode');
}

// Get environment-specific settings
const envSettings = config.getEnvironmentSettings();
console.log(envSettings.debug);         // true in dev, false in prod
console.log(envSettings.minification);  // false in dev, true in prod
console.log(envSettings.sourceMaps);    // true in dev, false in prod
```

## Feature Status Checks

```typescript
import { getFeatureStatus } from './server/config';

const features = getFeatureStatus(config.getConfig());

// Check if OAuth is enabled
if (features.oauth.enabled) {
  console.log('OAuth providers:', features.oauth.providers);
}

// Check if password reset is available
if (features.passwordReset.enabled) {
  console.log('Email service:', features.passwordReset.emailService);
}

// Check if Stripe is configured
if (features.stripe.enabled) {
  console.log('Stripe mode:', features.stripe.mode);  // 'test' or 'live'
}

// Check if AI fallback is available
if (features.ai.fallback) {
  console.log('AI fallback enabled (both Gemini and OpenAI configured)');
}
```

## Validation

### Validate Configuration

```typescript
import { config } from './server/config';

const result = config.validate();

console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);

if (!result.valid) {
  result.errors.forEach(error => console.error('Error:', error));
  process.exit(1);
}

if (result.warnings.length > 0) {
  result.warnings.forEach(warning => console.warn('Warning:', warning));
}
```

### Initialize with Validation

```typescript
import { config } from './server/config';

try {
  // Validates, logs summary, and throws on error
  config.initialize();
  console.log('Configuration initialized successfully');
} catch (error) {
  console.error('Configuration validation failed:', error.message);
  process.exit(1);
}
```

## Command Line Tools

### Validate Configuration

```bash
# Validate current configuration
npm run config:env:validate

# Validate with specific environment
NODE_ENV=production npm run config:env:validate
NODE_ENV=staging npm run config:env:validate
```

### Legacy Validation (Backward Compatible)

```bash
# Validate using legacy validation module
npm run config:validate

# Export configuration
npm run config:export

# Show configuration summary
npm run config:summary
```

## Environment Variables

### Required Variables

```bash
# Core (Required in all environments)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
SESSION_SECRET=your-secret-at-least-32-characters-long
SESSION_ENCRYPTION_KEY=64-character-hex-string

# Production (Required in production)
GEMINI_API_KEY=your-gemini-api-key
# OR
OPENAI_API_KEY=your-openai-api-key
```

### Optional Variables

```bash
# Application
NODE_ENV=development|staging|production|test
PORT=5000
HOST=0.0.0.0
APP_URL=http://localhost:5000

# Cache
CACHE_ENABLED=true
CACHE_TYPE=memory|redis|hybrid
REDIS_URL=redis://localhost:6379

# Session
USE_REDIS_SESSIONS=false
SESSION_TIMEOUT=604800000

# Security
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true

# External APIs
GITHUB_TOKEN=your-github-token
STRIPE_SECRET_KEY=sk_test_or_sk_live_key

# Authentication
BCRYPT_ROUNDS=12
NEXT_PUBLIC_STACK_PROJECT_ID=your-stack-project-id
RESEND_API_KEY=your-resend-api-key

# Rate Limiting
RATE_LIMIT_STORAGE=memory|redis|postgres
RATE_LIMIT_AUTH_LOGIN_LIMIT=5
RATE_LIMIT_API_FREE_LIMIT=100

# Feature Flags
FEATURE_BACKGROUNDJOBS=true
FEATURE_HEALTHCHECKS=true
FEATURE_MONITORING=true
```

See `.env.example` for complete list of environment variables.

## Environment-Specific Defaults

### Production
- Database pool: 2-10 connections
- HTTPS enforcement: Enabled
- Security headers: Enabled
- Minification: Enabled
- Source maps: Disabled
- Console logs: Dropped

### Development
- Database pool: 1-5 connections
- HTTPS enforcement: Disabled
- Security headers: Enabled
- Minification: Disabled
- Source maps: Enabled
- Console logs: Kept

### Staging
- Database pool: 2-10 connections
- HTTPS enforcement: Enabled
- Security headers: Enabled
- Minification: Enabled
- Source maps: Enabled
- Console logs: Kept

## Best Practices

### 1. Initialize Early

```typescript
// server/index.ts
import { config } from './config';

// Initialize configuration before anything else
config.initialize();

// Now safe to use configuration
const app = express();
```

### 2. Use Type-Safe Access

```typescript
// Good: Type-safe access
const dbConfig = config.getDatabase();
const poolSize = dbConfig.pool.max;

// Avoid: Direct environment variable access
const poolSize = parseInt(process.env.DB_POOL_MAX || '10');
```

### 3. Check Feature Status

```typescript
import { getFeatureStatus } from './server/config';

const features = getFeatureStatus(config.getConfig());

if (features.stripe.enabled) {
  // Initialize Stripe
  const stripe = new Stripe(config.getAPIs().stripe!.secretKey);
}
```

### 4. Handle Optional Features

```typescript
const apis = config.getAPIs();

// Check if Stripe is configured before using
if (apis.stripe) {
  const stripe = new Stripe(apis.stripe.secretKey);
} else {
  console.warn('Stripe not configured, payment features disabled');
}
```

### 5. Validate in CI/CD

```bash
# In your CI/CD pipeline
npm run config:env:validate || exit 1
```

## Troubleshooting

### Configuration Validation Fails

```bash
# Run validation to see specific errors
npm run config:env:validate

# Check for missing required variables
# Check for invalid values
# Check for default values in production
```

### Environment Variables Not Loading

```typescript
// Ensure dotenv is loaded before importing config
import dotenv from 'dotenv';
dotenv.config();

import { config } from './server/config';
```

### Type Errors

```typescript
// Ensure you're using the correct types
import type { EnvironmentConfig } from './server/config';

const myConfig: EnvironmentConfig = config.getConfig();
```

## Migration from Legacy Validation

### Step 1: Import New Module

```typescript
// Old
import { initializeConfiguration } from './config/validation';

// New
import { config } from './config';
```

### Step 2: Update Initialization

```typescript
// Old
initializeConfiguration();

// New
config.initialize();
```

### Step 3: Update Configuration Access

```typescript
// Old
const dbUrl = process.env.DATABASE_URL;
const poolMax = parseInt(process.env.DB_POOL_MAX || '10');

// New
const dbConfig = config.getDatabase();
const dbUrl = dbConfig.url;
const poolMax = dbConfig.pool.max;
```

### Step 4: Update Feature Checks

```typescript
// Old
const hasStripe = !!process.env.STRIPE_SECRET_KEY;

// New
const features = getFeatureStatus(config.getConfig());
const hasStripe = features.stripe.enabled;
```

## Related Documentation

- [Environment Variables](.env.example) - Complete list of environment variables
- [Production Deployment](RENDER_DEPLOYMENT_GUIDE.md) - Production deployment guide
- [Security Configuration](SECURITY_CONFIGURATION.md) - Security best practices
- [Performance Configuration](PERFORMANCE_CONFIGURATION.md) - Performance tuning

## Support

For issues or questions about configuration:
1. Check validation errors: `npm run config:env:validate`
2. Review `.env.example` for required variables
3. Check this documentation for usage examples
4. Review task summary: `.kiro/specs/render-deployment/task-12-summary.md`
