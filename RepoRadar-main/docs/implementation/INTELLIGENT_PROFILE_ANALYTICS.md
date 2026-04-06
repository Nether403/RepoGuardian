# Intelligent Profile Analytics & Monitoring

This document describes the comprehensive analytics and monitoring implementation for the Intelligent User Profile feature in RepoRadar.

## Overview

The intelligent profile analytics system tracks user interactions, monitors performance, and provides insights into feature usage across different subscription tiers. This implementation satisfies Requirements 7.3, 7.4, 7.5, and 7.6 from the Intelligent User Profile specification.

## Analytics Events

### Bookmark Events

#### `bookmark_added`
Tracked when a user adds a repository to their bookmarks.

**Properties:**
- `repositoryId`: The ID of the bookmarked repository
- `repositoryName`: The full name of the repository (owner/repo)

**Category:** `profile`

**Example:**
```typescript
await trackEvent(req, 'bookmark_added', 'profile', {
  repositoryId: 'facebook/react',
  repositoryName: 'facebook/react',
});
```

#### `bookmark_removed`
Tracked when a user removes a repository from their bookmarks.

**Properties:**
- `repositoryId`: The ID of the removed repository
- `repositoryName`: The full name of the repository (owner/repo)

**Category:** `profile`

#### `bookmarks_viewed`
Tracked when a user views their bookmarks list.

**Properties:**
- `count`: Number of bookmarks displayed
- `page`: Current page number
- `limit`: Items per page

**Category:** `profile`

### Tag Events

#### `tag_created`
Tracked when a user creates a new tag.

**Properties:**
- `tagId`: The ID of the created tag
- `tagName`: The name of the tag
- `tagColor`: The hex color code of the tag

**Category:** `profile`

**Example:**
```typescript
await trackEvent(req, 'tag_created', 'profile', {
  tagId: 42,
  tagName: 'Machine Learning',
  tagColor: '#FF6B35',
});
```

#### `tag_deleted`
Tracked when a user deletes a tag.

**Properties:**
- `tagId`: The ID of the deleted tag
- `tagName`: The name of the tag

**Category:** `profile`

#### `tag_applied`
Tracked when a user applies a tag to a repository.

**Properties:**
- `repositoryId`: The ID of the repository
- `repositoryName`: The full name of the repository
- `tagId`: The ID of the applied tag
- `tagName`: The name of the tag

**Category:** `profile`

#### `tag_removed`
Tracked when a user removes a tag from a repository.

**Properties:**
- `repositoryId`: The ID of the repository
- `repositoryName`: The full name of the repository
- `tagId`: The ID of the removed tag
- `tagName`: The name of the tag

**Category:** `profile`

#### `tags_viewed`
Tracked when a user views their tags list.

**Properties:**
- `count`: Number of tags displayed
- `page`: Current page number
- `limit`: Items per page

**Category:** `profile`

### Preferences Events

#### `preferences_updated`
Tracked when a user updates their preferences.

**Properties:**
- `updatedFields`: Array of field names that were updated
- `languageCount`: Number of preferred languages (if updated)
- `topicCount`: Number of preferred topics (if updated)
- `excludedTopicCount`: Number of excluded topics (if updated)

**Category:** `profile`

**Example:**
```typescript
await trackEvent(req, 'preferences_updated', 'profile', {
  updatedFields: ['preferredLanguages', 'minStars'],
  languageCount: 3,
  topicCount: undefined,
  excludedTopicCount: undefined,
});
```

#### `preferences_viewed`
Tracked when a user views their preferences.

**Properties:**
- `hasPreferences`: Boolean indicating if user has set preferences

**Category:** `profile`

### Recommendation Events

#### `recommendations_generated`
Tracked when AI recommendations are successfully generated for a user.

**Properties:**
- `count`: Number of recommendations generated
- `source`: Source of recommendations ('ai' or 'cache')
- `duration`: Time taken to generate recommendations (ms)

**Category:** `profile`

**Example:**
```typescript
await trackEvent(req, 'recommendations_generated', 'profile', {
  count: 10,
  source: 'ai',
  duration: 2450,
});
```

#### `recommendation_dismissed`
Tracked when a user dismisses a recommendation.

**Properties:**
- `repositoryId`: The ID of the dismissed repository
- `repositoryName`: The full name of the repository

**Category:** `profile`

#### `recommendations_viewed`
Tracked when a user views their recommendations.

**Properties:**
- `source`: Source of recommendations ('cache' or 'ai')

**Category:** `profile`

#### `recommendations_insufficient_data`
Tracked when recommendations cannot be generated due to insufficient user activity.

**Properties:**
- `activityCount`: Number of recent activities
- `bookmarkCount`: Number of bookmarks

**Category:** `profile`

#### `recommendations_error`
Tracked when recommendation generation fails.

**Properties:**
- `error`: Error message

**Category:** `profile`

## Performance Monitoring

### API Response Time Monitoring

All intelligent profile endpoints are monitored for response time using the `intelligentProfilePerformanceMiddleware`. This middleware:

1. Records the start time when a request begins
2. Measures the duration when the response completes
3. Records metrics to the global performance monitor
4. Logs warnings for slow requests (>1 second)

**Monitored Endpoints:**
- `/api/bookmarks` (GET, POST, DELETE)
- `/api/tags` (GET, POST, DELETE)
- `/api/repositories/:id/tags` (GET, POST, DELETE)
- `/api/user/preferences` (GET, PUT)
- `/api/recommendations` (GET, POST)

**Performance Metrics:**
```typescript
{
  name: 'intelligent_profile_api_/api/bookmarks',
  value: 245, // duration in ms
  unit: 'ms',
  category: 'api',
  tags: {
    endpoint: '/api/bookmarks',
    method: 'GET',
    statusCode: '200',
    userId: 'user-123',
  },
  timestamp: new Date(),
}
```

**Performance Thresholds:**
- Bookmarks: Target <500ms (Requirement 7.3)
- Tags: Target <300ms (Requirement 7.4)
- Preferences: Target <200ms (Requirement 7.5)
- Recommendations: Target <3000ms (Requirement 7.6)

### Recommendation Generation Performance

Recommendation generation is specifically monitored using `trackRecommendationPerformance`:

```typescript
await trackRecommendationPerformance(
  userId,
  generationDuration,
  recommendationCount,
  'ai' // or 'cache'
);
```

**Metrics Tracked:**
- Generation time (ms)
- Number of recommendations generated
- Source (AI generation vs cache retrieval)
- User ID

**Warnings:**
- Logs warning if AI generation takes >3 seconds
- No warning for cache retrieval (expected to be fast)

## Feature Usage by Tier

The system tracks which features are used by users at different subscription tiers:

**Event:** `intelligent_profile_feature_used`

**Properties:**
- `feature`: Feature name ('bookmarks', 'tags', 'preferences', 'recommendations')
- `tier`: User's subscription tier ('free', 'pro', 'enterprise')
- `duration`: API response time (ms)
- `method`: HTTP method used

**Category:** `profile`

This allows analysis of:
- Which features are most popular per tier
- Usage patterns across subscription levels
- Feature adoption rates after upgrades

## Cache Invalidation

The system automatically invalidates recommendation caches when:

1. User updates their preferences
2. User performs a new repository analysis
3. User adds a bookmark

**Cache Key Format:**
```
recommendations:{userId}
```

**Cache Expiry:** 24 hours

## Dismissed Recommendations

Dismissed recommendations are stored in Redis to prevent them from appearing in future recommendations:

**Storage:**
- Key: `dismissed_recommendations:{userId}`
- Type: Set
- Expiry: 90 days

**Integration:**
The `generateAIRecommendations` function automatically filters out dismissed repositories before generating recommendations.

## Analytics Dashboard Integration

