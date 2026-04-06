# Gemini Rate Limit Fix - Quick Guide

## The Problem

You're hitting **Google's actual Gemini API rate limits**, not our application limits. This happens because you're using a free tier Google API key which has very strict limits:

- **2 requests per minute (RPM)**
- **50 requests per day (RPD)**

## The Solution

I've implemented a **request queue system** that automatically spaces out Gemini API calls to respect Google's limits.

### How It Works

1. **Automatic Queuing**: All Gemini API calls are now queued
2. **Smart Spacing**: Waits 30 seconds between requests (safe for 2 RPM limit)
3. **Daily Tracking**: Tracks daily usage and stops at 45 requests (safe buffer)
4. **Transparent**: Works automatically in the background

### Configuration

The queue is now **enabled by default** in your `.env`:

```env
GEMINI_USE_QUEUE=true
```

To disable it (if you upgrade to a paid API key):
```env
GEMINI_USE_QUEUE=false
```

### What You'll Experience

#### Before (Without Queue)
- ❌ Instant "rate limit exceeded" errors
- ❌ Requests fail immediately
- ❌ Have to wait manually

#### After (With Queue)
- ✅ Requests are queued automatically
- ✅ Processed one at a time with safe spacing
- ✅ Clear console logs showing queue status
- ✅ Graceful handling of daily limits

### Console Output

You'll see helpful logs like:
```
[Gemini Queue] Waiting 25s before next request (3 in queue)
[Gemini Queue] Processing request (12/45 today, 2 remaining in queue)
```

### Check Queue Status

You can check the current queue status:

**Endpoint**: `GET /api/ai/queue-status`

**Response**:
```json
{
  "queueLength": 3,
  "processing": true,
  "requestsToday": 12,
  "dailyLimit": 45,
  "remainingToday": 33,
  "dailyResetIn": 720
}
```

## Current Situation

Since you've already hit Google's rate limits today, you have two options:

### Option 1: Wait for Reset (Recommended)
- **Per-minute limit**: Resets after 1 minute of no requests
- **Daily limit**: Resets at midnight (or 24 hours after first request)

With the queue enabled, you can make requests again, but they'll be spaced out automatically.

### Option 2: Get a New API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create a new API key (or use a different Google account)
3. Update `.env` with the new key:
   ```env
   GEMINI_API_KEY=your_new_key_here
   ```
4. Restart the server

### Option 3: Upgrade to Paid Tier (Best Long-term)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable billing for your project
3. Upgrade Gemini API to paid tier
4. Get 1000 RPM instead of 2 RPM!
5. Disable the queue: `GEMINI_USE_QUEUE=false`

## Testing the Queue

1. **Restart your dev server** to load the new queue system
2. **Try a code review** - it will be queued
3. **Watch the console** - you'll see queue status logs
4. **Be patient** - requests are spaced 30 seconds apart

## Queue Limits

| Metric | Limit | Reason |
|--------|-------|--------|
| Min interval | 30 seconds | Safe for 2 RPM (Google's limit) |
| Daily requests | 45 | Safe buffer (Google allows 50) |
| Queue size | Unlimited | All requests wait their turn |

## Benefits

1. ✅ **No more rate limit errors** - requests are queued instead of rejected
2. ✅ **Automatic spacing** - no manual waiting required
3. ✅ **Daily tracking** - prevents hitting daily limits
4. ✅ **Clear feedback** - console logs show what's happening
5. ✅ **Graceful degradation** - clear error messages when daily limit is reached

## Important Notes

- The queue uses **in-memory storage** - resets on server restart
- Daily counter resets every 24 hours
- Queue processes requests in FIFO order (first in, first out)
- If you hit the daily limit, all pending requests are rejected with a clear message

## Monitoring

Watch your console for these messages:

- `[Gemini Queue] Waiting Xs before next request` - Normal operation
- `[Gemini Queue] Processing request (X/45 today)` - Request being processed
- `[Gemini Queue] Daily limit reached` - Need to wait for reset
- `[Gemini Queue] Daily request counter reset` - New day, fresh quota

## Next Steps

1. **Restart your dev server** to enable the queue
2. **Wait a few minutes** for Google's rate limit to reset
3. **Try your code review again** - it should work (but slowly)
4. **Consider upgrading** your Google API key for better performance

---

**Pro Tip**: If you're doing heavy development with AI features, a paid Google API key ($0.00025 per request) is worth it for the 1000 RPM limit!
