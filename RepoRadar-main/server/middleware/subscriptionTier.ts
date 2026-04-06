import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

// Subscription tier type
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

// Feature access type
export type Feature = 'basic_analytics' | 'advanced_analytics' | 'export' | 'api_access' | 'all';

// Tier limits configuration
export const TIER_LIMITS = {
  free: {
    apiCallsPerHour: 100,
    analysesPerDay: 10,
    features: ['basic_analytics'] as Feature[],
  },
  pro: {
    apiCallsPerHour: 1000,
    analysesPerDay: 100,
    features: ['basic_analytics', 'advanced_analytics', 'export', 'api_access'] as Feature[],
  },
  enterprise: {
    apiCallsPerHour: -1, // unlimited
    analysesPerDay: -1, // unlimited
    features: ['all'] as Feature[],
  },
} as const;

// Extended request type with user information
interface AuthenticatedRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
}

/**
 * Get user's subscription tier from the request
 */
async function getUserTier(req: AuthenticatedRequest): Promise<SubscriptionTier> {
  try {
    const userId = req.user?.claims?.sub || (req.session as any)?.user?.id;
    
    if (!userId) {
      return 'free'; // Default to free tier for unauthenticated users
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return 'free';
    }

    // Validate tier value
    const tier = user.subscriptionTier as SubscriptionTier;
    if (tier === 'free' || tier === 'pro' || tier === 'enterprise') {
      return tier;
    }

    return 'free'; // Default to free if invalid tier
  } catch (error) {
    console.error('Error getting user tier:', error);
    return 'free'; // Default to free on error
  }
}

/**
 * Check if user has access to a specific feature
 */
export function checkFeatureAccess(feature: Feature) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tier = await getUserTier(req);
      const tierConfig = TIER_LIMITS[tier];

      // Enterprise has access to all features
      if (tier === 'enterprise' || tierConfig.features.includes('all')) {
        return next();
      }

      // Check if tier has access to the requested feature
      if (tierConfig.features.includes(feature)) {
        return next();
      }

      // Feature not available for this tier
      const upgradeTier = tier === 'free' ? 'pro' : 'enterprise';
      
      return res.status(403).json({
        error: 'FEATURE_NOT_AVAILABLE',
        message: `This feature requires a ${upgradeTier} subscription`,
        currentTier: tier,
        requiredFeature: feature,
        upgradeTo: upgradeTier,
        upgradeUrl: '/subscription',
      });
    } catch (error) {
      console.error('Feature access check error:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to check feature access',
      });
    }
  };
}

/**
 * Check API rate limits based on subscription tier
 */
export function checkApiRateLimit() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub || (req.session as any)?.user?.id;
      
      if (!userId) {
        // For unauthenticated users, use IP-based rate limiting (handled by general rate limiter)
        return next();
      }

      const tier = await getUserTier(req);
      const tierConfig = TIER_LIMITS[tier];

      // Enterprise tier has unlimited API calls
      if (tierConfig.apiCallsPerHour === -1) {
        return next();
      }

      // Check API call count for the current hour
      const hourKey = `api_calls:${userId}:${getHourKey()}`;
      const apiCallCount = await getCountFromStorage(hourKey);

      if (apiCallCount >= tierConfig.apiCallsPerHour) {
        const upgradeTier = tier === 'free' ? 'pro' : 'enterprise';
        const resetTime = getNextHourReset();

        return res.status(429).json({
          error: 'API_RATE_LIMIT_EXCEEDED',
          message: `API rate limit exceeded for ${tier} tier`,
          currentTier: tier,
          limit: tierConfig.apiCallsPerHour,
          current: apiCallCount,
          resetAt: resetTime.toISOString(),
          upgradeTo: upgradeTier,
          upgradeUrl: '/subscription',
        });
      }

      // Increment API call count
      await incrementCountInStorage(hourKey, 60 * 60); // 1 hour TTL

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': tierConfig.apiCallsPerHour.toString(),
        'X-RateLimit-Remaining': Math.max(0, tierConfig.apiCallsPerHour - apiCallCount - 1).toString(),
        'X-RateLimit-Reset': getNextHourReset().toISOString(),
      });

      next();
    } catch (error) {
      console.error('API rate limit check error:', error);
      // On error, allow the request through but log it
      next();
    }
  };
}

