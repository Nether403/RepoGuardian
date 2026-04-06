#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that a deployed application is working correctly by:
 * - Testing the health endpoint
 * - Testing critical API endpoints
 * - Checking WebSocket connectivity
 * - Validating environment configuration
 * 
 * Usage:
 *   node scripts/verify-deployment.js <deployment-url>
 *   node scripts/verify-deployment.js https://your-app.onrender.com
 * 
 * Environment variables:
 *   DEPLOYMENT_URL - URL of the deployed application (alternative to CLI arg)
 *   VERIFY_AUTH_TOKEN - Optional auth token for protected endpoints
 */

import { WebSocket } from 'ws';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warn(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function section(message) {
  log(`\n${'='.repeat(60)}`, colors.cyan);
  log(message, colors.cyan);
  log('='.repeat(60), colors.cyan);
}

const results = {
  passed: [],
  failed: [],
  warnings: [],
  skipped: [],
};

function recordPass(test) {
  results.passed.push(test);
  success(test);
}

function recordFail(test, errorMsg) {
  results.failed.push({ test, error: errorMsg });
  error(`${test}: ${errorMsg}`);
}

function recordWarn(test, message) {
  results.warnings.push({ test, message });
  warn(`${test}: ${message}`);
}

function recordSkip(test, reason) {
  results.skipped.push({ test, reason });
  info(`⏭️  ${test}: ${reason}`);
}

/**
 * Test health endpoint
 */
async function testHealthEndpoint(baseUrl) {
  section('🏥 Testing Health Endpoint');
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    const duration = Date.now() - startTime;
    
    if (!response.ok && response.status !== 503) {
      recordFail('Health endpoint accessibility', `HTTP ${response.status}`);
      return false;
    }
    
    recordPass(`Health endpoint accessible (${duration}ms)`);
    
    // Parse response
    const data = await response.json();
    
    // Check required fields
    if (!data.status) {
      recordFail('Health response format', 'Missing status field');
      return false;
    }
    recordPass(`Health status: ${data.status}`);
    
    if (!data.timestamp) {
      recordWarn('Health response format', 'Missing timestamp field');
    } else {
      recordPass('Health response includes timestamp');
    }
    
    if (typeof data.uptime !== 'number') {
      recordWarn('Health response format', 'Missing or invalid uptime field');
    } else {
      recordPass(`Server uptime: ${Math.floor(data.uptime)}s`);
    }
    
    // Check health checks
    if (!data.checks) {
      recordWarn('Health checks', 'No detailed checks in response');
    } else {
      recordPass('Health checks present');
      
      // Database check
      if (data.checks.database) {
        const dbStatus = data.checks.database.status;
        if (dbStatus === 'healthy') {
          recordPass(`Database: ${dbStatus} (${data.checks.database.latency}ms)`);
        } else {
          recordWarn('Database health', `Status: ${dbStatus}`);
        }
      } else {
        recordWarn('Database check', 'Not included in health response');
      }
      
      // Redis check
      if (data.checks.redis) {
        const redisStatus = data.checks.redis.status;
        if (redisStatus === 'healthy') {
          recordPass(`Redis: ${redisStatus} (${data.checks.redis.latency}ms)`);
        } else if (redisStatus === 'degraded') {
          recordWarn('Redis health', 'Redis unavailable (degraded mode)');
        } else {
          recordWarn('Redis health', `Status: ${redisStatus}`);
        }
      }
      
      // Memory check
      if (data.checks.memory) {
        const memUsage = data.checks.memory.usage;
        if (memUsage < 85) {
          recordPass(`Memory usage: ${memUsage.toFixed(1)}%`);
        } else {
          recordWarn('Memory usage', `High memory usage: ${memUsage.toFixed(1)}%`);
        }
      }
      
      // CPU check
      if (data.checks.cpu) {
        const cpuUsage = data.checks.cpu.usage;
        if (cpuUsage < 80) {
          recordPass(`CPU usage: ${cpuUsage.toFixed(1)}%`);
        } else {
          recordWarn('CPU usage', `High CPU usage: ${cpuUsage.toFixed(1)}%`);
        }
      }
    }
    
    // Check HTTP status code
    if (response.status === 200) {
      recordPass('Health endpoint returns 200 OK');
    } else if (response.status === 503 && data.status === 'unhealthy') {
      recordWarn('Health status', 'Service unhealthy (503)');
    } else {
      recordWarn('Health status code', `Unexpected status: ${response.status}`);
    }
    
    return true;
  } catch (err) {
    recordFail('Health endpoint test', err.message);
    return false;
  }
}

/**
 * Test critical API endpoints
 */
async function testCriticalEndpoints(baseUrl, authToken) {
  section('🔌 Testing Critical API Endpoints');
  
  const endpoints = [
    {
      name: 'Root endpoint',
      path: '/',
      method: 'GET',
      expectedStatus: 200,
      checkContent: true,
    },
    {
      name: 'API health check',
      path: '/api/health',
      method: 'GET',
      expectedStatus: [200, 404], // 404 if not implemented separately
      optional: true,
    },
    {
      name: 'User session endpoint',
      path: '/api/user',
      method: 'GET',
      expectedStatus: [200, 401], // 401 if not authenticated
      requiresAuth: true,
    },
    {
      name: 'Repositories list endpoint',
      path: '/api/repositories',
      method: 'GET',
      expectedStatus: [200, 401],
      requiresAuth: true,
    },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const headers = {
        'Accept': 'application/json',
      };
      
      if (endpoint.requiresAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers,
      });
      const duration = Date.now() - startTime;
      
      const expectedStatuses = Array.isArray(endpoint.expectedStatus)
        ? endpoint.expectedStatus
        : [endpoint.expectedStatus];
      
      if (expectedStatuses.includes(response.status)) {
        recordPass(`${endpoint.name}: ${response.status} (${duration}ms)`);
        
        // Check content for root endpoint
        if (endpoint.checkContent && response.status === 200) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('text/html')) {
            recordPass('Root endpoint serves HTML');
          } else {
            recordWarn('Root endpoint', `Unexpected content-type: ${contentType}`);
          }
        }
      } else if (endpoint.optional && response.status === 404) {
        recordSkip(endpoint.name, 'Endpoint not implemented');
      } else if (endpoint.requiresAuth && response.status === 401 && !authToken) {
        recordPass(`${endpoint.name}: Requires authentication (401)`);
      } else {
        recordWarn(
          endpoint.name,
          `Unexpected status ${response.status} (expected ${expectedStatuses.join(' or ')})`
        );
      }
    } catch (err) {
      if (endpoint.optional) {
        recordSkip(endpoint.name, err.message);
      } else {
        recordFail(endpoint.name, err.message);
      }
    }
  }
}

/**
 * Test WebSocket connectivity
 */
