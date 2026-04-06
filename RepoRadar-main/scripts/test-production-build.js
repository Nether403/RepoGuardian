#!/usr/bin/env node

/**
 * Test Production Build Script
 * 
 * This script tests the production build process locally to ensure
 * everything works correctly before deploying to Render.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function checkBuildArtifacts() {
  info('Checking build artifacts...');
  
  const checks = [
    { path: 'dist', name: 'dist directory' },
    { path: 'dist/index.js', name: 'server bundle' },
    { path: 'dist/public', name: 'client assets directory' },
    { path: 'dist/public/index.html', name: 'client HTML' },
    { path: 'dist/public/assets', name: 'bundled assets' },
  ];

  let allPassed = true;

  for (const check of checks) {
    const fullPath = join(rootDir, check.path);
    if (existsSync(fullPath)) {
      success(`${check.name} exists`);
    } else {
      error(`${check.name} not found at ${check.path}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testProductionServer() {
  info('Testing production server startup...');
  
  const testPort = 5559;
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: testPort.toString(),
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
    SESSION_SECRET: 'test-secret-for-production-build-testing',
    SESSION_ENCRYPTION_KEY: 'a'.repeat(64),
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'test-key',
    FORCE_HTTPS: 'false',
  };

  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', ['dist/index.js'], {
      env,
      stdio: 'pipe',
    });

    let serverStarted = false;
    let output = '';

    const timeout = setTimeout(() => {
      serverProcess.kill();
      reject(new Error('Server failed to start within 10 seconds'));
    }, 10000);

    serverProcess.stdout?.on('data', (data) => {
      output += data.toString();
      
      if (output.includes('Server running') || output.includes(`listening on port ${testPort}`)) {
        serverStarted = true;
        clearTimeout(timeout);
        
        // Test health endpoint
        fetch(`http://localhost:${testPort}/health`)
          .then(response => {
            if (response.ok) {
              success('Health endpoint responding');
              return response.json();
            } else {
              throw new Error(`Health endpoint returned ${response.status}`);
            }
          })
          .then(data => {
            if (data.status) {
              success(`Server health status: ${data.status}`);
            }
            
            // Gracefully shutdown
            serverProcess.kill('SIGTERM');
            
            setTimeout(() => {
              resolve();
            }, 2000);
          })
          .catch(err => {
            error(`Health check failed: ${err.message}`);
            serverProcess.kill();
            reject(err);
          });
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const errorOutput = data.toString();
      // Only log actual errors, not warnings
      if (errorOutput.includes('Error') || errorOutput.includes('error')) {
        console.error(errorOutput);
      }
    });

    serverProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (serverStarted) {
        if (code === 0 || code === null) {
          success('Server shut down gracefully');
        } else {
          warn(`Server exited with code ${code}`);
        }
      }
    });
  });
}

async function validateEnvironmentVariables() {
  info('Validating environment variable handling...');
  
  try {
    // Check if validation module exists
    const validationPath = join(rootDir, 'server', 'config', 'validation.ts');
    if (!existsSync(validationPath)) {
      warn('Configuration validation module not found');
      return false;
    }

    success('Configuration validation module exists');

    // Check if it exports the right functions
    const validationContent = readFileSync(validationPath, 'utf-8');
    
    if (validationContent.includes('export') && validationContent.includes('validateConfiguration')) {
      success('validateConfiguration function exported');
    } else {
      warn('validateConfiguration function not found');
    }

    if (validationContent.includes('initializeConfiguration')) {
      success('initializeConfiguration function found');
    }

    return true;
  } catch (err) {
    error(`Environment validation check failed: ${err.message}`);
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), colors.cyan);
  log('🧪 Testing Production Build', colors.cyan);
  log('='.repeat(60) + '\n', colors.cyan);

  try {
    // Step 1: Run production build
    log('\n📦 Step 1: Building for production...', colors.cyan);
    await runCommand('npm', ['run', 'build']);
    success('Production build completed');

    // Step 2: Check build artifacts
    log('\n📋 Step 2: Checking build artifacts...', colors.cyan);
    const artifactsOk = await checkBuildArtifacts();
    if (!artifactsOk) {
      throw new Error('Build artifacts check failed');
    }

    // Step 3: Validate environment variable handling
    log('\n🔧 Step 3: Validating environment configuration...', colors.cyan);
    await validateEnvironmentVariables();

    // Step 4: Test production server
    log('\n🚀 Step 4: Testing production server...', colors.cyan);
    await testProductionServer();

    // Success summary
    log('\n' + '='.repeat(60), colors.green);
    log('✅ Production Build Test PASSED', colors.green);
    log('='.repeat(60), colors.green);
    log('\n🎉 Your application is ready for production deployment!', colors.green);
    log('\nNext steps:', colors.cyan);
    log('  1. Commit your changes to Git');
    log('  2. Push to your repository');
    log('  3. Deploy to Render');
    log('  4. Configure environment variables in Render dashboard');
    log('  5. Monitor the deployment logs\n');

    process.exit(0);
  } catch (err) {
    log('\n' + '='.repeat(60), colors.red);
    log('❌ Production Build Test FAILED', colors.red);
    log('='.repeat(60), colors.red);
    error(`\nError: ${err.message}`);
    log('\n💡 Fix the issues above and try again.\n', colors.yellow);
    process.exit(1);
  }
}

main();
