# Task 12: Analytics Service Implementation Summary

## Overview
Successfully implemented a comprehensive analytics service for tracking user behavior and events in RepoRadar. The implementation includes event validation, anonymization, privacy controls, batch processing, and opt-out mechanisms.

## Components Implemented

### 1. AnalyticsEventModel Class (`server/analytics.ts`)
A robust event model with the following features:

#### Properties
- `eventName`: Name of the event (max 255 characters)
- `eventCategory`: Category of the event (max 100 characters)
- `properties`: Custom event properties (JSON object)
- `userId`: Optional user identifier
- `sessionId`: Required session identifier
- `timestamp`: Event timestamp

#### Methods
- **`validate()`**: Validates all event fields with comprehensive error messages
  - Checks required fields (eventName, eventCategory, sessionId)
  - Validates field lengths
  - Validates timestamp format
  - Returns validation result with detailed error messages

- **`anonymize()`**: Removes personally identifiable information
  - Removes userId
  - Hashes sessionId with simple hash function
  - Recursively removes sensitive properties (email, name, username, ip, address, phone)
  - Preserves non-sensitive data for analytics

- **`toInsert()`**: Converts event to database insert format
  - Maps to Drizzle ORM schema format
  - Ready for batch insertion

### 2. AnalyticsService Class (`server/analytics.ts`)
A feature-rich service for managing analytics events:

#### Configuration Options
```typescript
interface AnalyticsServiceOptions {
  batchSize?: number;          // Default: 50
  batchInterval?: number;      // Default: 5000ms
  enableAnonymization?: boolean; // Default: true
}
```

#### Core Methods

**Event Tracking**
- **`trackEvent()`**: Track custom analytics events
  - Validates events before queuing
  - Respects opt-out preferences
  - Applies anonymization if enabled
  - Triggers batch processing when batch size reached

- **`trackError()`**: Track error events with context
  - Captures error message, name, and stack trace (first 3 lines)
  - Includes custom context properties
  - Automatically categorized as 'error' events

- **`trackPageView()`**: Track page navigation events
  - Captures page path and metadata
  - Automatically categorized as 'navigation' events

**Privacy Controls**
- **`optOut(sessionId)`**: Opt out a session from tracking
- **`optIn(sessionId)`**: Opt in a session to tracking
- **`hasOptedOut(sessionId)`**: Check opt-out status

**Batch Processing**
- **`processBatch()`**: Process queued events in batches
  - Inserts events to database efficiently
  - Re-queues failed events for retry
  - Handles database errors gracefully

- **`flush()`**: Immediately process all pending events
- **`shutdown()`**: Stop batch processor and flush remaining events

**Analytics Queries**
- **`getMetrics()`**: Query analytics metrics for a time period
  - Returns total event count
  - Groups events by category
  - Groups events by name
  - Supports optional category filtering

#### Batch Processing Features
- **Automatic batching**: Events are queued and processed in configurable batches
- **Time-based processing**: Batch processor runs at regular intervals
- **Size-based processing**: Batch processes immediately when size threshold reached
- **Error handling**: Failed batches are re-queued for retry
- **Graceful shutdown**: Ensures all events are processed before shutdown

### 3. Singleton Instance
```typescript
export const analyticsService = new AnalyticsService();
```
A pre-configured singleton instance ready for use across the application.

## Test Coverage

### AnalyticsEventModel Tests (16 tests)
✅ Constructor tests
- Creates events with required fields
- Creates events with all optional fields

✅ Validation tests
- Validates correct events
- Rejects events with missing/invalid fields
- Validates field length constraints
- Provides detailed error messages

✅ Anonymization tests
- Removes user ID
- Hashes session ID
- Removes sensitive properties (email, name, username, etc.)
- Anonymizes nested properties
- Preserves non-sensitive data
- Preserves event name and category

✅ Conversion tests
- Converts to database insert format

### AnalyticsService Tests (20 tests)
✅ Event tracking tests
- Tracks valid events
- Tracks events with all fields
- Rejects invalid events
- Respects opt-out preferences
- Applies anonymization when enabled
- Skips anonymization when disabled
- Processes batch when size reached

✅ Error tracking tests
- Tracks error events
- Includes error details in properties

✅ Page view tracking tests
- Tracks page view events
- Includes metadata in properties

✅ Opt-out mechanism tests
- Opts out sessions
- Opts in sessions
- Prevents tracking for opted-out sessions
- Allows tracking for opted-in sessions

✅ Batch processing tests
- Processes batches on interval
- Handles batch processing errors
- Re-queues failed events
- Flushes all pending events

✅ Shutdown tests
- Stops batch processor
- Flushes remaining events

✅ Metrics tests
- Returns metrics for time period
- Aggregates by category and name

**Total: 36 tests, all passing ✅**

## Requirements Satisfied

### Requirement 6.1: Track Repository Analysis Events ✅
- `trackEvent()` method supports custom event tracking
- Can track repository metadata in properties

### Requirement 6.2: Track Search Queries ✅
- `trackEvent()` method supports search query tracking
- Can track search queries and result counts

### Requirement 6.3: Track Data Exports ✅
- `trackEvent()` method supports export tracking
- Can track export format and success rate

### Requirement 6.4: Track Error Events ✅
- `trackError()` method specifically for error tracking
- Captures error type, frequency, and context

