# Feature Flags Guide

This guide explains how to use the feature flags system for rollback capability and gradual feature rollout.

## Overview

The feature flags system provides a centralized way to enable/disable features without redeployment. This is critical for:

- **Quick Rollback**: Disable problematic features immediately
- **Gradual Rollout**: Roll out features to a percentage of users
- **A/B Testing**: Test features with specific user groups
- **Emergency Response**: Quickly disable features causing issues

## Architecture

The feature flags system consists of:

1. **Shared Core** (`shared/featureFlags.ts`): Core service and types
2. **Server Middleware** (`server/middleware/featureFlags.ts`): Express integration
3. **Client Hook** (`client/src/hooks/useFeatureFlags.ts`): React integration
4. **Admin UI** (`client/src/components/admin/feature-flags.tsx`): Management interface

## Available Feature Flags

### Phase 3 Features

All Phase 3 features have corresponding feature flags:

| Flag Name | Description | Default |
|-----------|-------------|---------|
| `loadingStates` | Skeleton screens and loading indicators | Enabled |
| `errorHandling` | Enhanced error messages and recovery UI | Enabled |
| `analyticsTracking` | User analytics and behavior tracking | Enabled |
| `backgroundJobs` | Background job processing | Enabled |
| `mobileResponsive` | Mobile-responsive layouts | Enabled |
| `accessibility` | Accessibility features (keyboard nav, ARIA) | Enabled |
| `adminDashboard` | Admin dashboard and monitoring | Enabled |
| `healthChecks` | Health check endpoints | Enabled |
| `horizontalScaling` | Horizontal scaling features | Enabled |
| `monitoring` | Monitoring and observability | Enabled |

## Usage

### Server-Side (Express)

#### Check Feature Flags in Middleware

```typescript
import { featureFlagsMiddleware } from './server/middleware/featureFlags';

// Add to Express app
app.use(featureFlagsMiddleware);

// Use in routes
app.get('/api/data', (req, res) => {
  if (req.featureFlags?.isEnabled('analyticsTracking')) {
    // Track analytics
  }
  
  // Handle request
});
```

#### Require Feature Flag for Route

```typescript
import { requireFeatureFlag } from './server/middleware/featureFlags';

// Protect route with feature flag
app.post('/api/jobs', 
  requireFeatureFlag('backgroundJobs'),
  (req, res) => {
    // This route only works if backgroundJobs is enabled
  }
);
```

#### Check Flags Programmatically

```typescript
import { getFeatureFlags } from '../shared/featureFlags';

const featureFlags = getFeatureFlags();

if (featureFlags.isEnabled('analyticsTracking', userId)) {
  // Track event
}
```

### Client-Side (React)

#### Check Single Feature Flag

```typescript
import { useFeatureFlag } from './hooks/useFeatureFlags';

function MyComponent() {
  const loadingStatesEnabled = useFeatureFlag('loadingStates');
  
  return (
    <div>
      {loadingStatesEnabled ? (
        <SkeletonLoader />
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
```

#### Check Multiple Flags

```typescript
import { useFeatureFlagsMap } from './hooks/useFeatureFlags';

function MyComponent() {
  const flags = useFeatureFlagsMap(['loadingStates', 'errorHandling']);
  
  return (
    <div>
      {flags.loadingStates && <SkeletonLoader />}
      {flags.errorHandling && <ErrorBoundary />}
    </div>
  );
}
```

#### Get All Flags

```typescript
import { useFeatureFlags } from './hooks/useFeatureFlags';

function FeatureFlagsDebug() {
  const { flags, loading, error } = useFeatureFlags();
  
  if (loading) return <div>Loading flags...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <ul>
      {Object.entries(flags).map(([name, flag]) => (
        <li key={name}>
          {name}: {flag.enabled ? 'Enabled' : 'Disabled'}
        </li>
      ))}
    </ul>
  );
}
```

## Configuration

### Environment Variables

Feature flags can be controlled via environment variables:

```bash
# Disable specific features
FEATURE_LOADINGSTATES=false
FEATURE_ANALYTICSTRACKING=false
FEATURE_BACKGROUNDJOBS=false

# Enable features (default is true)
FEATURE_ERRORHANDLING=true
FEATURE_MONITORING=true
```

Environment variable format: `FEATURE_<FLAGNAME>` where `<FLAGNAME>` is the flag name in uppercase.

