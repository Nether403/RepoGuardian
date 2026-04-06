# RepoRadar API Documentation

## Base URL

```
http://localhost:5000/api
```

## Authentication

Most endpoints require authentication via session cookies. Admin endpoints require admin privileges.

## Endpoints

### Repository Analysis

#### Analyze Repository
```
POST /api/analyze
```

Analyzes a GitHub repository.

**Authentication:** Required

**Rate Limits:**
- Free tier: 10 analyses per day
- Pro tier: 100 analyses per day
- Enterprise tier: Unlimited

**Request Body:**
```json
{
  "owner": "facebook",
  "repo": "react"
}
```

**Response:**
```json
{
  "id": "uuid",
  "repository": "facebook/react",
  "score": 95,
  "metrics": {
    "code_quality": 98,
    "documentation": 95,
    "community": 92,
    "maintenance": 97
  },
  "analysis": {
    "strengths": ["Excellent documentation", "Active community"],
    "improvements": ["Add more examples"]
  },
  "analyzedAt": "2025-01-04T12:00:00Z"
}
```

**Error Responses:**

429 - Rate limit exceeded:
```json
{
  "error": "Daily analysis limit exceeded",
  "tier": "free",
  "limit": 10,
  "upgrade": "pro",
  "message": "Upgrade to Pro for 100 analyses per day"
}
```

#### Reanalyze Repository
```
POST /api/repositories/:id/reanalyze
```

Triggers a fresh analysis of a repository, clearing cached results.

**Authentication:** Required

**Rate Limits:**
- 1 reanalysis per repository per hour (all tiers)

**Path Parameters:**
- `id` - Repository ID (UUID)

**Response:**
```json
{
  "analysis": {
    "id": "uuid",
    "repository": "facebook/react",
    "score": 96,
    "metrics": {
      "code_quality": 99,
      "documentation": 95,
      "community": 93,
      "maintenance": 97
    },
    "analyzedAt": "2025-01-04T13:00:00Z"
  },
  "repository": {
    "id": "uuid",
    "name": "react",
    "owner": "facebook",
    "lastAnalyzed": "2025-01-04T13:00:00Z",
    "analysisCount": 3
  }
}
```

**Error Responses:**

404 - Repository not found:
```json
{
  "error": "Repository not found"
}
```

429 - Reanalysis rate limit exceeded:
```json
{
  "error": "Reanalysis rate limit exceeded",
  "retryAfter": 45,
  "message": "Please wait 45 minutes before reanalyzing this repository"
}
```

### Search

#### Search Repositories
```
GET /api/search?q=react&sort=stars&order=desc
```

Searches GitHub repositories.

**Query Parameters:**
- `q` (required) - Search query
- `sort` - Sort by: stars, forks, updated (default: stars)
- `order` - Order: asc, desc (default: desc)
- `page` - Page number (default: 1)
- `per_page` - Results per page (default: 30, max: 100)

**Response:**
```json
{
  "items": [
    {
      "id": 123,
      "name": "react",
      "full_name": "facebook/react",
      "description": "A JavaScript library for building user interfaces",
      "stars": 200000,
      "forks": 40000,
      "language": "JavaScript",
      "url": "https://github.com/facebook/react"
    }
  ],
  "total_count": 1000,
  "page": 1,
  "per_page": 30
}
```

### Background Jobs

#### Create Job
```
POST /api/jobs
```

Creates a background job.

**Request Body:**
```json
{
  "type": "batch-analysis",
  "data": {
    "repositories": ["owner/repo1", "owner/repo2"]
  }
}
```

**Response:**
```json
{
  "id": "job-uuid",
  "type": "batch-analysis",
  "status": "queued",
  "progress": 0,
  "createdAt": "2025-01-04T12:00:00Z"
}
```

#### Get Job Status
```
GET /api/jobs/:id
```

Gets the status of a background job.

**Response:**
```json
{
  "id": "job-uuid",
  "type": "batch-analysis",
  "status": "processing",
  "progress": 45,
  "result": null,
  "error": null,
  "createdAt": "2025-01-04T12:00:00Z",
  "startedAt": "2025-01-04T12:00:05Z",
  "completedAt": null
}
```

#### Cancel Job
```
DELETE /api/jobs/:id
```

Cancels a background job.

**Response:**
```json
{
  "id": "job-uuid",
  "status": "cancelled"
}
```

### Analytics

