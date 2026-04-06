# Gemini API Rate Limiting Implementation

## Problem

After upgrading to Pro subscription, the code review feature immediately hit Google's Gemini API rate limits. This happened because:

1. **Before Pro**: The feature was blocked by tier restrictions, so Gemini API was never actually called
2. **After Pro**: The feature worked, making multiple Gemini API calls in quick succession
3. **No Protection**: There was no application-level rate limiting for Gemini API calls

## Google Gemini API Limits

According to Google's documentation, Gemini 2.5 Pro has these limits:
- **Free tier**: 2 requests per minute (RPM), 50 requests per day (RPD)
- **Paid tier**: 1000 RPM, higher daily limits

## Solution

Created a new Gemini-specific rate limiter middleware that prevents hitting Google's API limits by implementing application-level throttling based on subscription tier.

### Implementation

**File**: `server/middleware/geminiRateLimiter.ts`

#### Rate Limits (Conservative to avoid hitting Google's limits)

| Tier | Requests/Minute | Requests/Hour |
|------|----------------|---------------|
| Free | 5 | 50 |
| Pro | 30 | 500 |
| Enterprise | 60 | 2000 |

#### Features

1. **Per-User Tracking**: Tracks rate limits separately for each user
2. **Dual Windows**: Enforces both per-minute and per-hour limits
3. **Automatic Cleanup**: Removes expired rate limit entries every 5 minutes
4. **Informative Errors**: Returns clear error messages with reset times
5. **Rate Limit Headers**: Adds headers showing current usage and limits
6. **Upgrade Suggestions**: Suggests tier upgrades when limits are hit

#### Response Headers

The middleware adds these headers to every response:
- `X-Gemini-RateLimit-Limit-Minute`: Maximum requests per minute
- `X-Gemini-RateLimit-Remaining-Minute`: Remaining requests this minute
- `X-Gemini-RateLimit-Reset-Minute`: When the minute window resets
- `X-Gemini-RateLimit-Limit-Hour`: Maximum requests per hour
- `X-Gemini-RateLimit-Remaining-Hour`: Remaining requests this hour
- `X-Gemini-RateLimit-Reset-Hour`: When the hour window resets

#### Error Response

When rate limit is exceeded:
```json
{
  "error": "GEMINI_RATE_LIMIT_EXCEEDED",
  "message": "AI request limit exceeded. Please wait 45 seconds.",
  "limit": 30,
  "window": "minute",
  "resetIn": 45,
  "currentTier": "pro",
  "suggestion": "Please wait a moment before making more AI requests"
}
```

### Applied To Endpoints

The rate limiter has been applied to all Gemini-heavy endpoints:

1. **`POST /api/repositories/analyze`** - Repository analysis
2. **`POST /api/ai/ask`** - AI assistant chat
3. **`POST /api/code-review/analyze`** - Code review analysis
4. **`POST /api/repositories/find-similar`** - AI-powered similarity search
5. **`GET /api/recommendations`** - AI recommendations generation

### Usage

```typescript
import { geminiRateLimiter } from './middleware/geminiRateLimiter';

app.post('/api/ai/ask', 
  isAuthenticated, 
  geminiRateLimiter(),  // Add this middleware
  async (req, res) => {
    // Your handler code
  }
);
```

### Status Endpoint (Optional)

You can also expose rate limit status to users:

```typescript
import { getGeminiRateLimitStatus } from './middleware/geminiRateLimiter';

app.get('/api/ai/rate-limit-status', isAuthenticated, async (req, res) => {
  const userId = req.user.claims.sub;
  const tier = req.user.subscriptionTier || 'free';
  const status = await getGeminiRateLimitStatus(userId, tier);
  res.json(status);
});
```

## Benefits

1. **Prevents API Errors**: No more 429 errors from Google
2. **Fair Usage**: Ensures all users get fair access to AI features
3. **Tier Differentiation**: Pro/Enterprise users get higher limits
4. **Better UX**: Clear error messages with reset times
5. **Monitoring**: Rate limit headers help track usage
6. **Cost Control**: Prevents unexpected API costs from abuse

## Testing

To test the rate limiter:

1. **As Free User**: Try making 6 AI requests within a minute - the 6th should be rate limited
2. **As Pro User**: Try making 31 AI requests within a minute - the 31st should be rate limited
3. **Check Headers**: Inspect response headers to see remaining quota
4. **Wait and Retry**: After the reset time, requests should work again

## Future Enhancements

1. **Redis Storage**: Move from in-memory to Redis for distributed systems
2. **Dynamic Limits**: Adjust limits based on actual Google API quotas
3. **Usage Analytics**: Track and display AI usage in user dashboard
4. **Burst Allowance**: Allow short bursts above the limit
5. **Priority Queue**: Queue requests instead of rejecting them

## Related Files

- `server/middleware/geminiRateLimiter.ts` - Main implementation
- `server/routes.ts` - Endpoints using the rate limiter
- `server/gemini.ts` - Gemini API integration with retry logic

## Notes

- The rate limiter uses in-memory storage, which resets on server restart
- Limits are conservative to ensure we never hit Google's actual limits
- The middleware gracefully handles errors and allows requests through on failure
- Rate limits are per-user, not global