### Runtime Configuration

Feature flags can be updated at runtime via the admin API:

```bash
# Disable a feature
curl -X PUT http://localhost:5000/api/feature-flags/loadingStates \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Set rollout percentage
curl -X PUT http://localhost:5000/api/feature-flags/analyticsTracking \
  -H "Content-Type: application/json" \
  -d '{"rolloutPercentage": 50}'

# Enable and set rollout
curl -X PUT http://localhost:5000/api/feature-flags/backgroundJobs \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "rolloutPercentage": 25}'
```

## Admin Dashboard

The admin dashboard provides a UI for managing feature flags:

1. Navigate to `/admin` in your browser
2. Scroll to the "Feature Flags" section
3. Toggle features on/off with switches
4. Adjust rollout percentages with sliders

### Features:

- **Toggle Switches**: Enable/disable features instantly
- **Rollout Sliders**: Gradually roll out features (0-100%)
- **Real-time Updates**: Changes take effect immediately
- **Rollback Guide**: Built-in documentation for quick reference

## Rollback Procedures

### Quick Rollback (Emergency)

If a feature is causing critical issues:

1. **Via Admin UI**:
   - Go to `/admin`
   - Find the problematic feature
   - Toggle it off
   - Changes take effect immediately

2. **Via API**:
   ```bash
   curl -X PUT http://localhost:5000/api/feature-flags/FEATURE_NAME \
     -H "Content-Type: application/json" \
     -d '{"enabled": false}'
   ```

3. **Via Environment Variable**:
   ```bash
   # Add to .env
   FEATURE_FEATURENAME=false
   
   # Restart application
   npm run dev
   ```

### Gradual Rollback

To gradually disable a feature:

1. Set rollout percentage to 75% (affects 25% of users)
2. Monitor metrics for 15-30 minutes
3. If stable, reduce to 50%
4. Continue reducing until 0% or issue is resolved
5. Once at 0%, disable the feature completely

### Rollout Strategy

For new features or after fixes:

1. **Start Small**: Set rollout to 10%
2. **Monitor**: Watch error rates, performance metrics
3. **Increase Gradually**: 10% → 25% → 50% → 75% → 100%
4. **Wait Between Steps**: 30-60 minutes per step
5. **Rollback if Needed**: Reduce percentage or disable

## Advanced Features

### User-Specific Overrides

Enable/disable features for specific users:

```typescript
import { getFeatureFlags } from '../shared/featureFlags';

const featureFlags = getFeatureFlags();
const flag = featureFlags.getFlag('loadingStates');

if (flag) {
  // Enable for specific users
  flag.enabledForUsers = ['user123', 'user456'];
  
  // Disable for specific users
  flag.disabledForUsers = ['user789'];
}
```

### Rollout Percentage

Control what percentage of users see a feature:

```typescript
import { getFeatureFlags } from '../shared/featureFlags';

const featureFlags = getFeatureFlags();

// 50% of users will see this feature
featureFlags.setRolloutPercentage('loadingStates', 50);
```

Rollout is deterministic based on user ID, so the same users always see the feature.

### Programmatic Management

```typescript
import { getFeatureFlags } from '../shared/featureFlags';

const featureFlags = getFeatureFlags();

// Enable a feature
featureFlags.enable('loadingStates');

// Disable a feature
featureFlags.disable('analyticsTracking');

// Update multiple properties
featureFlags.updateFlag('backgroundJobs', {
  enabled: true,
  rolloutPercentage: 75,
});

// Get all flags
const allFlags = featureFlags.getAllFlags();
```

## Best Practices

### 1. Default to Enabled

All features should default to enabled in production. Use flags for rollback, not for enabling features.

### 2. Monitor After Changes

Always monitor metrics after changing feature flags:
- Error rates
- Response times
- User engagement
- System resources

### 3. Document Changes

When disabling a feature, document:
- Why it was disabled
- What issue it caused
- When it can be re-enabled
- What needs to be fixed

### 4. Test Rollback Procedures

Regularly test rollback procedures in staging:
- Disable features via admin UI
- Disable features via API
- Verify features are actually disabled
- Verify no errors occur

### 5. Gradual Rollout for Risky Changes

For high-risk features:
- Start with 5-10% rollout
- Monitor closely for 1-2 hours
- Increase gradually over days, not hours
- Have rollback plan ready