#### Get Analytics Dashboard
```
GET /api/analytics/dashboard
```

Gets analytics dashboard data for the authenticated user.

**Authentication:** Required

**Response:**
```json
{
  "stats": {
    "totalAnalyses": 45,
    "thisMonth": 12,
    "growth": 15.5,
    "avgScore": 87.3,
    "topLanguage": "JavaScript",
    "activeProjects": 8
  },
  "activity": [
    { "date": "2025-01-01", "count": 3 },
    { "date": "2025-01-02", "count": 5 }
  ],
  "languages": [
    { "name": "JavaScript", "value": 45 },
    { "name": "Python", "value": 30 }
  ],
  "scores": [
    { "name": "Code Quality", "score": 88 },
    { "name": "Documentation", "score": 85 }
  ]
}
```

#### Get Advanced Analytics
```
GET /api/analytics/advanced?timeRange=30d
```

Gets advanced analytics data (Pro and Enterprise tiers only).

**Authentication:** Required

**Subscription Required:** Pro or Enterprise

**Query Parameters:**
- `timeRange` - Time range: 7d, 30d, 90d, 1y (default: 30d)

**Response:**
```json
{
  "trends": [
    {
      "month": "2025-01",
      "analyses": 45,
      "avgScore": 87.3,
      "topLanguages": ["JavaScript", "Python"]
    }
  ],
  "performance": [
    {
      "metric": "Code Quality",
      "current": 88,
      "previous": 85,
      "change": 3.5
    }
  ],
  "insights": [
    {
      "type": "improvement",
      "message": "Your code quality scores improved by 3.5% this month"
    }
  ]
}
```

**Error Responses:**

403 - Subscription required:
```json
{
  "error": "Advanced analytics requires Pro or Enterprise subscription",
  "tier": "free",
  "upgrade": "pro",
  "message": "Upgrade to Pro to access advanced analytics"
}
```

#### Track Event
```
POST /api/analytics/events
```

Tracks an analytics event.

**Request Body:**
```json
{
  "name": "repository_analyzed",
  "category": "analysis",
  "properties": {
    "repository": "owner/name",
    "duration_ms": 1500
  }
}
```

**Response:**
```json
{
  "id": "event-uuid",
  "tracked": true
}
```

### Subscription Management

#### Get Subscription Status
```
GET /api/subscription/status
```

Gets the current user's subscription status.

**Authentication:** Required

**Response:**
```json
{
  "tier": "pro",
  "status": "active",
  "currentPeriodEnd": "2025-02-04T12:00:00Z",
  "cancelAtPeriodEnd": false,
  "stripeCustomerId": "cus_...",
  "stripeSubscriptionId": "sub_..."
}
```

#### Create Checkout Session
```
POST /api/subscription/checkout
```

Creates a Stripe checkout session for upgrading subscription.

**Authentication:** Required

**Request Body:**
```json
{
  "priceId": "price_pro_monthly"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_test_..."
}
```

**Error Responses:**

400 - Invalid price ID:
```json
{
  "error": "Invalid price ID"
}
```

500 - Stripe error:
```json
{
  "error": "Failed to create checkout session",
  "message": "Stripe API error"
}
```

#### Create Customer Portal Session
```
POST /api/subscription/portal
```

Creates a Stripe customer portal session for managing subscription.

**Authentication:** Required

**Response:**
```json
{
  "url": "https://billing.stripe.com/session/..."
}
```

**Error Responses:**

400 - No active subscription:
```json
{
  "error": "No active subscription found"
}
```

#### Cancel Subscription
```
POST /api/subscription/cancel
```

Cancels the current subscription at the end of the billing period.

**Authentication:** Required

**Response:**
```json
{
  "tier": "pro",
  "status": "active",
  "cancelAtPeriodEnd": true,
  "currentPeriodEnd": "2025-02-04T12:00:00Z",
  "message": "Subscription will be cancelled on 2025-02-04"
}
```

**Error Responses:**

400 - No active subscription:
```json
{
  "error": "No active subscription to cancel"
}
```

#### Get Billing History
```
GET /api/subscription/invoices
```

Gets the user's billing history.

**Authentication:** Required

**Response:**
```json
{
  "invoices": [
    {
      "id": "in_...",
      "amount": 1900,
      "currency": "usd",
      "status": "paid",
      "created": "2025-01-04T12:00:00Z",
      "invoicePdf": "https://pay.stripe.com/invoice/..."
    }
  ]
}
```

