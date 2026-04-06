#!/usr/bin/env node

/**
 * Configuration validation script for RepoRadar performance settings
 */

import { performanceConfig } from '../config/performance.config.ts';

function validateConfiguration() {
  console.log('🔍 Validating RepoRadar performance configuration...\n');

  // Validate configuration
  const validation = performanceConfig.validateConfig();
  
  if (!validation.valid) {
    console.error('❌ Configuration validation failed:\n');
    validation.errors.forEach(error => {
      console.error(`  • ${error}`);
    });
    console.error('\n💡 Please check your environment variables and configuration settings.');
    process.exit(1);
  }

  console.log('✅ Configuration validation passed!\n');

  // Display current configuration summary
  const config = performanceConfig.getConfig();
  
  console.log('📊 Current Configuration Summary:');
  console.log('================================\n');

  // Database configuration
  console.log('🗄️  Database Performance:');
  console.log(`   Connection Pool: ${config.database.connectionPool.minConnections}-${config.database.connectionPool.maxConnections} connections`);
  console.log(`   Query Monitoring: ${config.database.queryMonitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Slow Query Threshold: ${config.database.queryMonitoring.slowQueryThresholdMs}ms`);
  console.log(`   Auto Index Creation: ${config.database.indexing.autoCreateIndexes ? '✅ Enabled' : '❌ Disabled'}\n`);

  // Cache configuration
  console.log('💾 Cache Configuration:');
  console.log(`   Cache Type: ${config.cache.type}`);
  console.log(`   Cache Enabled: ${config.cache.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Memory Cache Size: ${config.cache.memory.maxSize}MB`);
  console.log(`   Default TTL: ${config.cache.memory.defaultTtlSeconds}s`);
  console.log(`   Compression: ${config.cache.compression.enabled ? '✅ Enabled' : '❌ Disabled'}\n`);

  // Compression configuration
  console.log('🗜️  Compression Settings:');
  console.log(`   Compression: ${config.compression.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Algorithms: ${config.compression.algorithms.join(', ')}`);
  console.log(`   Level: ${config.compression.level}`);
  console.log(`   Threshold: ${config.compression.threshold} bytes\n`);

  // GitHub API configuration
  console.log('🐙 GitHub API Optimization:');
  console.log(`   Optimization: ${config.github.optimization.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Batch Size: ${config.github.optimization.batchSize}`);
  console.log(`   Caching: ${config.github.caching.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Cache TTL: ${config.github.optimization.defaultCacheTtlSeconds}s\n`);

  // Frontend configuration
  console.log('🎨 Frontend Performance:');
  console.log(`   Code Splitting: ${config.frontend.codeSplitting.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Lazy Loading: ${config.frontend.lazyLoading.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Tree Shaking: ${config.frontend.bundleOptimization.treeShaking ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Service Worker: ${config.frontend.caching.serviceWorkerEnabled ? '✅ Enabled' : '❌ Disabled'}\n`);

  // Monitoring configuration
  console.log('📈 Performance Monitoring:');
  console.log(`   Monitoring: ${config.monitoring.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Alerting: ${config.monitoring.alerting.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Dashboard: ${config.monitoring.dashboard.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Metrics Retention: ${config.monitoring.metricsCollection.retentionDays} days\n`);

  // Fallback configuration
  console.log('🛡️  Fallback Configuration:');
  console.log(`   Database Fallback: ${config.fallback.database.connectionPoolFallback ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Cache Fallback: ${config.fallback.cache.fallbackToDirectRetrieval ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`   Frontend Fallback: ${config.fallback.frontend.synchronousFallback ? '✅ Enabled' : '❌ Disabled'}\n`);

  // Environment-specific recommendations
  const nodeEnv = process.env.NODE_ENV || 'development';
  console.log('💡 Environment-Specific Recommendations:');
  console.log('========================================\n');

  if (nodeEnv === 'production') {
    console.log('🚀 Production Environment Detected:');
    
    const recommendations = [];
    
    if (config.database.connectionPool.maxConnections < 20) {
      recommendations.push('Consider increasing DB_POOL_MAX to at least 20 for production');
    }
    
    if (config.cache.memory.maxSize < 256) {
      recommendations.push('Consider increasing CACHE_MEMORY_MAX_SIZE to at least 256MB for production');
    }
    
    if (config.compression.level < 6) {
      recommendations.push('Consider increasing COMPRESSION_LEVEL to at least 6 for production');
    }
    
    if (!config.monitoring.enabled) {
      recommendations.push('Enable performance monitoring in production (PERFORMANCE_MONITORING_ENABLED=true)');
    }
    
    if (!config.monitoring.alerting.enabled) {
      recommendations.push('Enable performance alerting in production (PERFORMANCE_ALERTING_ENABLED=true)');
    }

    if (recommendations.length > 0) {
      console.log('   Recommendations:');
      recommendations.forEach(rec => console.log(`   • ${rec}`));
    } else {
      console.log('   ✅ Configuration looks good for production!');
    }
  } else if (nodeEnv === 'development') {
    console.log('🔧 Development Environment Detected:');
    console.log('   • Lower resource limits are appropriate for development');
    console.log('   • Consider enabling monitoring to test performance features');
    console.log('   • Use lower compression levels for faster builds');
  } else if (nodeEnv === 'staging') {
    console.log('🧪 Staging Environment Detected:');
    console.log('   • Configuration should mirror production as closely as possible');
    console.log('   • Enable all monitoring and alerting features');
    console.log('   • Test performance optimizations before production deployment');
  }

  console.log('\n🎉 Configuration validation completed successfully!');
  console.log('📚 For more information, see docs/PERFORMANCE_CONFIGURATION.md');
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
RepoRadar Performance Configuration Validator

Usage: node scripts/validate-config.js [options]

Options:
  --help, -h     Show this help message
  --export       Export current configuration as JSON
  --summary      Show configuration summary only

Examples:
  node scripts/validate-config.js                    # Validate and show summary
  node scripts/validate-config.js --export           # Export configuration
  node scripts/validate-config.js --summary          # Show summary only
`);
  process.exit(0);
}

if (args.includes('--export')) {
  console.log('📄 Exporting current configuration:\n');
  console.log(performanceConfig.exportConfig());
  process.exit(0);
}

if (args.includes('--summary')) {
  const config = performanceConfig.getConfig();
  console.log('📊 Configuration Summary:');
  console.log(`Database Pool: ${config.database.connectionPool.minConnections}-${config.database.connectionPool.maxConnections}`);
  console.log(`Cache: ${config.cache.type} (${config.cache.memory.maxSize}MB)`);
  console.log(`Compression: ${config.compression.enabled ? config.compression.algorithms.join(',') : 'disabled'}`);
  console.log(`Monitoring: ${config.monitoring.enabled ? 'enabled' : 'disabled'}`);
  process.exit(0);
}

// Run validation
try {
  validateConfiguration();
} catch (error) {
  console.error('❌ Configuration validation failed with error:');
  console.error(error.message);
  process.exit(1);
}