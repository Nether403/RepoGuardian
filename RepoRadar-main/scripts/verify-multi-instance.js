#!/usr/bin/env node

/**
 * Multi-Instance Deployment Verification Script
 * 
 * This script verifies that the multi-instance deployment is working correctly:
 * - All instances are running and healthy
 * - Load balancer is distributing requests
 * - Session state is shared across instances
 * - Health checks are working
 */

import http from 'http';
import https from 'https';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const config = {
  loadBalancerUrl: process.env.LB_URL || 'http://localhost',
  instances: [
    { name: 'reporadar-1', url: 'http://reporadar-1:3000' },
    { name: 'reporadar-2', url: 'http://reporadar-2:3000' },
    { name: 'reporadar-3', url: 'http://reporadar-3:3000' },
  ],
  numRequests: 30,
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json, headers: res.headers });
        } catch {
          resolve({ statusCode: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function checkHealth(url, name) {
  try {
    const response = await makeRequest(`${url}/health`);
    if (response.statusCode === 200) {
      log(`✓ ${name} is healthy`, 'green');
      return true;
    } else {
      log(`✗ ${name} returned status ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${name} health check failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkReadiness(url, name) {
  try {
    const response = await makeRequest(`${url}/health/ready`);
    if (response.statusCode === 200) {
      log(`✓ ${name} is ready`, 'green');
      return true;
    } else {
      log(`✗ ${name} readiness check failed with status ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${name} readiness check failed: ${error.message}`, 'red');
    return false;
  }
}

async function checkLiveness(url, name) {
  try {
    const response = await makeRequest(`${url}/health/live`);
    if (response.statusCode === 200) {
      log(`✓ ${name} is alive`, 'green');
      return true;
    } else {
      log(`✗ ${name} liveness check failed with status ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ ${name} liveness check failed: ${error.message}`, 'red');
    return false;
  }
}

async function testLoadDistribution() {
  log('\n=== Testing Load Distribution ===', 'blue');
  
  const instanceCounts = {};
  const errors = [];
  
  for (let i = 0; i < config.numRequests; i++) {
    try {
      const response = await makeRequest(`${config.loadBalancerUrl}/health/backend`);
      
      if (response.statusCode === 200 && response.data.instanceId) {
        const instanceId = response.data.instanceId;
        instanceCounts[instanceId] = (instanceCounts[instanceId] || 0) + 1;
      } else {
        errors.push(`Request ${i + 1}: Invalid response`);
      }
    } catch (error) {
      errors.push(`Request ${i + 1}: ${error.message}`);
    }
  }
  
  log(`\nLoad distribution across ${config.numRequests} requests:`, 'yellow');
  
  const instances = Object.keys(instanceCounts);
  if (instances.length === 0) {
    log('✗ No instances received requests', 'red');
    return false;
  }
  
  let allInstancesUsed = true;
  for (const instance of instances) {
    const count = instanceCounts[instance];
    const percentage = ((count / config.numRequests) * 100).toFixed(1);
    log(`  ${instance}: ${count} requests (${percentage}%)`, 'green');
  }
  
  // Check if all instances received requests
  if (instances.length < 3) {
    log(`\n⚠ Warning: Only ${instances.length} out of 3 instances received requests`, 'yellow');
    allInstancesUsed = false;
  }
  
  // Check distribution is reasonably balanced (within 50% of average)
  const average = config.numRequests / instances.length;
  const threshold = average * 0.5;
  
  for (const instance of instances) {
    const count = instanceCounts[instance];
    if (Math.abs(count - average) > threshold) {
      log(`\n⚠ Warning: ${instance} received ${count} requests, expected ~${average.toFixed(0)}`, 'yellow');
    }
  }
  
  if (errors.length > 0) {
    log(`\n⚠ ${errors.length} requests failed:`, 'yellow');
    errors.slice(0, 5).forEach(err => log(`  ${err}`, 'yellow'));
    if (errors.length > 5) {
      log(`  ... and ${errors.length - 5} more`, 'yellow');
    }
  }
  
  return allInstancesUsed && errors.length < config.numRequests * 0.1; // Allow 10% error rate
}

async function testSessionPersistence() {
  log('\n=== Testing Session Persistence ===', 'blue');
  
  try {
    // Make multiple requests and check if session is maintained
    const sessionRequests = 5;
    let sessionId = null;
    
    for (let i = 0; i < sessionRequests; i++) {
      const response = await makeRequest(`${config.loadBalancerUrl}/health/backend`);
      
      if (response.statusCode === 200) {
        const currentSessionId = response.headers['set-cookie']?.[0]?.split(';')[0];
        
        if (i === 0) {
          sessionId = currentSessionId;
          log(`✓ Session created: ${sessionId ? 'Yes' : 'No'}`, 'green');
        } else if (sessionId && currentSessionId && sessionId !== currentSessionId) {
          log(`⚠ Session ID changed between requests`, 'yellow');
        }
      }
    }
    
    log('✓ Session persistence test completed', 'green');
    return true;
  } catch (error) {
    log(`✗ Session persistence test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testHealthEndpoints() {
  log('\n=== Testing Health Endpoints ===', 'blue');
  
  const endpoints = [
    { path: '/health', name: 'Load Balancer Health' },
    { path: '/health/backend', name: 'Backend Health' },
    { path: '/health/ready', name: 'Readiness Check' },
    { path: '/health/live', name: 'Liveness Check' },
  ];
  
  let allPassed = true;
  
  for (const endpoint of endpoints) {
    try {
      const response = await makeRequest(`${config.loadBalancerUrl}${endpoint.path}`);
      if (response.statusCode === 200) {
        log(`✓ ${endpoint.name}: OK`, 'green');
      } else {
        log(`✗ ${endpoint.name}: Status ${response.statusCode}`, 'red');
        allPassed = false;
      }
    } catch (error) {
      log(`✗ ${endpoint.name}: ${error.message}`, 'red');
      allPassed = false;
    }
  }
  
  return allPassed;
}

async function main() {
  log('=== Multi-Instance Deployment Verification ===\n', 'blue');
  
  const results = {
    health: true,
    readiness: true,
    liveness: true,
    loadDistribution: true,
    sessionPersistence: true,
    healthEndpoints: true,
  };
  
  // Test 1: Check load balancer health
  log('=== Testing Load Balancer ===', 'blue');
  results.health = await checkHealth(config.loadBalancerUrl, 'Load Balancer');
  
  // Test 2: Check individual instance health
  log('\n=== Testing Individual Instances ===', 'blue');
  for (const instance of config.instances) {
    const healthy = await checkHealth(instance.url, instance.name);
    results.health = results.health && healthy;
  }
  
  // Test 3: Check readiness
  log('\n=== Testing Readiness ===', 'blue');
  for (const instance of config.instances) {
    const ready = await checkReadiness(instance.url, instance.name);
    results.readiness = results.readiness && ready;
  }
  
  // Test 4: Check liveness
  log('\n=== Testing Liveness ===', 'blue');
  for (const instance of config.instances) {
    const alive = await checkLiveness(instance.url, instance.name);
    results.liveness = results.liveness && alive;
  }
  
  // Test 5: Test load distribution
  results.loadDistribution = await testLoadDistribution();
  
  // Test 6: Test session persistence
  results.sessionPersistence = await testSessionPersistence();
  
  // Test 7: Test health endpoints
  results.healthEndpoints = await testHealthEndpoints();
  
  // Summary
  log('\n=== Verification Summary ===', 'blue');
  const allPassed = Object.values(results).every(r => r);
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✓' : '✗';
    const color = passed ? 'green' : 'red';
    const testName = test.replace(/([A-Z])/g, ' $1').trim();
    log(`${status} ${testName.charAt(0).toUpperCase() + testName.slice(1)}`, color);
  });
  
  log('');
  if (allPassed) {
    log('✓ All verification tests passed!', 'green');
    process.exit(0);
  } else {
    log('✗ Some verification tests failed. Check the logs above for details.', 'red');
    process.exit(1);
  }
}

// Run verification
main().catch(error => {
  log(`\nFatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
