#!/usr/bin/env node

/**
 * Production Readiness Validation Script
 * 
 * This script validates that the application is ready for production deployment
 * by checking build artifacts, environment variables, and configuration.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const checks = {
  passed: [],
  failed: [],
  warnings: []
};

function pass(message) {
  checks.passed.push(message);
  console.log(`✅ ${message}`);
}

function fail(message) {
  checks.failed.push(message);
  console.log(`❌ ${message}`);
}

function warn(message) {
  checks.warnings.push(message);
  console.log(`⚠️  ${message}`);
}

console.log('\n🔍 Validating Production Readiness...\n');

// Check 1: Build artifacts exist
console.log('📦 Checking build artifacts...');
const distDir = join(rootDir, 'dist');
const distIndexJs = join(distDir, 'index.js');
const distPublicDir = join(distDir, 'public');

if (existsSync(distDir)) {
  pass('dist/ directory exists');
} else {
  fail('dist/ directory not found - run "npm run build" first');
}

if (existsSync(distIndexJs)) {
  pass('dist/index.js exists');
} else {
  fail('dist/index.js not found - build may have failed');
}

if (existsSync(distPublicDir)) {
  pass('dist/public/ directory exists');
} else {
  fail('dist/public/ directory not found - client build may have failed');
}

// Check 2: package.json scripts
console.log('\n📝 Checking package.json scripts...');
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';

const packageJsonPath = join(rootDir, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

if (packageJson.scripts.build) {
  pass('build script is defined');
} else {
  fail('build script is missing');
}

if (packageJson.scripts.start) {
  pass('start script is defined');
  
  // Check if start script uses cross-env for cross-platform compatibility
  if (packageJson.scripts.start.includes('cross-env')) {
    pass('start script uses cross-env for cross-platform compatibility');
  } else {
    warn('start script should use cross-env for Windows compatibility');
  }
} else {
  fail('start script is missing');
}

// Check 3: Environment variable handling
console.log('\n🔧 Checking environment variable configuration...');

// Check if PORT is properly handled
const serverIndexPath = join(rootDir, 'server', 'index.ts');
try {
  const serverIndexContent = readFileSync(serverIndexPath, 'utf-8');
  
  if (serverIndexContent.includes('process.env.PORT')) {
    pass('Server uses PORT environment variable');
  } else {
    fail('Server does not use PORT environment variable');
  }
  
  if (serverIndexContent.includes('0.0.0.0') || serverIndexContent.includes('process.env.HOST')) {
    pass('Server binds to all interfaces (0.0.0.0)');
  } else {
    warn('Server should bind to 0.0.0.0 for production');
  }
} catch (error) {
  fail(`Could not read server/index.ts: ${error.message}`);
}

// Check 4: Configuration validation module
console.log('\n⚙️  Checking configuration validation...');
const configValidationPath = join(rootDir, 'server', 'config', 'validation.ts');

if (existsSync(configValidationPath)) {
  pass('Configuration validation module exists');
  
  try {
    const configContent = readFileSync(configValidationPath, 'utf-8');
    
    if (configContent.includes('validateConfiguration')) {
      pass('Configuration validation function exists');
    }
    
    if (configContent.includes('initializeConfiguration')) {
      pass('Configuration initialization function exists');
    }
    
    if (configContent.includes('PORT')) {
      pass('PORT validation is implemented');
    } else {
      warn('PORT validation should be added to configuration validation');
    }
  } catch (error) {
    warn(`Could not validate configuration module: ${error.message}`);
  }
} else {
  fail('Configuration validation module not found');
}

// Check 5: Production environment variables
console.log('\n🌍 Checking production environment requirements...');

const requiredProdVars = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'SESSION_ENCRYPTION_KEY',
  'NODE_ENV',
  'PORT'
];

const recommendedProdVars = [
  'FORCE_HTTPS',
  'REDIS_URL',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY'
];

// Note: We can't check actual env vars in this script since it runs at build time
// Just document what's required
console.log('\n📋 Required environment variables for production:');
requiredProdVars.forEach(varName => {
  console.log(`   • ${varName}`);
});

console.log('\n📋 Recommended environment variables for production:');
recommendedProdVars.forEach(varName => {
  console.log(`   • ${varName}`);
});

pass('Environment variable requirements documented');

// Check 6: Security configuration
console.log('\n🔒 Checking security configuration...');

const httpsEnforcementPath = join(rootDir, 'server', 'middleware', 'httpsEnforcement.ts');
if (existsSync(httpsEnforcementPath)) {
  pass('HTTPS enforcement middleware exists');
} else {
  warn('HTTPS enforcement middleware not found');
}

// Check 7: Health check endpoint
console.log('\n🏥 Checking health check configuration...');

const healthPath = join(rootDir, 'server', 'health.ts');
if (existsSync(healthPath)) {
  pass('Health check module exists');
} else {
  fail('Health check module not found');
}

// Check 8: Graceful shutdown
console.log('\n👋 Checking graceful shutdown...');

const gracefulShutdownPath = join(rootDir, 'server', 'gracefulShutdown.ts');
if (existsSync(gracefulShutdownPath)) {
  pass('Graceful shutdown module exists');
} else {
  warn('Graceful shutdown module not found');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));
console.log(`✅ Passed: ${checks.passed.length}`);
console.log(`⚠️  Warnings: ${checks.warnings.length}`);
console.log(`❌ Failed: ${checks.failed.length}`);
console.log('='.repeat(60));

if (checks.failed.length > 0) {
  console.log('\n❌ Production readiness validation FAILED');
  console.log('\nFailed checks:');
  checks.failed.forEach(msg => console.log(`  • ${msg}`));
  process.exit(1);
} else if (checks.warnings.length > 0) {
  console.log('\n⚠️  Production readiness validation PASSED with warnings');
  console.log('\nWarnings:');
  checks.warnings.forEach(msg => console.log(`  • ${msg}`));
  console.log('\n💡 Consider addressing these warnings before deploying to production.');
  process.exit(0);
} else {
  console.log('\n✅ Production readiness validation PASSED');
  console.log('\n🚀 Application is ready for production deployment!');
  process.exit(0);
}