All tracked events are stored in the `analytics_events` table and can be queried through the analytics service:

```typescript
const metrics = await analyticsService.getMetrics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  category: 'profile',
});
```

**Available Metrics:**
- `totalEvents`: Total number of events in period
- `eventsByCategory`: Events grouped by category
- `eventsByName`: Events grouped by event name

## Performance Alerting

The system includes automatic alerting for performance issues:

**Alert Conditions:**
- API response time >1000ms (warning)
- Recommendation generation >3000ms (warning)
- Error rate >5% (critical)

**Alert Delivery:**
- Console logging
- WebSocket notifications (if enabled)
- Performance dashboard

## Usage Examples

### Tracking a Custom Event

```typescript
import { trackEvent } from './middleware/analytics';

app.post('/api/custom-action', isAuthenticated, async (req, res) => {
  // ... perform action ...
  
  await trackEvent(req, 'custom_action_performed', 'profile', {
    actionType: 'example',
    metadata: { key: 'value' },
  });
  
  res.json({ success: true });
});
```

### Querying Analytics Data

```typescript
import { analyticsService } from './analytics';

// Get metrics for last 30 days
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const metrics = await analyticsService.getMetrics({
  startDate: thirtyDaysAgo,
  endDate: new Date(),
  category: 'profile',
});

console.log('Total profile events:', metrics.totalEvents);
console.log('Events by name:', metrics.eventsByName);
```

### Monitoring Performance

```typescript
import { getGlobalPerformanceMonitor } from './performance';

const monitor = getGlobalPerformanceMonitor();

// Get recent metrics
const recentMetrics = monitor.getMetrics({
  category: 'api',
  limit: 100,
});

// Calculate average response time
const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length;
console.log('Average API response time:', avgResponseTime, 'ms');
```

## Testing

Comprehensive tests are provided in `server/__tests__/intelligentProfileAnalytics.test.ts`:

**Test Coverage:**
- Performance middleware functionality
- Event tracking for all features
- Performance threshold warnings
- Error handling
- Tier-based usage tracking

**Run Tests:**
```bash
npm run test -- intelligentProfileAnalytics.test.ts
```

## Privacy & Compliance

The analytics system includes built-in privacy features:

1. **Anonymization**: Sensitive data is automatically anonymized
2. **Opt-out**: Users can opt out of analytics tracking
3. **Data Retention**: Metrics are retained for 24 hours by default
4. **PII Protection**: No personally identifiable information is stored in events

## Monitoring Dashboard

Access the monitoring dashboard at:
- Performance Metrics: `/api/performance/metrics`
- Active Alerts: `/api/performance/alerts/active`
- Alert History: `/api/performance/alerts/history`
- Analytics Events: `/api/admin/analytics` (admin only)

## Future Enhancements

Potential improvements for future iterations:

1. **Real-time Analytics**: WebSocket-based real-time event streaming
2. **Advanced Reporting**: Automated weekly/monthly usage reports
3. **A/B Testing**: Feature flag integration for experimentation
4. **Predictive Analytics**: ML-based usage prediction and recommendations
5. **Custom Dashboards**: User-specific analytics dashboards
6. **Export Capabilities**: CSV/JSON export of analytics data

## Troubleshooting

### Events Not Being Tracked

1. Check if analytics service is initialized
2. Verify Redis connection (for caching)
3. Check console for error messages
4. Ensure user is authenticated

### Performance Metrics Missing

1. Verify performance monitor is started
2. Check if middleware is applied to routes
3. Review performance monitor configuration
3. Check memory usage (metrics are stored in-memory)

### Slow Performance

1. Review performance alerts
2. Check database query performance
3. Verify Redis cache is working
4. Monitor recommendation generation times
5. Check for network latency issues

## Support

For issues or questions about analytics and monitoring:
- Review the logs in `/api/performance/metrics`
- Check active alerts in `/api/performance/alerts/active`
- Contact the development team with specific error messages
