/**
 * Environment Configuration Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadEnvironmentConfig,
  validateEnvironmentConfig,
  ConfigurationManager,
  type EnvironmentConfig,
} from '../config/environment';

describe('Environment Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadEnvironmentConfig', () => {
    it('should load default configuration', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret-key-at-least-32-chars';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.nodeEnv).toBe('test');
      expect(config.port).toBe(5000);
      expect(config.database.url).toBe('postgresql://localhost/test');
      expect(config.session.secret).toBe('test-secret-key-at-least-32-chars');
    });

    it('should parse boolean environment variables correctly', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.CACHE_ENABLED = 'false';
      process.env.COMPRESSION_ENABLED = 'true';

      const config = loadEnvironmentConfig();

      expect(config.cache.enabled).toBe(false);
      expect(config.compression.enabled).toBe(true);
    });

    it('should parse integer environment variables correctly', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.PORT = '8080';
      process.env.DB_POOL_MIN = '5';
      process.env.DB_POOL_MAX = '20';

      const config = loadEnvironmentConfig();

      expect(config.port).toBe(8080);
      expect(config.database.pool.min).toBe(5);
      expect(config.database.pool.max).toBe(20);
    });

    it('should parse array environment variables correctly', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.COMPRESSION_ALGORITHMS = 'gzip,brotli,deflate';

      const config = loadEnvironmentConfig();

      expect(config.compression.algorithms).toEqual(['gzip', 'brotli', 'deflate']);
    });

    it('should apply production defaults when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'production-secret-key-at-least-32-chars';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.nodeEnv).toBe('production');
      expect(config.security.forceHttps).toBe(true);
      expect(config.frontend.bundleOptimization.minification).toBe(true);
      expect(config.frontend.bundleOptimization.dropConsole).toBe(true);
    });

    it('should apply development defaults when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'dev-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.nodeEnv).toBe('development');
      expect(config.security.forceHttps).toBe(false);
      expect(config.frontend.bundleOptimization.minification).toBe(false);
      expect(config.frontend.bundleOptimization.sourceMaps).toBe(true);
    });

    it('should load optional Stripe configuration when provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      process.env.STRIPE_SECRET_KEY = 'sk_test_123';
      process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
      process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
      process.env.STRIPE_ENTERPRISE_PRICE_ID = 'price_enterprise';

      const config = loadEnvironmentConfig();

      expect(config.apis.stripe).toBeDefined();
      expect(config.apis.stripe?.secretKey).toBe('sk_test_123');
      expect(config.apis.stripe?.publishableKey).toBe('pk_test_123');
    });

    it('should not load Stripe configuration when not provided', () => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.apis.stripe).toBeUndefined();
    });
  });

  describe('validateEnvironmentConfig', () => {
    let validConfig: EnvironmentConfig;

    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'valid-secret-key-at-least-32-characters-long';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      validConfig = loadEnvironmentConfig();
    });

    it('should validate a valid configuration', () => {
      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when DATABASE_URL is missing', () => {
      validConfig.database.url = '';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DATABASE_URL is required');
    });

    it('should error when DATABASE_URL is invalid', () => {
      validConfig.database.url = 'invalid-url';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DATABASE_URL must be a valid PostgreSQL connection string');
    });

    it('should error when SESSION_SECRET is missing', () => {
      validConfig.session.secret = '';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SESSION_SECRET is required');
    });

    it('should error when SESSION_ENCRYPTION_KEY is wrong length', () => {
      validConfig.session.encryptionKey = 'too-short';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('SESSION_ENCRYPTION_KEY must be exactly 64 characters (32 bytes hex-encoded)');
    });

    it('should warn when SESSION_SECRET is too short', () => {
      validConfig.session.secret = 'short';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.warnings).toContain('SESSION_SECRET should be at least 32 characters long');
    });

    it('should error when port is out of range', () => {
      validConfig.port = 70000;

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('PORT must be between 1 and 65535');
    });

    it('should error when DB_POOL_MAX is less than DB_POOL_MIN', () => {
      validConfig.database.pool.min = 10;
      validConfig.database.pool.max = 5;

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('DB_POOL_MAX must be greater than or equal to DB_POOL_MIN');
    });

    it('should error when cache type is redis but no URL provided', () => {
      validConfig.cache.type = 'redis';
      validConfig.cache.redis.url = undefined;
      validConfig.cache.redis.host = undefined;

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('CACHE_TYPE is set to redis but REDIS_URL or REDIS_HOST is not configured');
    });

    it('should error when compression level is out of range', () => {
      validConfig.compression.level = 15;

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('COMPRESSION_LEVEL must be between 1 and 11');
    });

    it('should warn about bcrypt rounds out of recommended range', () => {
      validConfig.auth.bcryptRounds = 5;

      const result = validateEnvironmentConfig(validConfig);

      expect(result.warnings).toContain('BCRYPT_ROUNDS should be between 10 and 15 (default: 12)');
    });

    it('should error when Stripe key format is invalid', () => {
      validConfig.apis.stripe = {
        secretKey: 'invalid_key',
        publishableKey: 'pk_test_123',
        webhookSecret: 'whsec_123',
        proPriceId: 'price_pro',
        enterprisePriceId: 'price_enterprise',
      };

      const result = validateEnvironmentConfig(validConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
    });

    it('should warn when using test Stripe keys in production', () => {
      validConfig.nodeEnv = 'production';
      validConfig.apis.stripe = {
        secretKey: 'sk_test_123',
        publishableKey: 'pk_test_123',
        webhookSecret: 'whsec_123',
        proPriceId: 'price_pro',
        enterprisePriceId: 'price_enterprise',
      };

      const result = validateEnvironmentConfig(validConfig);

      expect(result.warnings).toContain('Using Stripe test keys in production environment');
    });

    it('should provide production-specific warnings', () => {
      validConfig.nodeEnv = 'production';
      validConfig.security.forceHttps = false;
      validConfig.auth.email = undefined;
      validConfig.rateLimit.storage = 'memory';

      const result = validateEnvironmentConfig(validConfig);

      expect(result.warnings).toContain('FORCE_HTTPS should be enabled in production');
      expect(result.warnings).toContain('Email service (RESEND_API_KEY) is not configured. Password reset will not work.');
      expect(result.warnings).toContain('Using memory-based rate limiting in production. Consider using Redis for multi-instance deployments.');
    });
  });

  describe('ConfigurationManager', () => {
    beforeEach(() => {
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'test-secret-key-at-least-32-characters-long';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    });

    it('should create a configuration manager instance', () => {
      const manager = new ConfigurationManager();

      expect(manager).toBeDefined();
      expect(manager.getConfig()).toBeDefined();
    });

    it('should provide access to configuration sections', () => {
      const manager = new ConfigurationManager();

      expect(manager.getDatabase()).toBeDefined();
      expect(manager.getCache()).toBeDefined();
      expect(manager.getSession()).toBeDefined();
      expect(manager.getSecurity()).toBeDefined();
      expect(manager.getAPIs()).toBeDefined();
    });

    it('should detect environment correctly', () => {
      process.env.NODE_ENV = 'production';
      const manager = new ConfigurationManager();

      expect(manager.isProduction()).toBe(true);
      expect(manager.isDevelopment()).toBe(false);
      expect(manager.isStaging()).toBe(false);
    });

    it('should validate configuration', () => {
      const manager = new ConfigurationManager();
      const result = manager.validate();

      expect(result).toBeDefined();
      expect(result.valid).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should throw error on initialize with invalid config', () => {
      process.env.DATABASE_URL = ''; // Invalid
      const manager = new ConfigurationManager();

      expect(() => manager.initialize()).toThrow('Configuration validation failed');
    });

    it('should track validation status', () => {
      const manager = new ConfigurationManager();

      expect(manager.isValidated()).toBe(false);

      manager.validate();
      // Still false because initialize wasn't called
      expect(manager.isValidated()).toBe(false);
    });

    it('should reload configuration', () => {
      const manager = new ConfigurationManager();
      const originalPort = manager.getConfig().port;

      process.env.PORT = '9000';
      manager.reload();

      expect(manager.getConfig().port).toBe(9000);
      expect(manager.getConfig().port).not.toBe(originalPort);
    });

    it('should export configuration as JSON', () => {
      const manager = new ConfigurationManager();
      const exported = manager.export();

      expect(exported).toBeDefined();
      expect(() => JSON.parse(exported)).not.toThrow();

      const parsed = JSON.parse(exported);
      expect(parsed.nodeEnv).toBeDefined();
      expect(parsed.database).toBeDefined();
    });

    it('should provide environment-specific settings', () => {
      process.env.NODE_ENV = 'production';
      const manager = new ConfigurationManager();
      const settings = manager.getEnvironmentSettings();

      expect(settings.debug).toBe(false);
      expect(settings.minification).toBe(true);
      expect(settings.sourceMaps).toBe(false);
    });

    it('should provide development settings in development', () => {
      process.env.NODE_ENV = 'development';
      const manager = new ConfigurationManager();
      const settings = manager.getEnvironmentSettings();

      expect(settings.debug).toBe(true);
      expect(settings.minification).toBe(false);
      expect(settings.sourceMaps).toBe(true);
      expect(settings.hotReload).toBe(true);
    });
  });

  describe('Environment-specific behavior', () => {
    it('should use different defaults for production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'production-secret-at-least-32-chars';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.database.pool.min).toBe(2);
      expect(config.database.pool.max).toBe(10);
      expect(config.security.forceHttps).toBe(true);
    });

    it('should use different defaults for development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'dev-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();

      expect(config.database.pool.min).toBe(1);
      expect(config.database.pool.max).toBe(5);
      expect(config.security.forceHttps).toBe(false);
    });

    it('should handle staging environment', () => {
      process.env.NODE_ENV = 'staging';
      process.env.DATABASE_URL = 'postgresql://localhost/test';
      process.env.SESSION_SECRET = 'staging-secret';
      process.env.SESSION_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      const config = loadEnvironmentConfig();
      const manager = new ConfigurationManager();

      expect(config.nodeEnv).toBe('staging');
      expect(manager.isStaging()).toBe(true);
    });
  });
});
