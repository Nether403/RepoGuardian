/**
 * Feature Flags Middleware
 * 
 * Provides Express middleware for feature flag checks and management
 */

import { Request, Response, NextFunction } from 'express';
import { getFeatureFlags, FeatureFlagName } from '../../shared/featureFlags';

/**
 * Extend Express Request to include feature flags
 */
declare global {
  namespace Express {
    interface Request {
      featureFlags?: {
        isEnabled: (flagName: FeatureFlagName) => boolean;
      };
    }
  }
}

/**
 * Middleware to attach feature flags to request
 */
export function featureFlagsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const featureFlags = getFeatureFlags();
  const userId = req.session?.userId;

  req.featureFlags = {
    isEnabled: (flagName: FeatureFlagName) => featureFlags.isEnabled(flagName, userId),
  };

  next();
}

/**
 * Middleware to require a specific feature flag
 */
export function requireFeatureFlag(flagName: FeatureFlagName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const featureFlags = getFeatureFlags();
    const userId = req.session?.userId;

    if (!featureFlags.isEnabled(flagName, userId)) {
      res.status(503).json({
        error: 'Feature not available',
        message: `The ${flagName} feature is currently disabled`,
        code: 'FEATURE_DISABLED',
      });
      return;
    }

    next();
  };
}

/**
 * Admin endpoint to get all feature flags
 */
export function getFeatureFlagsHandler(req: Request, res: Response): void {
  const featureFlags = getFeatureFlags();
  const flags = featureFlags.getAllFlags();

  res.json({
    flags: Object.entries(flags).map(([name, flag]) => ({
      name,
      enabled: flag.enabled,
      description: flag.description,
      rolloutPercentage: flag.rolloutPercentage,
    })),
  });
}

/**
 * Admin endpoint to update a feature flag
 */
export function updateFeatureFlagHandler(req: Request, res: Response): void {
  const { flagName } = req.params;
  const { enabled, rolloutPercentage } = req.body;

  const featureFlags = getFeatureFlags();
  const flag = featureFlags.getFlag(flagName as FeatureFlagName);

  if (!flag) {
    res.status(404).json({
      error: 'Feature flag not found',
      message: `Feature flag '${flagName}' does not exist`,
    });
    return;
  }

  try {
    if (enabled !== undefined) {
      if (enabled) {
        featureFlags.enable(flagName as FeatureFlagName);
      } else {
        featureFlags.disable(flagName as FeatureFlagName);
      }
    }

    if (rolloutPercentage !== undefined) {
      featureFlags.setRolloutPercentage(flagName as FeatureFlagName, rolloutPercentage);
    }

    const updatedFlag = featureFlags.getFlag(flagName as FeatureFlagName);
    res.json({
      success: true,
      flag: updatedFlag,
    });
  } catch (error) {
    res.status(400).json({
      error: 'Invalid request',
      message: error instanceof Error ? error.message : 'Failed to update feature flag',
    });
  }
}
