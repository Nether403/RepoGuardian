#!/usr/bin/env node

/**
 * Graceful Shutdown Test Script
 * 
 * This script demonstrates and tests the graceful shutdown functionality
 * by starting the server and sending shutdown signals.
 * 
 * Usage:
 *   node scripts/test-graceful-shutdown.js
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🧪 Testing Graceful Shutdown\n');

// Start the server
console.log('1️⃣  Starting server...');
const server = spawn('npm', ['run', 'dev'], {
  stdio: 'pipe',
  shell: true
});

let serverReady = false;
let shutdownStarted = false;
let shutdownComplete = false;

// Capture server output
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`   📝 ${output.trim()}`);
  
  // Check if server is ready
  if (output.includes('serving on') || output.includes('Server listening')) {
    serverReady = true;
  }
  
  // Check for shutdown messages
  if (output.includes('starting graceful shutdown')) {
    shutdownStarted = true;
    console.log('\n✅ Graceful shutdown initiated\n');
  }
  
  if (output.includes('Graceful shutdown complete')) {
    shutdownComplete = true;
    console.log('\n✅ Graceful shutdown completed successfully\n');
  }
});

server.stderr.on('data', (data) => {
  console.error(`   ❌ ${data.toString().trim()}`);
});

server.on('close', (code) => {
  console.log(`\n📊 Server process exited with code ${code}\n`);
  
  // Verify shutdown behavior
  if (shutdownStarted && shutdownComplete && code === 0) {
    console.log('✅ PASS: Graceful shutdown worked correctly');
    console.log('   - Shutdown was initiated');
    console.log('   - All services closed cleanly');
    console.log('   - Process exited with code 0');
    process.exit(0);
  } else if (shutdownStarted && !shutdownComplete) {
    console.log('⚠️  WARNING: Shutdown started but may not have completed cleanly');
    console.log(`   - Exit code: ${code}`);
    process.exit(1);
  } else {
    console.log('❌ FAIL: Graceful shutdown did not work as expected');
    process.exit(1);
  }
});

// Wait for server to start, then send shutdown signal
(async () => {
  console.log('\n2️⃣  Waiting for server to start...');
  
  // Wait up to 30 seconds for server to be ready
  for (let i = 0; i < 60; i++) {
    if (serverReady) break;
    await setTimeout(500);
  }
  
  if (!serverReady) {
    console.log('❌ Server failed to start within 30 seconds');
    server.kill('SIGKILL');
    process.exit(1);
  }
  
  console.log('✅ Server is ready\n');
  
  // Wait a bit to ensure server is fully initialized
  console.log('3️⃣  Waiting 2 seconds for full initialization...');
  await setTimeout(2000);
  
  // Send SIGTERM to trigger graceful shutdown
  console.log('\n4️⃣  Sending SIGTERM signal to trigger graceful shutdown...\n');
  server.kill('SIGTERM');
  
  // Wait for shutdown to complete (max 35 seconds)
  await setTimeout(35000);
  
  if (!shutdownComplete) {
    console.log('\n⚠️  Shutdown did not complete within 35 seconds, forcing termination...');
    server.kill('SIGKILL');
  }
})();

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test interrupted, cleaning up...');
  server.kill('SIGKILL');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test terminated, cleaning up...');
  server.kill('SIGKILL');
  process.exit(1);
});
