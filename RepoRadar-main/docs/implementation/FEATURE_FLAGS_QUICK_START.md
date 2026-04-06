# Feature Flags Quick Start Guide

## What Are Feature Flags?

Feature flags allow you to enable/disable features without redeploying the application. This is essential for:
- **Quick rollback** if a feature causes issues
- **Gradual rollout** to test features with a small percentage of users
- **A/B testing** different features with different user groups

## Quick Start

### 1. Check if a Feature is Enabled (Server)

```typescript
// In any Express route
app.get('/api/my-route', (req, res) => {
  if (req.featureFlags?.isEnabled('analyticsTracking')) {
    // Feature is enabled, track analytics
    trackEvent('route_accessed');
  }
  
  // Continue with route logic
  res.json({ data: 'response' });
});
```

### 2. Check if a Feature is Enabled (Client)

```typescript
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

function MyComponent() {
  const loadingEnabled = useFeatureFlag('loadingStates');
  
  return (
    <div>
      {loadingEnabled ? (
        <SkeletonLoader />
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
```

### 3. Protect a Route with a Feature Flag

```typescript
import { requireFeatureFlag } from './middleware/featureFlags';

// This route only works if backgroundJobs is enabled
app.post('/api/jobs', 
  requireFeatureFlag('backgroundJobs'),
  (req, res) => {
    // Create background job
    res.json({ jobId: '123' });
  }
);
```

## Managing Feature Flags

### Via Admin UI (Easiest)

1. Navigate to `http://localhost:5000/admin`
2. Login with your admin token
3. Click the "Flags" tab
4. Toggle features on/off with switches
5. Adjust rollout percentage with sliders

### Via API

```bash
# Get all flags
curl http://localhost:5000/api/feature-flags

# Disable a feature
curl -X PUT http://localhost:5000/api/feature-flags/loadingStates \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Set rollout to 50%
curl -X PUT http://localhost:5000/api/feature-flags/analyticsTracking \
  -H "Content-Type: application/json" \
  -d '{"rolloutPercentage": 50}'
```

### Via Environment Variables

```bash
# Add to .env file
FEATURE_LOADINGSTATES=false
FEATURE_ANALYTICSTRACKING=false

# Restart the application
npm run dev
```

## Available Feature Flags

| Flag Name | Description |
|-----------|-------------|
| `loadingStates` | Skeleton screens and loading indicators |
| `errorHandling` | Enhanced error messages and recovery UI |
| `analyticsTracking` | User analytics and behavior tracking |
| `backgroundJobs` | Background job processing |
| `mobileResponsive` | Mobile-responsive layouts |
| `accessibility` | Accessibility features (keyboard nav, ARIA) |
| `adminDashboard` | Admin dashboard and monitoring |
| `healthChecks` | Health check endpoints |
| `horizontalScaling` | Horizontal scaling features |
| `monitoring` | Monitoring and observability |

## Emergency Rollback

If a feature is causing issues in production:

### Option 1: Admin UI (Fastest)
1. Go to `/admin` → "Flags" tab
2. Toggle the problematic feature OFF
3. Changes take effect immediately

### Option 2: API
```bash
curl -X PUT http://localhost:5000/api/feature-flags/FEATURE_NAME \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Option 3: Environment Variable
```bash
# Add to .env
FEATURE_FEATURENAME=false

# Restart application
npm run dev
```

## Gradual Rollout

To safely roll out a new feature:

1. **Start at 10%**: Only 10% of users see the feature
   ```bash
   curl -X PUT http://localhost:5000/api/feature-flags/newFeature \
     -d '{"rolloutPercentage": 10}'
   ```

2. **Monitor**: Watch error rates, performance metrics for 30-60 minutes

3. **Increase Gradually**: 10% → 25% → 50% → 75% → 100%
   ```bash
   curl -X PUT http://localhost:5000/api/feature-flags/newFeature \
     -d '{"rolloutPercentage": 25}'
   ```

4. **Rollback if Needed**: Set to 0% or disable completely
   ```bash
   curl -X PUT http://localhost:5000/api/feature-flags/newFeature \
     -d '{"enabled": false}'
   ```

## Common Patterns

### Pattern 1: Feature Toggle

```typescript
// Server
app.get('/api/data', (req, res) => {
  if (req.featureFlags?.isEnabled('newFeature')) {
    return res.json(getDataNewWay());
  }
  return res.json(getDataOldWay());
});

// Client
function DataDisplay() {
  const newFeatureEnabled = useFeatureFlag('newFeature');
  
  return newFeatureEnabled ? <NewComponent /> : <OldComponent />;
}
```

### Pattern 2: Gradual Migration

```typescript
// Gradually migrate users to new implementation
if (req.featureFlags?.isEnabled('newImplementation')) {
  // New implementation (50% of users)
  await processWithNewMethod(data);
} else {
  // Old implementation (50% of users)
  await processWithOldMethod(data);
}
```

### Pattern 3: Beta Features

```typescript
// Enable for specific users only
const featureFlags = getFeatureFlags();
const flag = featureFlags.getFlag('betaFeature');
if (flag) {
  flag.enabledForUsers = ['user123', 'user456'];
}
```

## Best Practices

### ✅ DO:
- Default features to enabled in production
- Use flags for rollback, not for enabling features
- Monitor metrics after changing flags
- Document why you disabled a feature
- Test rollback procedures regularly
- Remove flags after features are stable (2-4 weeks)

### ❌ DON'T:
- Leave flags in code forever
- Use flags for business logic
- Forget to test both enabled and disabled states
- Change flags without monitoring
- Use flags as a replacement for proper testing

## Troubleshooting

### Feature Not Disabling

**Problem**: Feature still works after disabling flag

**Solution**:
1. Clear browser cache/localStorage
2. Verify API returns correct flag state
3. Check environment variables aren't overriding
4. Restart application if needed

### Inconsistent Behavior

**Problem**: Feature works for some users but not others

**Solution**:
1. Check rollout percentage setting
2. Verify user-specific overrides
3. Check browser cache across devices
4. Ensure all instances have same config

## More Information

For detailed documentation, see:
- **Full Guide**: `docs/FEATURE_FLAGS_GUIDE.md`
- **Implementation Summary**: `TASK_27_FEATURE_FLAGS_SUMMARY.md`
- **Verification Checklist**: `TASK_27_VERIFICATION_CHECKLIST.md`

## Support

If you need help:
1. Check the full documentation
2. Review error logs
3. Check admin dashboard
4. Contact the development team

## Examples in Codebase

Look at these files for real examples:
- `server/routes.ts` - Server-side usage
- `client/src/pages/admin.tsx` - Client-side usage
- `server/middleware/featureFlags.ts` - Middleware implementation
- `client/src/hooks/useFeatureFlags.ts` - React hooks

---

**Remember**: Feature flags are a safety net. Use them wisely to deploy with confidence! 🚀