### Admin Endpoints

All admin endpoints require admin authentication.

#### Get System Health
```
GET /api/admin/health
```

Gets system health metrics.

**Response:**
```json
{
  "database": {
    "status": "healthy",
    "connections": 5,
    "responseTime": 10
  },
  "cache": {
    "status": "healthy",
    "hitRate": 0.85,
    "responseTime": 2
  },
  "api": {
    "status": "healthy",
    "avgResponseTime": 150,
    "errorRate": 0.01
  }
}
```

#### Get System Metrics
```
GET /api/admin/metrics?startDate=2025-01-01&endDate=2025-01-31
```

Gets system metrics over time.

**Query Parameters:**
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)
- `metric` - Specific metric to retrieve (optional)

**Response:**
```json
{
  "metrics": [
    {
      "timestamp": "2025-01-01T00:00:00Z",
      "requests": 1000,
      "errors": 10,
      "avgResponseTime": 150
    }
  ]
}
```

#### Get User Activity
```
GET /api/admin/users?startDate=2025-01-01&endDate=2025-01-31
```

Gets user activity metrics.

**Response:**
```json
{
  "activeUsers": 150,
  "newUsers": 25,
  "returningUsers": 125,
  "avgSessionDuration": 300,
  "topFeatures": [
    { "feature": "repository_analysis", "usage": 500 },
    { "feature": "search", "usage": 300 }
  ]
}
```

#### Get Logs
```
GET /api/admin/logs?level=error&limit=100
```

Gets application logs.

**Query Parameters:**
- `level` - Log level: error, warn, info, debug (optional)
- `limit` - Number of logs to return (default: 100, max: 1000)
- `startDate` - Start date (ISO 8601) (optional)
- `endDate` - End date (ISO 8601) (optional)
- `search` - Search term (optional)

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-01-04T12:00:00Z",
      "level": "error",
      "message": "Failed to fetch repository",
      "context": {
        "repository": "owner/name",
        "error": "Not found"
      }
    }
  ],
  "total": 100
}
```

#### Export Data
```
GET /api/admin/export?format=csv&type=analytics
```

Exports data in CSV or JSON format.

**Query Parameters:**
- `format` - Export format: csv, json (required)
- `type` - Data type: analytics, users, logs (required)
- `startDate` - Start date (ISO 8601) (optional)
- `endDate` - End date (ISO 8601) (optional)

**Response:**
Returns file download with appropriate content type.

### Health Check Endpoints

#### Overall Health
```
GET /health
```

Returns overall application health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-04T12:00:00Z",
  "checks": {
    "database": { "status": "up", "responseTime": 5 },
    "cache": { "status": "up", "responseTime": 2 },
    "api": { "status": "up", "responseTime": 10 },
    "queue": { "status": "up", "responseTime": 3 }
  }
}
```

#### Readiness Check
```
GET /health/ready
```

Returns readiness status (for load balancers).

**Response:**
```json
{
  "ready": true,
  "timestamp": "2025-01-04T12:00:00Z"
}
```

#### Liveness Check
```
GET /health/live
```

Returns liveness status (for container orchestration).

**Response:**
```json
{
  "alive": true,
  "timestamp": "2025-01-04T12:00:00Z"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Technical error message",
    "userMessage": "User-friendly error message",
    "recoveryAction": "Suggested action to resolve the error"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` (400) - Invalid request data
- `UNAUTHORIZED` (401) - Authentication required
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `RATE_LIMIT_EXCEEDED` (429) - Too many requests
- `INTERNAL_ERROR` (500) - Server error
- `SERVICE_UNAVAILABLE` (503) - Service temporarily unavailable

## Subscription Tiers

RepoRadar offers three subscription tiers with different limits and features:

### Free Tier

**Limits:**
- 10 repository analyses per day
- 100 API calls per hour
- Basic analytics only

**Features:**
- Repository analysis
- Search functionality
- Basic analytics dashboard
- Bookmarks

### Pro Tier ($19/month)

**Limits:**
- 100 repository analyses per day
- 1,000 API calls per hour

**Features:**
- All Free tier features
- Advanced analytics
- PDF/CSV export
- Priority support
- Reanalysis functionality

### Enterprise Tier ($99/month)

**Limits:**
- Unlimited repository analyses
- Unlimited API calls

**Features:**
- All Pro tier features
- Custom integrations
- API access
- Dedicated support
- SLA guarantees
- Custom webhooks

