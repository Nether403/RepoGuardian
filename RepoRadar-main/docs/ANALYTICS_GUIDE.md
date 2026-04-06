# Analytics System - Developer Guide

## Overview

The analytics system tracks user behavior, feature usage, and system events to provide insights for product decisions. It's designed with privacy in mind and includes opt-out mechanisms.

## Architecture

```
Client → Analytics Client → API → Analytics Service → PostgreSQL
```

## Database Schema

```sql
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(255) NOT NULL,
  event_category VARCHAR(100) NOT NULL,
  properties JSONB,
  user_id VARCHAR(255),
  session_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);
CREATE INDEX idx_analytics_events_category ON analytics_events(event_category);
```

## Client Usage

### Tracking Events

```typescript
import { analytics } from '@/lib/analytics';

// Track a simple event
analytics.trackEvent({
  name: 'button_clicked',
  category: 'interaction',
  properties: {
    button_id: 'analyze_repo',
    page: 'home'
  }
});

// Track repository analysis
analytics.trackEvent({
  name: 'repository_analyzed',
  category: 'analysis',
  properties: {
    repository: 'owner/name',
    analysis_type: 'full',
    duration_ms: 1500
  }
});

// Track search
analytics.trackEvent({
  name: 'search_performed',
  category: 'search',
  properties: {
    query: 'react',
    results_count: 25,
    filters: ['stars>1000']
  }
});
```

### Tracking Errors

```typescript
import { analytics } from '@/lib/analytics';

try {
  await riskyOperation();
} catch (error) {
  analytics.trackError(error, {
    operation: 'repository_analysis',
    repository: 'owner/name'
  });
}
```

### Tracking Page Views

```typescript
import { analytics } from '@/lib/analytics';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function App() {
  const location = useLocation();
  
  useEffect(() => {
    analytics.trackPageView(location.pathname, {
      referrer: document.referrer
    });
  }, [location]);
}
```

### Setting User Properties

```typescript
import { analytics } from '@/lib/analytics';

// Set user properties
analytics.setUserProperties({
  plan: 'pro',
  signup_date: '2025-01-01',
  preferences: {
    theme: 'dark',
    notifications: true
  }
});
```

## Server Usage

### Analytics Service

```typescript
import { AnalyticsService } from '@/server/analytics';

const analyticsService = new AnalyticsService();

// Track event
await analyticsService.trackEvent({
  name: 'api_request',
  category: 'api',
  properties: {
    endpoint: '/api/repos',
    method: 'GET',
    status_code: 200,
    response_time_ms: 150
  },
  sessionId: req.sessionID
});

// Query events
const events = await analyticsService.getEvents({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  eventName: 'repository_analyzed'
});

// Get metrics
const metrics = await analyticsService.getMetrics({
  metric: 'repository_analyzed',
  groupBy: 'day',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});
```

### Analytics Middleware

Automatically track API requests:

```typescript
import { analyticsMiddleware } from '@/server/middleware/analytics';

app.use(analyticsMiddleware);
```

## Event Categories

### Standard Categories

- `interaction` - User interactions (clicks, form submissions)
- `navigation` - Page views, route changes
- `analysis` - Repository analysis events
- `search` - Search queries and results
- `export` - Data export events
- `error` - Error events
- `api` - API requests
- `performance` - Performance metrics

## Event Naming Convention

Use snake_case for event names:

- `repository_analyzed`
- `search_performed`
- `data_exported`
- `error_occurred`
- `page_viewed`

## Privacy and Compliance

### 1. Data Anonymization

Personally identifiable information is anonymized:

```typescript
// Good - anonymized
analytics.trackEvent({
  name: 'user_signup',
  category: 'auth',
  properties: {
    signup_method: 'github',
    // No email, name, or other PII
  }
});

// Bad - includes PII
analytics.trackEvent({
  name: 'user_signup',
  properties: {
    email: 'user@example.com', // Don't track PII
    name: 'John Doe'
  }
});
```

### 2. Opt-Out Mechanism

Users can opt out of analytics:

```typescript
import { analytics } from '@/lib/analytics';

// Check opt-out status
if (analytics.isOptedOut()) {
  // Don't track
  return;
}

// Opt out
analytics.optOut();

// Opt in
analytics.optIn();
```

### 3. Data Retention

Analytics data is retained for 90 days:

```sql
-- Cleanup old events
DELETE FROM analytics_events 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Querying Analytics

### Get Event Counts

```typescript
const counts = await analyticsService.getEventCounts({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  groupBy: 'day'
});

// Result:
// [
//   { date: '2025-01-01', count: 150 },
//   { date: '2025-01-02', count: 200 },
//   ...
// ]
```

### Get Top Events

```typescript
const topEvents = await analyticsService.getTopEvents({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  limit: 10
});

// Result:
// [
//   { event_name: 'repository_analyzed', count: 500 },
//   { event_name: 'search_performed', count: 300 },
//   ...
// ]
```

### Get User Activity

```typescript
const activity = await analyticsService.getUserActivity({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});

// Result:
// {
//   active_users: 150,
//   new_users: 25,
//   returning_users: 125,
//   avg_session_duration: 300
// }
```

## Admin Dashboard Integration

View analytics in the admin dashboard:

1. Navigate to `/admin`
2. Click "Analytics" tab
3. View metrics, charts, and event logs

### Available Metrics

- Total events
- Events by category
- Top events
- User activity
- Error rates
- Performance metrics

## Testing

### Unit Tests

```typescript
import { AnalyticsService } from '@/server/analytics';

describe('AnalyticsService', () => {
  it('tracks events', async () => {
    const service = new AnalyticsService();
    
    await service.trackEvent({
      name: 'test_event',
      category: 'test',
      properties: { foo: 'bar' },
      sessionId: 'test-session'
    });
    
    const events = await service.getEvents({
      eventName: 'test_event'
    });
    
    expect(events).toHaveLength(1);
    expect(events[0].properties.foo).toBe('bar');
  });
});
```

### Integration Tests

```typescript
import request from 'supertest';
import { app } from '@/server';

describe('Analytics API', () => {
  it('tracks events via API', async () => {
    const response = await request(app)
      .post('/api/analytics/events')
      .send({
        name: 'test_event',
        category: 'test',
        properties: { foo: 'bar' }
      });
    
    expect(response.status).toBe(201);
  });
});
```

## Performance Considerations

### 1. Async Tracking

Events are tracked asynchronously to avoid blocking:

```typescript
// Good - async, non-blocking
analytics.trackEvent(event); // Returns immediately

// Bad - synchronous, blocking
await analytics.trackEvent(event); // Waits for completion
```

### 2. Batch Processing

Events are batched for efficient storage:

```typescript
// Events are automatically batched every 5 seconds
// or when batch size reaches 100 events
```

### 3. Connection Pooling

Use connection pooling for database:

```typescript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000
});
```

## Troubleshooting

### Events Not Appearing

1. Check analytics is enabled:
   ```bash
   ENABLE_ANALYTICS=true
   ```

2. Check database connection:
   ```bash
   psql  -c "SELECT COUNT(*) FROM analytics_events;"
   ```

3. Check logs for errors:
   ```bash
   grep "analytics" logs/app.log
   ```

### High Database Load

1. Check event volume:
   ```sql
   SELECT COUNT(*) FROM analytics_events 
   WHERE created_at > NOW() - INTERVAL '1 hour';
   ```

2. Increase batch size:
   ```typescript
   analytics.setBatchSize(200);
   ```

3. Add database indexes:
   ```sql
   CREATE INDEX idx_analytics_custom ON analytics_events(property_field);
   ```

## Files

- `server/analytics.ts` - Analytics service
- `client/src/lib/analytics.ts` - Client analytics
- `server/middleware/analytics.ts` - Analytics middleware
- `server/migrations/create-analytics-schema.ts` - Database schema
- `shared/schema.ts` - Shared types

## Related Documentation

- [Admin Dashboard Guide](ADMIN_DASHBOARD_GUIDE.md)
- [Monitoring Integration Guide](MONITORING_INTEGRATION_GUIDE.md)
- [Privacy Policy](PRIVACY_POLICY.md)

---

**Last Updated:** January 4, 2025