### Requirement 6.5: Privacy and Compliance ✅
- `anonymize()` method removes PII
- Sensitive properties automatically filtered
- User ID can be excluded from tracking

### Requirement 6.6: Data Anonymization ✅
- Automatic anonymization when enabled
- Session ID hashing
- Recursive property anonymization
- Configurable anonymization

### Requirement 6.7: Opt-out Mechanism ✅
- `optOut()` and `optIn()` methods
- `hasOptedOut()` status check
- Automatic filtering of opted-out sessions

### Additional Features (Beyond Requirements)
- ✅ Batch event processing for efficiency
- ✅ Automatic retry on database errors
- ✅ Configurable batch size and interval
- ✅ Graceful shutdown with event flushing
- ✅ Metrics querying with time-series support
- ✅ Page view tracking helper
- ✅ Comprehensive validation with detailed errors

## Integration Points

### Database Schema
Uses existing `analytics_events` table from Task 11:
- Leverages Drizzle ORM schema
- Uses proper indexes for performance
- Supports JSONB properties for flexibility

### Shared Schema
Integrates with `shared/schema.ts`:
- Uses `InsertAnalyticsEvent` type
- Compatible with existing database structure
- Type-safe event insertion

## Usage Examples

### Basic Event Tracking
```typescript
import { analyticsService } from './server/analytics';

// Track a custom event
await analyticsService.trackEvent({
  name: 'repository_analyzed',
  category: 'analysis',
  sessionId: req.sessionID,
  userId: req.user?.id,
  properties: {
    repositoryName: 'owner/repo',
    analysisType: 'full',
    duration: 1234,
  },
});
```

### Error Tracking
```typescript
try {
  // Some operation
} catch (error) {
  await analyticsService.trackError(error, {
    sessionId: req.sessionID,
    userId: req.user?.id,
    operation: 'repository_analysis',
    repositoryName: 'owner/repo',
  });
}
```

### Page View Tracking
```typescript
await analyticsService.trackPageView('/dashboard', {
  sessionId: req.sessionID,
  userId: req.user?.id,
  referrer: req.headers.referer,
});
```

### Privacy Controls
```typescript
// Opt out a session
analyticsService.optOut(sessionId);

// Check opt-out status
if (analyticsService.hasOptedOut(sessionId)) {
  // Don't track
}

// Opt back in
analyticsService.optIn(sessionId);
```

### Query Metrics
```typescript
const metrics = await analyticsService.getMetrics({
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  category: 'analysis', // Optional
});

console.log(`Total events: ${metrics.totalEvents}`);
console.log('Events by category:', metrics.eventsByCategory);
console.log('Events by name:', metrics.eventsByName);
```

### Graceful Shutdown
```typescript
// On application shutdown
await analyticsService.shutdown();
```

## Performance Considerations

### Batch Processing
- Events are queued in memory for efficient batch insertion
- Default batch size: 50 events
- Default batch interval: 5 seconds
- Reduces database round trips significantly

### Asynchronous Tracking
- All tracking methods are async but non-blocking
- Events are queued immediately
- Database insertion happens in background
- No impact on request response times

### Memory Management
- Queue is cleared after successful batch processing
- Failed events are re-queued (not duplicated)
- Automatic cleanup on shutdown

### Database Efficiency
- Batch inserts reduce connection overhead
- Proper indexes on analytics_events table
- JSONB properties for flexible querying

## Security Considerations

### Data Anonymization
- PII automatically removed when anonymization enabled
- Session IDs hashed to prevent tracking
- Sensitive property keys filtered recursively

### Opt-out Compliance
- Session-based opt-out mechanism
- Immediate effect (no queued events tracked)
- Persistent across service restarts (if stored)

### Error Handling
- Database errors don't lose events (re-queued)
- Validation errors prevent invalid data
- Console logging for debugging (can be disabled)

## Next Steps

The analytics service is now ready for integration into the application:

1. **Task 13**: Integrate analytics tracking into application
   - Add tracking to repository analysis endpoints
   - Add tracking to search endpoints
   - Add tracking to export endpoints
   - Add tracking to error handlers
   - Add page view tracking to frontend

2. **Future Enhancements**:
   - Persistent opt-out storage (database or Redis)
   - Advanced metrics and aggregations
   - Real-time analytics dashboard
   - Event replay for debugging
   - A/B testing support
   - Funnel analysis

## Files Created/Modified

### Created
- ✅ `server/analytics.ts` - Analytics service and event model
- ✅ `server/__tests__/analytics.test.ts` - Comprehensive test suite
- ✅ `TASK_12_ANALYTICS_SERVICE_SUMMARY.md` - This summary document

### Dependencies
- Uses existing `server/db.ts` for database connection
- Uses existing `shared/schema.ts` for type definitions
- Uses existing `analytics_events` table from Task 11

## Conclusion

Task 12 is complete with a production-ready analytics service that:
- ✅ Tracks custom events with validation
- ✅ Protects user privacy with anonymization
- ✅ Respects opt-out preferences
- ✅ Processes events efficiently in batches
- ✅ Handles errors gracefully
- ✅ Provides comprehensive test coverage (36/36 tests passing)
- ✅ Satisfies all requirements (6.1-6.7)

The service is ready for integration into the application in Task 13.