async function testWebSocketConnectivity(baseUrl) {
  section('🔌 Testing WebSocket Connectivity');
  
  return new Promise((resolve) => {
    try {
      // Convert HTTP(S) URL to WS(S) URL
      const wsUrl = baseUrl.replace(/^http/, 'ws') + '/socket.io/?EIO=4&transport=websocket';
      
      info(`Connecting to: ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          'Origin': baseUrl,
        },
      });
      
      const timeout = setTimeout(() => {
        ws.close();
        recordWarn('WebSocket connection', 'Connection timeout (10s)');
        resolve(false);
      }, 10000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        recordPass('WebSocket connection established');
        
        // Send a ping
        ws.send('2probe');
        
        setTimeout(() => {
          ws.close();
          resolve(true);
        }, 1000);
      });
      
      ws.on('message', (data) => {
        recordPass(`WebSocket message received: ${data.toString().substring(0, 50)}`);
      });
      
      ws.on('error', (err) => {
        clearTimeout(timeout);
        recordWarn('WebSocket connection', err.message);
        resolve(false);
      });
      
      ws.on('close', () => {
        clearTimeout(timeout);
      });
    } catch (err) {
      recordWarn('WebSocket test', err.message);
      resolve(false);
    }
  });
}

/**
 * Validate environment configuration
 */
async function validateEnvironmentConfig(baseUrl) {
  section('⚙️  Validating Environment Configuration');
  
  try {
    // Test HTTPS enforcement
    if (baseUrl.startsWith('https://')) {
      recordPass('Deployment uses HTTPS');
      
      // Try HTTP redirect
      const httpUrl = baseUrl.replace('https://', 'http://');
      try {
        const response = await fetch(httpUrl, {
          redirect: 'manual',
        });
        
        if (response.status === 301 || response.status === 302) {
          const location = response.headers.get('location');
          if (location?.startsWith('https://')) {
            recordPass('HTTP redirects to HTTPS');
          } else {
            recordWarn('HTTPS redirect', 'Redirect location is not HTTPS');
          }
        } else {
          recordWarn('HTTPS enforcement', 'HTTP does not redirect to HTTPS');
        }
      } catch (err) {
        recordSkip('HTTP redirect test', 'Could not test HTTP redirect');
      }
    } else {
      recordWarn('HTTPS', 'Deployment not using HTTPS');
    }
    
    // Check security headers
    const response = await fetch(baseUrl);
    const headers = response.headers;
    
    const securityHeaders = [
      { name: 'Strict-Transport-Security', required: true },
      { name: 'X-Content-Type-Options', required: true },
      { name: 'X-Frame-Options', required: true },
      { name: 'X-XSS-Protection', required: false },
      { name: 'Content-Security-Policy', required: false },
    ];
    
    for (const header of securityHeaders) {
      if (headers.has(header.name.toLowerCase())) {
        recordPass(`Security header present: ${header.name}`);
      } else if (header.required) {
        recordWarn('Security headers', `Missing: ${header.name}`);
      } else {
        recordSkip(`Security header: ${header.name}`, 'Optional header not set');
      }
    }
    
    // Check compression
    const acceptEncodingResponse = await fetch(baseUrl, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    
    const contentEncoding = acceptEncodingResponse.headers.get('content-encoding');
    if (contentEncoding) {
      recordPass(`Response compression enabled: ${contentEncoding}`);
    } else {
      recordWarn('Compression', 'Response compression not detected');
    }
    
    // Check cache headers for static assets
    try {
      const assetResponse = await fetch(`${baseUrl}/assets/index.js`);
      if (assetResponse.ok) {
        const cacheControl = assetResponse.headers.get('cache-control');
        if (cacheControl && cacheControl.includes('max-age')) {
          recordPass(`Static asset caching configured: ${cacheControl}`);
        } else {
          recordWarn('Static assets', 'Cache headers not optimal');
        }
      }
    } catch (err) {
      recordSkip('Static asset caching', 'Could not test asset caching');
    }
    
  } catch (err) {
    recordFail('Environment configuration validation', err.message);
  }
}

/**
 * Test performance metrics
 */
async function testPerformanceMetrics(baseUrl) {
  section('⚡ Testing Performance Metrics');
  
  const tests = [
    { name: 'Health endpoint', path: '/health', maxTime: 1000 },
    { name: 'Root page', path: '/', maxTime: 2000 },
  ];
  
  for (const test of tests) {
    try {
      const startTime = Date.now();
      const response = await fetch(`${baseUrl}${test.path}`);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        if (duration < test.maxTime) {
          recordPass(`${test.name} response time: ${duration}ms (< ${test.maxTime}ms)`);
        } else {
          recordWarn(
            `${test.name} performance`,
            `Slow response: ${duration}ms (expected < ${test.maxTime}ms)`
          );
        }
      }
    } catch (err) {
      recordWarn(`${test.name} performance test`, err.message);
    }
  }
}

/**
 * Print summary
 */
function printSummary() {
  section('📊 Verification Summary');
  
  log(`\n✅ Passed: ${results.passed.length}`, colors.green);
  log(`⚠️  Warnings: ${results.warnings.length}`, colors.yellow);
  log(`❌ Failed: ${results.failed.length}`, colors.red);
  log(`⏭️  Skipped: ${results.skipped.length}`, colors.blue);
  
  if (results.failed.length > 0) {
    log('\n❌ Failed Tests:', colors.red);
    results.failed.forEach(({ test, error }) => {
      log(`  • ${test}: ${error}`, colors.red);
    });
  }
  
  if (results.warnings.length > 0) {
    log('\n⚠️  Warnings:', colors.yellow);
    results.warnings.forEach(({ test, message }) => {
      log(`  • ${test}: ${message}`, colors.yellow);
    });
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  
  if (results.failed.length === 0) {
    if (results.warnings.length === 0) {
      log('✅ DEPLOYMENT VERIFICATION PASSED', colors.green);
      log('\n🎉 Your deployment is working correctly!', colors.green);
    } else {
      log('⚠️  DEPLOYMENT VERIFICATION PASSED WITH WARNINGS', colors.yellow);
      log('\n💡 Consider addressing the warnings above.', colors.yellow);
    }
    return 0;
  } else {
    log('❌ DEPLOYMENT VERIFICATION FAILED', colors.red);
    log('\n🔧 Please fix the failed tests above.', colors.red);
    return 1;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const deploymentUrl = args[0] || process.env.DEPLOYMENT_URL;
  const authToken = process.env.VERIFY_AUTH_TOKEN;
  
  if (!deploymentUrl) {
    error('❌ Deployment URL is required');
    log('\nUsage:', colors.cyan);
    log('  node scripts/verify-deployment.js <deployment-url>');
    log('  node scripts/verify-deployment.js https://your-app.onrender.com');
    log('\nOr set DEPLOYMENT_URL environment variable:', colors.cyan);
    log('  DEPLOYMENT_URL=https://your-app.onrender.com node scripts/verify-deployment.js');
    process.exit(1);
  }
  
  // Remove trailing slash
  const baseUrl = deploymentUrl.replace(/\/$/, '');
  
  log('\n' + '='.repeat(60), colors.magenta);
  log('🚀 Deployment Verification Script', colors.magenta);
  log('='.repeat(60), colors.magenta);
  log(`\n📍 Target: ${baseUrl}`, colors.cyan);
  
  if (authToken) {
    log('🔑 Auth token provided for protected endpoints', colors.cyan);
  }
  
  log('');
  
  try {
    // Run all tests
    await testHealthEndpoint(baseUrl);
    await testCriticalEndpoints(baseUrl, authToken);
    await testWebSocketConnectivity(baseUrl);
    await validateEnvironmentConfig(baseUrl);
    await testPerformanceMetrics(baseUrl);
    
    // Print summary and exit
    const exitCode = printSummary();
    process.exit(exitCode);
  } catch (err) {
    error(`\n❌ Verification failed with error: ${err.message}`);
    log(err.stack, colors.red);
    process.exit(1);
  }
}

main();
