/**
 * Validate Environment Configuration Script
 * Tests the configuration module without running full test suite
 */

import dotenv from 'dotenv';
dotenv.config();

import { config, initializeConfiguration } from '../server/config/environment.ts';

console.log('🔍 Validating Environment Configuration...\n');

try {
  // Load and validate configuration
  const validation = config.validate();

  console.log('Configuration Validation Results:');
  console.log('='.repeat(60));
  console.log(`Valid: ${validation.valid ? '✅ Yes' : '❌ No'}`);
  console.log(`Errors: ${validation.errors.length}`);
  console.log(`Warnings: ${validation.warnings.length}`);
  console.log('');

  if (validation.errors.length > 0) {
    console.log('❌ Errors:');
    validation.errors.forEach(error => console.log(`  • ${error}`));
    console.log('');
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`  • ${warning}`));
    console.log('');
  }

  // Test configuration access
  console.log('Configuration Access Tests:');
  console.log('='.repeat(60));
  
  const dbConfig = config.getDatabase();
  console.log(`✓ Database pool: ${dbConfig.pool.min}-${dbConfig.pool.max} connections`);
  
  const cacheConfig = config.getCache();
  console.log(`✓ Cache type: ${cacheConfig.type}`);
  
  const sessionConfig = config.getSession();
  console.log(`✓ Session storage: ${sessionConfig.useRedis ? 'Redis' : 'PostgreSQL'}`);
  
  const securityConfig = config.getSecurity();
  console.log(`✓ HTTPS enforcement: ${securityConfig.forceHttps ? 'Enabled' : 'Disabled'}`);
  
  console.log('');

  // Test environment detection
  console.log('Environment Detection:');
  console.log('='.repeat(60));
  console.log(`Environment: ${config.getConfig().nodeEnv}`);
  console.log(`Is Production: ${config.isProduction()}`);
  console.log(`Is Development: ${config.isDevelopment()}`);
  console.log(`Is Staging: ${config.isStaging()}`);
  console.log(`Is Test: ${config.isTest()}`);
  console.log('');

  // Test environment-specific settings
  const envSettings = config.getEnvironmentSettings();
  console.log('Environment-Specific Settings:');
  console.log('='.repeat(60));
  console.log(`Debug: ${envSettings.debug}`);
  console.log(`Verbose: ${envSettings.verbose}`);
  console.log(`Hot Reload: ${envSettings.hotReload}`);
  console.log(`Source Maps: ${envSettings.sourceMaps}`);
  console.log(`Minification: ${envSettings.minification}`);
  console.log('');

  // Export configuration
  console.log('Configuration Export Test:');
  console.log('='.repeat(60));
  const exported = config.export();
  const parsed = JSON.parse(exported);
  console.log(`✓ Configuration exported successfully (${Object.keys(parsed).length} top-level keys)`);
  console.log('');

  if (validation.valid) {
    console.log('✅ All configuration tests passed!\n');
    process.exit(0);
  } else {
    console.log('❌ Configuration validation failed. Please fix errors above.\n');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Configuration validation error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
