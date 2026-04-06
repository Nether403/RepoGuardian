import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

describe('Deployment Verification Script', () => {
  const scriptPath = join(process.cwd(), 'scripts', 'verify-deployment.js');

  it('should exist as a file', () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('should fail when no URL is provided', async () => {
    const result = await runScript([]);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Deployment URL is required');
  });

  it('should show usage information when no URL provided', async () => {
    const result = await runScript([]);
    expect(result.output).toContain('Usage:');
    expect(result.output).toContain('node scripts/verify-deployment.js');
  });

  it('should accept URL as command line argument', async () => {
    // This will fail to connect but should show it's trying
    const result = await runScript(['http://localhost:9999']);
    expect(result.output).toContain('Testing Health Endpoint');
  });

  it('should accept URL from environment variable', async () => {
    const result = await runScript([], { DEPLOYMENT_URL: 'http://localhost:9999' });
    expect(result.output).toContain('Testing Health Endpoint');
  });

  it('should show auth token message when provided', async () => {
    const result = await runScript(['http://localhost:9999'], { VERIFY_AUTH_TOKEN: 'test-token' });
    expect(result.output).toContain('Auth token provided');
  });

  it('should test all verification categories', async () => {
    const result = await runScript(['http://localhost:9999']);
    expect(result.output).toContain('Testing Health Endpoint');
    expect(result.output).toContain('Testing Critical API Endpoints');
    expect(result.output).toContain('Testing WebSocket Connectivity');
    expect(result.output).toContain('Validating Environment Configuration');
    expect(result.output).toContain('Testing Performance Metrics');
  });

  it('should print verification summary', async () => {
    const result = await runScript(['http://localhost:9999']);
    expect(result.output).toContain('Verification Summary');
    expect(result.output).toContain('Passed:');
    expect(result.output).toContain('Warnings:');
    expect(result.output).toContain('Failed:');
  });
});

/**
 * Helper function to run the verification script
 */
function runScript(args: string[], env: Record<string, string> = {}): Promise<{
  exitCode: number;
  output: string;
}> {
  const scriptPath = join(process.cwd(), 'scripts', 'verify-deployment.js');
  return new Promise((resolve) => {
    const proc = spawn('node', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });

    let output = '';

    proc.stdout?.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      output += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        output,
      });
    });

    proc.on('error', (err) => {
      resolve({
        exitCode: 1,
        output: output + err.message,
      });
    });
  });
}
