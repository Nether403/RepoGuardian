#!/usr/bin/env node

/**
 * Session Configuration Verification Script
 * Verifies environment variables for session management
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

console.log('\n' + '='.repeat(70));
console.log('🔐 SESSION CONFIGURATION VERIFICATION');
console.log('='.repeat(70) + '\n');

const checks = [];
const recommendations = [];

// Check SESSION_SECRET
console.log('📋 Session Secret:');
console.log('─'.repeat(70));
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  console.log('❌ SESSION_SECRET is not configured');
  checks.push(false);
  recommendations.push('Set SESSION_SECRET environment variable');
} else if (sessionSecret.includes('dev_') || sessionSecret === 'your_session_secret_here_change_in_production') {
  console.log('⚠️  SESSION_SECRET is using default value');
  console.log(`   Current: ${sessionSecret.substring(0, 20)}...`);
  checks.push(false);
  recommendations.push('Generate a new SESSION_SECRET:');
  recommendations.push('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
} else if (sessionSecret.length < 32) {
  console.log(`⚠️  SESSION_SECRET is too short (${sessionSecret.length} characters)`);
  checks.push(false);
  recommendations.push('SESSION_SECRET should be at least 32 characters');
} else {
  console.log(`✅ SESSION_SECRET is properly configured (${sessionSecret.length} characters)`);
  checks.push(true);
}

// Check SESSION_ENCRYPTION_KEY
console.log('\n📋 Session Encryption Key:');
console.log('─'.repeat(70));
const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
if (!encryptionKey) {
  console.log('❌ SESSION_ENCRYPTION_KEY is not configured');
  checks.push(false);
  recommendations.push('Set SESSION_ENCRYPTION_KEY environment variable');
} else if (encryptionKey.includes('dev_') || encryptionKey === 'your_64_char_hex_encryption_key_here_change_in_production') {
  console.log('⚠️  SESSION_ENCRYPTION_KEY is using default value');
  console.log(`   Current: ${encryptionKey.substring(0, 20)}...`);
  checks.push(false);
  recommendations.push('Generate a new SESSION_ENCRYPTION_KEY (64 hex characters):');
  recommendations.push('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
} else if (encryptionKey.length !== 64) {
  console.log(`❌ SESSION_ENCRYPTION_KEY must be exactly 64 characters (current: ${encryptionKey.length})`);
  checks.push(false);
  recommendations.push('SESSION_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
} else {
  console.log(`✅ SESSION_ENCRYPTION_KEY is properly configured (${encryptionKey.length} characters)`);
  checks.push(true);
}

// Check session store configuration
console.log('\n📋 Session Store Configuration:');
console.log('─'.repeat(70));
const useRedis = process.env.USE_REDIS_SESSIONS === 'true';
const redisUrl = process.env.REDIS_URL;

if (useRedis) {
  console.log('⚡ Redis session store enabled');
  if (redisUrl) {
    console.log(`✅ REDIS_URL is configured`);
    checks.push(true);
  } else {
    console.log('❌ REDIS_URL is not configured but USE_REDIS_SESSIONS=true');
    checks.push(false);
    recommendations.push('Set REDIS_URL or set USE_REDIS_SESSIONS=false');
  }
} else {
  console.log('🐘 PostgreSQL session store (default)');
  console.log('✅ Recommended for production');
  checks.push(true);
}

// Check session timeout
console.log('\n📋 Session Timeout:');
console.log('─'.repeat(70));
const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT || '604800000');
const timeoutDays = Math.floor(sessionTimeout / 86400000);
console.log(`✓ Timeout: ${timeoutDays} days (${sessionTimeout}ms)`);
if (sessionTimeout < 3600000) {
  console.log('⚠️  Session timeout is very short (< 1 hour)');
  checks.push(false);
} else if (sessionTimeout > 2592000000) {
  console.log('⚠️  Session timeout is very long (> 30 days)');
  checks.push(false);
} else {
  console.log('✅ Session timeout is reasonable');
  checks.push(true);
}

// Check session security features
console.log('\n📋 Session Security Features:');
console.log('─'.repeat(70));
const regenerateOnLogin = process.env.SESSION_REGENERATE_ON_LOGIN !== 'false';
const trackMetadata = process.env.SESSION_TRACK_METADATA !== 'false';
const slidingWindow = process.env.SESSION_SLIDING_WINDOW !== 'false';
const suspiciousActivityCheck = process.env.SESSION_SUSPICIOUS_ACTIVITY_CHECK !== 'false';

console.log(`✓ Regenerate on login: ${regenerateOnLogin ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`✓ Track metadata: ${trackMetadata ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`✓ Sliding window: ${slidingWindow ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`✓ Suspicious activity check: ${suspiciousActivityCheck ? '✅ Enabled' : '❌ Disabled'}`);

checks.push(regenerateOnLogin && trackMetadata);

// Check environment
console.log('\n📋 Environment:');
console.log('─'.repeat(70));
const nodeEnv = process.env.NODE_ENV || 'development';
const forceHttps = process.env.FORCE_HTTPS === 'true';
const cookieDomain = process.env.COOKIE_DOMAIN;

console.log(`✓ NODE_ENV: ${nodeEnv.toUpperCase()}`);
console.log(`✓ HTTPS enforcement: ${forceHttps ? '✅ Enabled' : '❌ Disabled'}`);
console.log(`✓ Cookie domain: ${cookieDomain || '(not set - single domain)'}`);

if (nodeEnv === 'production' && !forceHttps) {
  console.log('⚠️  HTTPS enforcement should be enabled in production');
  recommendations.push('Set FORCE_HTTPS=true for production');
}

// Summary
console.log('\n' + '='.repeat(70));
console.log('📊 SUMMARY');
console.log('='.repeat(70));

const passedChecks = checks.filter(Boolean).length;
const totalChecks = checks.length;
const allPassed = passedChecks === totalChecks;

console.log(`\n✓ Checks passed: ${passedChecks}/${totalChecks}`);

if (recommendations.length > 0) {
  console.log('\n📋 Recommendations:');
  console.log('─'.repeat(70));
  recommendations.forEach(rec => console.log(`  ${rec}`));
}

console.log('\n' + '='.repeat(70));

if (allPassed && recommendations.length === 0) {
  console.log('✅ SESSION CONFIGURATION IS PRODUCTION-READY');
  console.log('='.repeat(70) + '\n');
  process.exit(0);
} else if (nodeEnv === 'production') {
  console.log('❌ CONFIGURATION ISSUES FOUND - FIX BEFORE PRODUCTION DEPLOYMENT');
  console.log('='.repeat(70) + '\n');
  process.exit(1);
} else {
  console.log('⚠️  CONFIGURATION ISSUES FOUND - REVIEW BEFORE PRODUCTION');
  console.log('='.repeat(70) + '\n');
  process.exit(0);
}