## Rate Limiting

API endpoints are rate limited based on subscription tier:

**API Call Limits:**
- Free tier: 100 requests/hour
- Pro tier: 1,000 requests/hour
- Enterprise tier: Unlimited
- Unauthenticated: 60 requests/hour

**Analysis Limits:**
- Free tier: 10 analyses/day
- Pro tier: 100 analyses/day
- Enterprise tier: Unlimited

**Reanalysis Limits:**
- All tiers: 1 reanalysis per repository per hour

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704369600
X-RateLimit-Tier: pro
```

**Rate Limit Exceeded Response:**

When rate limits are exceeded, the API returns a 429 status code:

```json
{
  "error": "Rate limit exceeded",
  "tier": "free",
  "limit": 100,
  "window": "hour",
  "retryAfter": 3600,
  "upgrade": "pro",
  "message": "Upgrade to Pro for 1,000 API calls per hour"
}
```

**Tier Enforcement:**

Premium features return 403 when accessed without proper subscription:

```json
{
  "error": "Subscription required",
  "feature": "advanced_analytics",
  "requiredTier": "pro",
  "currentTier": "free",
  "message": "This feature requires a Pro or Enterprise subscription",
  "upgradeUrl": "/subscription"
}
```

## Pagination

List endpoints support pagination:

```
GET /api/endpoint?page=2&per_page=50
```

Pagination info is included in responses:

```json
{
  "data": [...],
  "pagination": {
    "page": 2,
    "per_page": 50,
    "total": 1000,
    "total_pages": 20
  }
}
```

## Filtering and Sorting

List endpoints support filtering and sorting:

```
GET /api/endpoint?filter[status]=active&sort=-createdAt
```

- Use `filter[field]=value` for filtering
- Use `sort=field` for ascending sort
- Use `sort=-field` for descending sort

## Webhooks

Subscribe to events via webhooks:

```
POST /api/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["repository.analyzed", "job.completed"],
  "secret": "your-webhook-secret"
}
```

Webhook payloads include:

```json
{
  "event": "repository.analyzed",
  "timestamp": "2025-01-04T12:00:00Z",
  "data": {
    "repository": "owner/name",
    "score": 95
  }
}
```

## WebSocket API

Real-time updates via WebSocket:

```javascript
const ws = new WebSocket('ws://localhost:5000');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Subscribe to job updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'job:job-uuid'
}));
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { RepoRadarClient } from '@reporadar/client';

const client = new RepoRadarClient({
  baseURL: 'http://localhost:5000',
  apiKey: 'your-api-key'
});

// Analyze repository
const analysis = await client.analyze('facebook', 'react');

// Search repositories
const results = await client.search('react', {
  sort: 'stars',
  order: 'desc'
});

// Create background job
const job = await client.createJob('batch-analysis', {
  repositories: ['owner/repo1', 'owner/repo2']
});

// Track analytics event
await client.trackEvent('repository_analyzed', {
  repository: 'owner/name'
});
```

### Python

```python
from reporadar import RepoRadarClient

client = RepoRadarClient(
    base_url='http://localhost:5000',
    api_key='your-api-key'
)

# Analyze repository
analysis = client.analyze('facebook', 'react')

# Search repositories
results = client.search('react', sort='stars', order='desc')

# Create background job
job = client.create_job('batch-analysis', {
    'repositories': ['owner/repo1', 'owner/repo2']
})
```

## Testing

Use the provided test utilities:

```typescript
import { createTestClient } from '@reporadar/test-utils';

const client = createTestClient();

// Mock responses
client.mock('POST', '/api/analyze', {
  status: 200,
  body: { score: 95 }
});

// Make request
const result = await client.analyze('owner', 'repo');
expect(result.score).toBe(95);
```

## Changelog

### v3.1.0 (2025-01-10)

- Added subscription management endpoints
- Added repository reanalysis endpoint
- Added advanced analytics endpoint
- Implemented tier-based rate limiting
- Added subscription tier enforcement
- Enhanced error responses with upgrade prompts
- Added billing history endpoint

### v3.0.0 (2025-01-04)

- Added background job processing endpoints
- Added analytics tracking endpoints
- Added admin dashboard endpoints
- Added health check endpoints
- Improved error responses
- Added rate limiting
- Added WebSocket support

---

**Last Updated:** January 10, 2025
**API Version:** 3.1.0