/**
 * Check analysis limits based on subscription tier
 */
export function checkAnalysisLimit() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.claims?.sub || (req.session as any)?.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const tier = await getUserTier(req);
      const tierConfig = TIER_LIMITS[tier];

      // Enterprise tier has unlimited analyses
      if (tierConfig.analysesPerDay === -1) {
        return next();
      }

      // Get user's analysis count for today
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Check if we need to reset the daily count
      const now = new Date();
      const lastReset = user.lastAnalysisReset ? new Date(user.lastAnalysisReset) : new Date(0);
      const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);

      let analysisCount = user.analysisCount || 0;

      // Reset count if more than 24 hours have passed
      if (hoursSinceReset >= 24) {
        await storage.resetUserAnalysisCount(userId);
        analysisCount = 0;
      }

      // Check if limit exceeded
      if (analysisCount >= tierConfig.analysesPerDay) {
        const upgradeTier = tier === 'free' ? 'pro' : 'enterprise';
        const resetTime = new Date(lastReset.getTime() + 24 * 60 * 60 * 1000);

        return res.status(429).json({
          error: 'ANALYSIS_LIMIT_EXCEEDED',
          message: `Daily analysis limit exceeded for ${tier} tier`,
          currentTier: tier,
          limit: tierConfig.analysesPerDay,
          current: analysisCount,
          resetAt: resetTime.toISOString(),
          upgradeTo: upgradeTier,
          upgradeUrl: '/subscription',
        });
      }

      // Add analysis limit headers
      res.set({
        'X-Analysis-Limit': tierConfig.analysesPerDay.toString(),
        'X-Analysis-Remaining': Math.max(0, tierConfig.analysesPerDay - analysisCount).toString(),
      });

      next();
    } catch (error) {
      console.error('Analysis limit check error:', error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to check analysis limit',
      });
    }
  };
}

/**
 * Helper function to handle subscription tier changes
 * This should be called from webhook handlers when subscription status changes
 */
export async function handleSubscriptionChange(
  userId: string,
  newTier: SubscriptionTier,
  oldTier: SubscriptionTier
): Promise<void> {
  try {
    console.log(`Handling subscription change for user ${userId}: ${oldTier} -> ${newTier}`);

    // If upgrading, no need to reset counts - user gets immediate access to higher limits
    if (newTier === 'pro' || newTier === 'enterprise') {
      console.log(`User ${userId} upgraded to ${newTier}, limits immediately increased`);
      return;
    }

    // If downgrading to free, limits are immediately enforced on next request
    // No need to reset counts - the middleware will check against the new tier limits
    if (newTier === 'free') {
      console.log(`User ${userId} downgraded to free tier, limits will be enforced on next request`);
      return;
    }
  } catch (error) {
    console.error('Error handling subscription change:', error);
    throw error;
  }
}

/**
 * Combined tier limit checker for convenience
 */
export function checkTierLimit(limitType: 'api' | 'analysis') {
  if (limitType === 'api') {
    return checkApiRateLimit();
  } else if (limitType === 'analysis') {
    return checkAnalysisLimit();
  }
  
  throw new Error(`Invalid limit type: ${limitType}`);
}

// Helper functions for storage operations
// These use in-memory storage as a fallback, but should be replaced with Redis in production

const inMemoryStore = new Map<string, { count: number; expiry: number }>();

async function getCountFromStorage(key: string): Promise<number> {
  const item = inMemoryStore.get(key);
  
  if (!item) {
    return 0;
  }

  // Check if expired
  if (Date.now() > item.expiry) {
    inMemoryStore.delete(key);
    return 0;
  }

  return item.count;
}

async function incrementCountInStorage(key: string, ttlSeconds: number): Promise<number> {
  const item = inMemoryStore.get(key);
  const now = Date.now();
  const expiry = now + (ttlSeconds * 1000);

  if (!item || now > item.expiry) {
    inMemoryStore.set(key, { count: 1, expiry });
    return 1;
  }

  item.count++;
  return item.count;
}

function getHourKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
}

function getNextHourReset(): Date {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour;
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of inMemoryStore.entries()) {
    if (now > value.expiry) {
      inMemoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes
