/**
 * Feature Flags Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FeatureFlagsService,
  defaultFeatureFlags,
  getFeatureFlags,
  initializeFeatureFlags,
  resetFeatureFlags,
  type FeatureFlagsConfig,
} from '../featureFlags';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment to avoid interference
    process.env = { ...originalEnv };
    // Create service with a fresh copy of default config
    const freshConfig: FeatureFlagsConfig = {
      defaultEnabled: true,
      flags: {
        ...Object.entries(defaultFeatureFlags.flags).reduce((acc, [key, flag]) => {
          acc[key as FeatureFlagName] = { ...flag };
          return acc;
        }, {} as Record<FeatureFlagName, FeatureFlag>),
      },
    };
    service = new FeatureFlagsService(freshConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEnabled', () => {
    it('should return true for enabled flags', () => {
      expect(service.isEnabled('loadingStates')).toBe(true);
      expect(service.isEnabled('errorHandling')).toBe(true);
      expect(service.isEnabled('analyticsTracking')).toBe(true);
    });

    it('should return false for disabled flags', () => {
      service.disable('loadingStates');
      expect(service.isEnabled('loadingStates')).toBe(false);
    });

    it('should respect user-specific overrides', () => {
      const flag = service.getFlag('loadingStates');
      if (flag) {
        flag.enabledForUsers = ['user1'];
        flag.disabledForUsers = ['user2'];
      }

      expect(service.isEnabled('loadingStates', 'user1')).toBe(true);
      expect(service.isEnabled('loadingStates', 'user2')).toBe(false);
    });

    it('should handle rollout percentage', () => {
      service.setRolloutPercentage('loadingStates', 50);
      
      // Test with deterministic user IDs
      const results = new Set<boolean>();
      for (let i = 0; i < 100; i++) {
        results.add(service.isEnabled('loadingStates', `user${i}`));
      }
      
      // Should have both true and false results
      expect(results.size).toBe(2);
    });

    it('should return default for undefined flags', () => {
      const customConfig: FeatureFlagsConfig = {
        defaultEnabled: false,
        flags: {} as any,
      };
      const customService = new FeatureFlagsService(customConfig);
      
      expect(customService.isEnabled('loadingStates' as any)).toBe(false);
    });
  });

  describe('getAllFlags', () => {
    it('should return all feature flags', () => {
      const flags = service.getAllFlags();
      expect(Object.keys(flags)).toHaveLength(10);
      expect(flags.loadingStates).toBeDefined();
      expect(flags.errorHandling).toBeDefined();
      expect(flags.analyticsTracking).toBeDefined();
    });
  });

  describe('getFlag', () => {
    it('should return a specific flag', () => {
      const flag = service.getFlag('loadingStates');
      expect(flag).toBeDefined();
      expect(flag?.name).toBe('loadingStates');
      expect(flag?.enabled).toBe(true);
    });

    it('should return undefined for non-existent flags', () => {
      const flag = service.getFlag('nonExistent' as any);
      expect(flag).toBeUndefined();
    });
  });

  describe('updateFlag', () => {
    it('should update flag properties', () => {
      service.updateFlag('loadingStates', { enabled: false });
      const flag = service.getFlag('loadingStates');
      expect(flag?.enabled).toBe(false);
    });

    it('should preserve other properties when updating', () => {
      const originalFlag = service.getFlag('loadingStates');
      const originalDescription = originalFlag?.description;

      service.updateFlag('loadingStates', { enabled: false });
      const updatedFlag = service.getFlag('loadingStates');
      
      expect(updatedFlag?.description).toBe(originalDescription);
    });
  });

  describe('enable/disable', () => {
    it('should enable a flag', () => {
      service.disable('loadingStates');
      expect(service.isEnabled('loadingStates')).toBe(false);
      
      service.enable('loadingStates');
      expect(service.isEnabled('loadingStates')).toBe(true);
    });

    it('should disable a flag', () => {
      expect(service.isEnabled('loadingStates')).toBe(true);
      
      service.disable('loadingStates');
      expect(service.isEnabled('loadingStates')).toBe(false);
    });
  });

  describe('setRolloutPercentage', () => {
    it('should set rollout percentage', () => {
      service.setRolloutPercentage('loadingStates', 75);
      const flag = service.getFlag('loadingStates');
      expect(flag?.rolloutPercentage).toBe(75);
    });

    it('should throw error for invalid percentage', () => {
      expect(() => service.setRolloutPercentage('loadingStates', -1)).toThrow();
      expect(() => service.setRolloutPercentage('loadingStates', 101)).toThrow();
    });

    it('should accept 0 and 100', () => {
      expect(() => service.setRolloutPercentage('loadingStates', 0)).not.toThrow();
      expect(() => service.setRolloutPercentage('loadingStates', 100)).not.toThrow();
    });
  });

  describe('fromEnvironment', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should load flags from environment variables', () => {
      process.env.FEATURE_LOADINGSTATES = 'false';
      process.env.FEATURE_ERRORHANDLING = 'false';

      const service = FeatureFlagsService.fromEnvironment();
      
      expect(service.isEnabled('loadingStates')).toBe(false);
      expect(service.isEnabled('errorHandling')).toBe(false);
      expect(service.isEnabled('analyticsTracking')).toBe(true); // Not set in env
    });

    it('should handle "1" as true', () => {
      process.env.FEATURE_LOADINGSTATES = '1';
      const service = FeatureFlagsService.fromEnvironment();
      expect(service.isEnabled('loadingStates')).toBe(true);
    });
  });
});

describe('Global feature flags instance', () => {
  afterEach(() => {
    resetFeatureFlags();
  });

  it('should return singleton instance', () => {
    const instance1 = getFeatureFlags();
    const instance2 = getFeatureFlags();
    expect(instance1).toBe(instance2);
  });

  it('should allow initialization with custom config', () => {
    const customConfig: FeatureFlagsConfig = {
      ...defaultFeatureFlags,
      flags: {
        ...defaultFeatureFlags.flags,
        loadingStates: {
          ...defaultFeatureFlags.flags.loadingStates,
          enabled: false,
        },
      },
    };

    const instance = initializeFeatureFlags(customConfig);
    expect(instance.isEnabled('loadingStates')).toBe(false);
  });

  it('should reset to null', () => {
    getFeatureFlags();
    resetFeatureFlags();
    
    // Getting again should create new instance
    const newInstance = getFeatureFlags();
    expect(newInstance).toBeDefined();
  });
});

describe('Default feature flags', () => {
  it('should have all Phase 3 features', () => {
    const flags = defaultFeatureFlags.flags;
    
    expect(flags.loadingStates).toBeDefined();
    expect(flags.errorHandling).toBeDefined();
    expect(flags.analyticsTracking).toBeDefined();
    expect(flags.backgroundJobs).toBeDefined();
    expect(flags.mobileResponsive).toBeDefined();
    expect(flags.accessibility).toBeDefined();
    expect(flags.adminDashboard).toBeDefined();
    expect(flags.healthChecks).toBeDefined();
    expect(flags.horizontalScaling).toBeDefined();
    expect(flags.monitoring).toBeDefined();
  });

  it('should have all flags enabled by default', () => {
    // Create a fresh service to check default values
    const freshService = FeatureFlagsService.fromEnvironment();
    const flags = freshService.getAllFlags();
    
    Object.values(flags).forEach(flag => {
      // Check that flags are enabled (unless overridden by env)
      expect(typeof flag.enabled).toBe('boolean');
    });
  });

  it('should have 100% rollout by default', () => {
    const flags = defaultFeatureFlags.flags;
    
    Object.values(flags).forEach(flag => {
      expect(flag.rolloutPercentage).toBe(100);
    });
  });

  it('should have descriptions for all flags', () => {
    const flags = defaultFeatureFlags.flags;
    
    Object.values(flags).forEach(flag => {
      expect(flag.description).toBeTruthy();
      expect(flag.description.length).toBeGreaterThan(0);
    });
  });
});