### 6. Clean Up Old Flags

Remove feature flags once features are stable:
- After 2-4 weeks of 100% rollout
- After thorough testing
- Update code to remove flag checks
- Remove from configuration

## Monitoring

### Metrics to Track

When using feature flags, monitor:

1. **Feature Usage**:
   - How many users see each feature
   - Feature adoption rates
   - User engagement with features

2. **Error Rates**:
   - Errors per feature
   - Error rates before/after enabling
   - Error types and patterns

3. **Performance**:
   - Response times per feature
   - Resource usage per feature
   - Database query performance

4. **Rollout Progress**:
   - Current rollout percentage
   - Users affected by rollout
   - Time since last change

### Logging

Feature flag changes are automatically logged:

```typescript
// Logs include:
// - Flag name
// - Old value
// - New value
// - User who made change
// - Timestamp
```

## Troubleshooting

### Feature Not Disabling

**Problem**: Feature still works after disabling flag

**Solutions**:
1. Check browser cache - clear localStorage
2. Verify API returns correct flag state
3. Check environment variables aren't overriding
4. Restart application if needed

### Inconsistent Behavior

**Problem**: Feature works for some users but not others

**Solutions**:
1. Check rollout percentage setting
2. Verify user-specific overrides
3. Check browser cache across devices
4. Ensure all instances have same config

### Admin UI Not Loading

**Problem**: Can't access feature flags admin UI

**Solutions**:
1. Verify admin authentication
2. Check admin dashboard feature flag is enabled
3. Check browser console for errors
4. Verify API endpoints are accessible

## API Reference

### GET /api/feature-flags

Get all feature flags.

**Response**:
```json
{
  "flags": [
    {
      "name": "loadingStates",
      "enabled": true,
      "description": "Enable skeleton screens and loading indicators",
      "rolloutPercentage": 100
    }
  ]
}
```

### PUT /api/feature-flags/:flagName

Update a feature flag.

**Request Body**:
```json
{
  "enabled": false,
  "rolloutPercentage": 50
}
```

**Response**:
```json
{
  "success": true,
  "flag": {
    "name": "loadingStates",
    "enabled": false,
    "description": "Enable skeleton screens and loading indicators",
    "rolloutPercentage": 50
  }
}
```

## Testing

### Unit Tests

Test feature flag logic:

```typescript
import { FeatureFlagsService } from '../shared/featureFlags';

describe('Feature Flags', () => {
  it('should disable feature', () => {
    const service = new FeatureFlagsService();
    service.disable('loadingStates');
    expect(service.isEnabled('loadingStates')).toBe(false);
  });
});
```

### Integration Tests

Test feature flag integration:

```typescript
import request from 'supertest';
import app from '../server';

describe('Feature Flag Routes', () => {
  it('should block disabled feature', async () => {
    // Disable feature
    await request(app)
      .put('/api/feature-flags/backgroundJobs')
      .send({ enabled: false });
    
    // Try to use feature
    const response = await request(app)
      .post('/api/jobs')
      .send({ type: 'test' });
    
    expect(response.status).toBe(503);
  });
});
```

### E2E Tests

Test feature flags in browser:

```typescript
import { test, expect } from '@playwright/test';

test('should hide feature when disabled', async ({ page }) => {
  // Disable feature via API
  await page.request.put('/api/feature-flags/loadingStates', {
    data: { enabled: false }
  });
  
  // Navigate to page
  await page.goto('/');
  
  // Verify feature is hidden
  await expect(page.locator('.skeleton-loader')).not.toBeVisible();
});
```

## Security Considerations

### Admin Access

- Feature flag management requires admin authentication
- Use role-based access control (RBAC)
- Log all feature flag changes
- Audit flag changes regularly

### Rate Limiting

- Rate limit feature flag API endpoints
- Prevent abuse of flag toggling
- Monitor for suspicious activity

### Validation

- Validate all flag updates
- Ensure rollout percentage is 0-100
- Verify flag names exist
- Sanitize user input

## Support

For issues or questions:

1. Check this documentation
2. Review error logs
3. Check admin dashboard
4. Contact DevOps team
5. Create incident ticket

## Changelog

### Version 1.0.0 (Current)

- Initial feature flags system
- 10 Phase 3 feature flags
- Admin UI for management
- API endpoints for control
- Environment variable support
- Gradual rollout capability
- User-specific overrides
