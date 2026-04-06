import { Request, Response, NextFunction } from 'express';

/**
 * Gemini API Rate Limiter
 * 
 * Prevents hitting Google's Gemini API rate limits by implementing
 * application-level throttling based on subscription tier.
 * 
 * Google Gemini 2.5 Pro Limits (as of 2024):
 * - Free tier: 2 RPM (requests per minute), 50 RPD (requests per day)
 * - Paid tier: 1000 RPM, much higher daily limits
 * 
 * Our limits (conservative to avoid hitting Google's limits):
 * - Free tier: 5 requests per minute, 50 per hour
 * - Pro tier: 30 requests per minute, 500 per hour
 * - Enterprise tier: 60 requests per minute, 2000 per hour
 */

interface RateLimitWindow {
  count: number;
  resetTime: number;
}

// In-memory storage for rate limiting (per-user)
const rateLimitStore = new Map<string, {
  minute: RateLimitWindow;
  hour: RateLimitWindow;
}>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.minute.resetTime < now && value.hour.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface GeminiRateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
}

const TIER_LIMITS: Record<string, GeminiRateLimitConfig> = {
  free: {
    requestsPerMinute: 5,
    requestsPerHour: 50,
  },
  pro: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
  },
  enterprise: {
    requestsPerMinute: 60,
    requestsPerHour: 2000,
  },
};

function getOrCreateRateLimit(userId: string): {
  minute: RateLimitWindow;
  hour: RateLimitWindow;
} {
  const now = Date.now();
  const existing = rateLimitStore.get(userId);

  if (existing) {
    // Reset minute window if expired
    if (existing.minute.resetTime < now) {
      existing.minute = {
        count: 0,
        resetTime: now + 60 * 1000, // 1 minute
      };
    }

    // Reset hour window if expired
    if (existing.hour.resetTime < now) {
      existing.hour = {
        count: 0,
        resetTime: now + 60 * 60 * 1000, // 1 hour
      };
    }

    return existing;
  }

  const newLimit = {
    minute: {
      count: 0,
      resetTime: now + 60 * 1000,
    },
    hour: {
      count: 0,
      resetTime: now + 60 * 60 * 1000,
    },
  };

  rateLimitStore.set(userId, newLimit);
  return newLimit;
}

/**
 * Middleware to rate limit Gemini API calls based on subscription tier
 */
export function geminiRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.claims?.sub || (req.session as any)?.userId;

      if (!userId) {
        // For unauthenticated users, apply strictest limits
        return res.status(401).json({
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required for AI features',
        });
      }

      // Get user's subscription tier
      const { storage } = await import('../storage');
      const user = await storage.getUser(userId);
      const tier = user?.subscriptionTier || 'free';
      const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

      // Get or create rate limit windows
      const rateLimit = getOrCreateRateLimit(userId);

      // Check minute limit
      if (rateLimit.minute.count >= limits.requestsPerMinute) {
        const resetIn = Math.ceil((rateLimit.minute.resetTime - Date.now()) / 1000);
        return res.status(429).json({
          error: 'GEMINI_RATE_LIMIT_EXCEEDED',
          message: `AI request limit exceeded. Please wait ${resetIn} seconds.`,
          limit: limits.requestsPerMinute,
          window: 'minute',
          resetIn,
          currentTier: tier,
          suggestion: tier === 'free' 
            ? 'Upgrade to Pro for higher AI request limits'
            : 'Please wait a moment before making more AI requests',
        });
      }

      // Check hour limit
      if (rateLimit.hour.count >= limits.requestsPerHour) {
        const resetIn = Math.ceil((rateLimit.hour.resetTime - Date.now()) / 1000);
        return res.status(429).json({
          error: 'GEMINI_RATE_LIMIT_EXCEEDED',
          message: `Hourly AI request limit exceeded. Please try again in ${Math.ceil(resetIn / 60)} minutes.`,
          limit: limits.requestsPerHour,
          window: 'hour',
          resetIn,
          currentTier: tier,
          suggestion: tier === 'free' 
            ? 'Upgrade to Pro for higher AI request limits'
            : tier === 'pro'
            ? 'Upgrade to Enterprise for even higher limits'
            : 'Please wait before making more AI requests',
        });
      }

      // Increment counters
      rateLimit.minute.count++;
      rateLimit.hour.count++;

      // Add rate limit headers
      res.set({
        'X-Gemini-RateLimit-Limit-Minute': limits.requestsPerMinute.toString(),
        'X-Gemini-RateLimit-Remaining-Minute': Math.max(0, limits.requestsPerMinute - rateLimit.minute.count).toString(),
        'X-Gemini-RateLimit-Reset-Minute': new Date(rateLimit.minute.resetTime).toISOString(),
        'X-Gemini-RateLimit-Limit-Hour': limits.requestsPerHour.toString(),
        'X-Gemini-RateLimit-Remaining-Hour': Math.max(0, limits.requestsPerHour - rateLimit.hour.count).toString(),
        'X-Gemini-RateLimit-Reset-Hour': new Date(rateLimit.hour.resetTime).toISOString(),
      });

      next();
    } catch (error) {
      console.error('Gemini rate limiter error:', error);
      // On error, allow the request through but log it
      next();
    }
  };
}

/**
 * Get current rate limit status for a user (for display in UI)
 */
export async function getGeminiRateLimitStatus(userId: string, tier: string = 'free') {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const rateLimit = getOrCreateRateLimit(userId);

  return {
    tier,
    limits: {
      perMinute: limits.requestsPerMinute,
      perHour: limits.requestsPerHour,
    },
    current: {
      minute: {
        used: rateLimit.minute.count,
        remaining: Math.max(0, limits.requestsPerMinute - rateLimit.minute.count),
        resetAt: new Date(rateLimit.minute.resetTime).toISOString(),
      },
      hour: {
        used: rateLimit.hour.count,
        remaining: Math.max(0, limits.requestsPerHour - rateLimit.hour.count),
        resetAt: new Date(rateLimit.hour.resetTime).toISOString(),
      },
    },
  };
}
