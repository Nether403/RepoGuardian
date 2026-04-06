#!/usr/bin/env node

/**
 * Horizontal Scaling Verification Script
 * Verifies that the application is properly configured for horizontal scaling
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Verifying Horizontal Scaling Configuration...\n');

const checks = [];
let passed = 0;
let failed = 0;

// Check 1: Instance ID module exists
try {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', 'server', 'instanceId.ts');
  const exists = fs.existsSync(filePath);
  
  checks.push({
    name: 'Instance Identification Module',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'instanceId.ts exists' : 'instanceId.ts not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'Instance Identification Module',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Check 2: Graceful shutdown module exists
try {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', 'server', 'gracefulShutdown.ts');
  const exists = fs.existsSync(filePath);
  
  checks.push({
    name: 'Graceful Shutdown Handler Module',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'gracefulShutdown.ts exists' : 'gracefulShutdown.ts not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'Graceful Shutdown Handler Module',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Check 3: Redis manager exists
try {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', 'server', 'redis.ts');
  const exists = fs.existsSync(filePath);
  
  checks.push({
    name: 'Redis Connection Manager Module',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'redis.ts exists' : 'redis.ts not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'Redis Connection Manager Module',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Check 4: Session store configuration
try {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', 'server', 'sessionStore.ts');
  const exists = fs.existsSync(filePath);
  
  checks.push({
    name: 'Session Store Configuration Module',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'sessionStore.ts exists' : 'sessionStore.ts not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'Session Store Configuration Module',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Check 5: WebSocket adapter exists
try {
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(__dirname, '..', 'server', 'websocketAdapter.ts');
  const exists = fs.existsSync(filePath);
  
  checks.push({
    name: 'WebSocket Redis Adapter Module',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'websocketAdapter.ts exists' : 'websocketAdapter.ts not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'WebSocket Redis Adapter Module',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Check 6: Environment variables
const envChecks = [
  { name: 'USE_REDIS_SESSIONS', value: process.env.USE_REDIS_SESSIONS, recommended: 'true' },
  { name: 'REDIS_URL', value: process.env.REDIS_URL, recommended: 'redis://localhost:6379' },
  { name: 'SESSION_SECRET', value: process.env.SESSION_SECRET ? '***SET***' : undefined, recommended: '***REQUIRED***' },
];

const envStatus = envChecks.every(check => check.value) ? 'PASS' : 'WARN';
const envDetails = envChecks.map(check => 
  `${check.name}: ${check.value || 'NOT SET'} (recommended: ${check.recommended})`
).join(', ');

checks.push({
  name: 'Environment Variables',
  status: envStatus,
  details: envDetails
});

if (envStatus === 'PASS') passed++;
else failed++;

// Check 7: Documentation exists
try {
  const fs = require('fs');
  const path = require('path');
  
  const docPath = path.join(process.cwd(), 'docs', 'HORIZONTAL_SCALING_GUIDE.md');
  const exists = fs.existsSync(docPath);
  
  checks.push({
    name: 'Documentation',
    status: exists ? 'PASS' : 'FAIL',
    details: exists ? 'HORIZONTAL_SCALING_GUIDE.md exists' : 'Documentation not found'
  });
  
  if (exists) passed++;
  else failed++;
} catch (error) {
  checks.push({
    name: 'Documentation',
    status: 'FAIL',
    details: error.message
  });
  failed++;
}

// Print results
console.log('═══════════════════════════════════════════════════════════════\n');

checks.forEach(check => {
  const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
  console.log(`${icon} ${check.name}: ${check.status}`);
  console.log(`   ${check.details}\n`);
});

const warnings = checks.filter(c => c.status === 'WARN').length;
const failures = checks.filter(c => c.status === 'FAIL').length;

console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`Summary: ${passed} passed, ${warnings} warnings, ${failures} failed\n`);

if (failures === 0) {
  console.log('✅ All horizontal scaling modules are in place!');
  
  if (warnings > 0) {
    console.log('\n⚠️  Configuration recommendations:');
    console.log('1. Set USE_REDIS_SESSIONS=true in your environment');
    console.log('2. Configure REDIS_URL to point to your Redis instance');
    console.log('3. Set SESSION_SECRET to a secure random value');
  }
  
  console.log('\nNext steps for deployment:');
  console.log('1. Configure environment variables');
  console.log('2. Deploy multiple instances');
  console.log('3. Configure load balancer');
  console.log('4. Run tests: npm test -- server/__tests__/horizontalScaling.test.ts');
  console.log('\nSee docs/HORIZONTAL_SCALING_GUIDE.md for detailed instructions.');
  process.exit(0);
} else {
  console.log('❌ Some checks failed. Please review the errors above.');
  process.exit(1);
}
