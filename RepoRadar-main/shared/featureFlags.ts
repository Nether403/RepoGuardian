/**
 * Feature Flags System
 * 
 * Provides a centralized system for managing feature flags across the application.
 * Supports rollback capability for all Phase 3 features.
 */

export type FeatureFlagName =
  | 'loadingStates'
  | 'errorHandling'
  | 'analyticsTracking'
  | 'backgroundJobs'
  | 'mobileResponsive'
  | 'accessibility'
  | 'adminDashboard'
  | 'healthChecks'
  | 'horizontalScaling'
  | 'monitoring';

export interface FeatureFlag {
  name: FeatureFlagName;
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // 0-100, for gradual rollout
  enabledForUsers?: string[]; // Specific user IDs
  disabledForUsers?: string[]; // Specific user IDs to exclude
}

export interface FeatureFlagsConfig {
  flags: Record<FeatureFlagName, FeatureFlag>;
  defaultEnabled: boolean; // Default state for undefined flags
}

/**
 * Default feature flags configuration
 * All Phase 3 features are enabled by default but can be disabled for rollback
 */
export const defaultFeatureFlags: FeatureFlagsConfig = {
  defaultEnabled: true,
  flags: {
    loadingStates: {
      name: 'loadingStates',
      enabled: true,
      description: 'Enable skeleton screens and loading indicators',
      rolloutPercentage: 100,
    },
    errorHandling: {
      name: 'errorHandling',
      enabled: true,
      description: 'Enable enhanced error messages and recovery UI',
      rolloutPercentage: 100,
    },
    analyticsTracking: {
      name: 'analyticsTracking',
      enabled: true,
      description: 'Enable user analytics and behavior tracking',
      rolloutPercentage: 100,
    },
    backgroundJobs: {
      name: 'backgroundJobs',
      enabled: true,
      description: 'Enable background job processing for long-running tasks',
      rolloutPercentage: 100,
    },
    mobileResponsive: {
      name: 'mobileResponsive',
      enabled: true,
      description: 'Enable mobile-responsive layouts and touch optimizations',
      rolloutPercentage: 100,
    },
    accessibility: {
      name: 'accessibility',
      enabled: true,
      description: 'Enable accessibility features (keyboard nav, ARIA labels, etc.)',
      rolloutPercentage: 100,
    },
    adminDashboard: {
      name: 'adminDashboard',
      enabled: true,
      description: 'Enable admin dashboard and monitoring features',
      rolloutPercentage: 100,
    },
    healthChecks: {
      name: 'healthChecks',
      enabled: true,
      description: 'Enable health check endpoints for load balancers',
      rolloutPercentage: 100,
    },
    horizontalScaling: {
      name: 'horizontalScaling',
      enabled: true,
      description: 'Enable horizontal scaling features (Redis sessions, etc.)',
      rolloutPercentage: 100,
    },
    monitoring: {
      name: 'monitoring',
      enabled: true,
      description: 'Enable monitoring, logging, and observability features',
      rolloutPercentage: 100,
    },
  },
};

/**
 * Feature Flags Service
 * Manages feature flag state and provides methods to check flag status
 */
export class FeatureFlagsService {
  private config: FeatureFlagsConfig;

  constructor(config: FeatureFlagsConfig = defaultFeatureFlags) {
    this.config = config;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flagName: FeatureFlagName, userId?: string): boolean {
    const flag = this.config.flags[flagName];

    if (!flag) {
      return this.config.defaultEnabled;
    }

    // Check if explicitly disabled
    if (!flag.enabled) {
      return false;
    }

    // Check user-specific overrides
    if (userId) {
      if (flag.disabledForUsers?.includes(userId)) {
        return false;
      }
      if (flag.enabledForUsers?.includes(userId)) {
        return true;
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      if (userId) {
        // Deterministic rollout based on user ID
        const hash = this.hashUserId(userId);
        return hash < flag.rolloutPercentage;
      }
      // Random rollout for anonymous users
      return Math.random() * 100 < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): Record<FeatureFlagName, FeatureFlag> {
    return this.config.flags;
  }

  /**
   * Get a specific feature flag
   */
  getFlag(flagName: FeatureFlagName): FeatureFlag | undefined {
    return this.config.flags[flagName];
  }

  /**
   * Update a feature flag
   */
  updateFlag(flagName: FeatureFlagName, updates: Partial<FeatureFlag>): void {
    const flag = this.config.flags[flagName];
    if (flag) {
      this.config.flags[flagName] = { ...flag, ...updates };
    }
  }

  /**
   * Enable a feature flag
   */
  enable(flagName: FeatureFlagName): void {
    this.updateFlag(flagName, { enabled: true });
  }

  /**
   * Disable a feature flag
   */
  disable(flagName: FeatureFlagName): void {
    this.updateFlag(flagName, { enabled: false });
  }

  /**
   * Set rollout percentage for gradual rollout
   */
  setRolloutPercentage(flagName: FeatureFlagName, percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    this.updateFlag(flagName, { rolloutPercentage: percentage });
  }

  /**
   * Hash user ID for deterministic rollout
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  /**
   * Load configuration from environment or external source
   */
  static fromEnvironment(): FeatureFlagsService {
    const config = { ...defaultFeatureFlags };

    // Override from environment variables
    Object.keys(config.flags).forEach((key) => {
      const flagName = key as FeatureFlagName;
      const envKey = `FEATURE_${key.toUpperCase()}`;
      const envValue = process.env[envKey];

      if (envValue !== undefined) {
        config.flags[flagName].enabled = envValue === 'true' || envValue === '1';
      }
    });

    return new FeatureFlagsService(config);
  }
}

// Singleton instance
let featureFlagsInstance: FeatureFlagsService | null = null;

/**
 * Get the global feature flags instance
 */
export function getFeatureFlags(): FeatureFlagsService {
  if (!featureFlagsInstance) {
    featureFlagsInstance = FeatureFlagsService.fromEnvironment();
  }
  return featureFlagsInstance;
}

/**
 * Initialize feature flags with custom configuration
 */
export function initializeFeatureFlags(config?: FeatureFlagsConfig): FeatureFlagsService {
  featureFlagsInstance = new FeatureFlagsService(config);
  return featureFlagsInstance;
}

/**
 * Reset feature flags to default (useful for testing)
 */
export function resetFeatureFlags(): void {
  featureFlagsInstance = null;
}
