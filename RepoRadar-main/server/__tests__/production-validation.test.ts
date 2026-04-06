import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Production Configuration Validation Tests
 * 
 * These tests validate that the application is properly configured for production:
 * - Production build process works correctly
 * - Configuration files are properly structured
 * - Server code uses correct environment variables
 * - Required modules and files exist
 */

describe('Production Configuration Validation', () => {
  describe('Production Build Process', () => {
    it('should have dist directory after build', () => {
      const distDir = join(process.cwd(), 'dist');
      expect(existsSync(distDir)).toBe(true);
    });

    it('should have compiled server entry point', () => {
      const serverEntry = join(process.cwd(), 'dist', 'index.js');
      expect(existsSync(serverEntry)).toBe(true);
    });

    it('should have built client assets', () => {
      const publicDir = join(process.cwd(), 'dist', 'public');
      expect(existsSync(publicDir)).toBe(true);
    });

    it('should have index.html in public directory', () => {
      const indexHtml = join(process.cwd(), 'dist', 'public', 'index.html');
      expect(existsSync(indexHtml)).toBe(true);
    });

    it('should have assets directory with bundled files', () => {
      const assetsDir = join(process.cwd(), 'dist', 'public', 'assets');
      expect(existsSync(assetsDir)).toBe(true);
    });
  });

  describe('Configuration Files', () => {
    it('should have configuration validation module', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      expect(existsSync(validationPath)).toBe(true);
    });

    it('should have health check module', () => {
      const healthPath = join(process.cwd(), 'server', 'health.ts');
      expect(existsSync(healthPath)).toBe(true);
    });

    it('should have graceful shutdown module', () => {
      const shutdownPath = join(process.cwd(), 'server', 'gracefulShutdown.ts');
      expect(existsSync(shutdownPath)).toBe(true);
    });

    it('should have HTTPS enforcement middleware', () => {
      const httpsPath = join(process.cwd(), 'server', 'middleware', 'httpsEnforcement.ts');
      expect(existsSync(httpsPath)).toBe(true);
    });

    it('should have CORS middleware', () => {
      const corsPath = join(process.cwd(), 'server', 'middleware', 'cors.ts');
      expect(existsSync(corsPath)).toBe(true);
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should have validation module with required exports', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      const content = readFileSync(validationPath, 'utf-8');
      
      expect(content).toContain('validateConfiguration');
      expect(content).toContain('initializeConfiguration');
      expect(content).toContain('export');
    });

    it('should validate PORT environment variable', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      const content = readFileSync(validationPath, 'utf-8');
      
      expect(content).toContain('PORT');
    });

    it('should validate DATABASE_URL', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      const content = readFileSync(validationPath, 'utf-8');
      
      expect(content).toContain('DATABASE_URL');
    });

    it('should validate SESSION_SECRET', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      const content = readFileSync(validationPath, 'utf-8');
      
      expect(content).toContain('SESSION_SECRET');
    });

    it('should validate GEMINI_API_KEY', () => {
      const validationPath = join(process.cwd(), 'server', 'config', 'validation.ts');
      const content = readFileSync(validationPath, 'utf-8');
      
      expect(content).toContain('GEMINI_API_KEY');
    });
  });

  describe('Production Server Configuration', () => {
    it('should use PORT environment variable in compiled code', () => {
      const serverCode = readFileSync('dist/index.js', 'utf-8');
      
      // Check that PORT is read from environment
      expect(serverCode).toContain('process.env.PORT');
    });

    it('should have NODE_ENV handling in compiled code', () => {
      const serverCode = readFileSync('dist/index.js', 'utf-8');
      
      // Check that NODE_ENV is checked
      expect(serverCode).toContain('NODE_ENV');
    });

    it('should have health endpoint in compiled code', () => {
      const serverCode = readFileSync('dist/index.js', 'utf-8');
      
      // Check that health endpoint exists
      expect(serverCode).toContain('/health');
    });
  });

  describe('Package.json Scripts', () => {
    it('should have build script', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('build');
    });

    it('should have start script', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('start');
    });

    it('should have production validation script', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('production:validate');
    });

    it('should have production test script', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('production:test');
    });

    it('should have config validation script', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      expect(packageJson.scripts).toHaveProperty('config:validate');
    });
  });

  describe('Documentation', () => {
    it('should have production validation documentation', () => {
      const docPath = join(process.cwd(), 'docs', 'PRODUCTION_VALIDATION.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should have render deployment guide', () => {
      const docPath = join(process.cwd(), 'docs', 'RENDER_DEPLOYMENT_GUIDE.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should have graceful shutdown guide', () => {
      const docPath = join(process.cwd(), 'docs', 'GRACEFUL_SHUTDOWN_GUIDE.md');
      expect(existsSync(docPath)).toBe(true);
    });

    it('should have database production config documentation', () => {
      const docPath = join(process.cwd(), 'docs', 'DATABASE_PRODUCTION_CONFIG.md');
      expect(existsSync(docPath)).toBe(true);
    });
  });

  describe('Validation Scripts', () => {
    it('should have production readiness validation script', () => {
      const scriptPath = join(process.cwd(), 'scripts', 'validate-production-readiness.js');
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('should have production build test script', () => {
      const scriptPath = join(process.cwd(), 'scripts', 'test-production-build.js');
      expect(existsSync(scriptPath)).toBe(true);
    });

    it('should have graceful shutdown test script', () => {
      const scriptPath = join(process.cwd(), 'scripts', 'test-graceful-shutdown.js');
      expect(existsSync(scriptPath)).toBe(true);
    });
  });
});
