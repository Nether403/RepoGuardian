---
title: "Analytics Endpoints"
description: "API endpoints for analytics and reporting"
category: "api-reference"
order: 4
lastUpdated: "2025-01-10"
tags: ["api", "analytics"]
---

# Analytics Endpoints

API endpoints for accessing analysis history and analytics.

## List Analyses

Get your analysis history.

**Endpoint:** `GET /api/v1/analyses`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20, max: 100)
- `sort` (optional): Sort field (default: `analyzedAt`)
- `order` (optional): Sort order (`asc` or `desc`, default: `desc`)

**Request:**

```bash
curl "https://api.reporadar.com/v1/analyses?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "analyses": [
    {
      "id": "analysis_123",
      "repository": {
        "name": "react",
        "owner": "facebook",
        "url": "https://github.com/facebook/react"
      },
      "scores": {
        "originality": 95,
        "completeness": 98,
        "marketability": 99,
        "monetization": 85,
        "usefulness": 99
      },
      "analyzedAt": "2025-01-10T12:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Get Analysis Statistics

Get aggregate statistics for your analyses.

**Endpoint:** `GET /api/v1/analytics/stats`

**Query Parameters:**
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)

**Request:**

```bash
curl "https://api.reporadar.com/v1/analytics/stats?startDate=2025-01-01" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "totalAnalyses": 150,
  "averageScores": {
    "originality": 78.5,
    "completeness": 82.3,
    "marketability": 75.8,
    "monetization": 68.2,
    "usefulness": 81.7
  },
  "topRepositories": [
    {
      "name": "react",
      "owner": "facebook",
      "averageScore": 95.2
    }
  ],
  "period": {
    "start": "2025-01-01T00:00:00Z",
    "end": "2025-01-10T23:59:59Z"
  }
}
```

## Export Analyses

Export analyses in CSV or PDF format.

**Endpoint:** `POST /api/v1/analytics/export`

**Request:**

```bash
curl -X POST https://api.reporadar.com/v1/analytics/export \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "analysisIds": ["analysis_123", "analysis_456"],
    "startDate": "2025-01-01",
    "endDate": "2025-01-10"
  }'
```

**Response:**

```json
{
  "exportId": "export_789",
  "status": "processing",
  "format": "csv"
}
```

## Get Export Status

Check export progress and download URL.

**Endpoint:** `GET /api/v1/analytics/export/:exportId`

**Request:**

```bash
curl https://api.reporadar.com/v1/analytics/export/export_789 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "exportId": "export_789",
  "status": "completed",
  "format": "csv",
  "downloadUrl": "https://api.reporadar.com/v1/downloads/export_789.csv",
  "expiresAt": "2025-01-11T12:00:00Z"
}
```

## Webhooks (Enterprise)

Configure webhooks to receive real-time notifications.

**Endpoint:** `POST /api/v1/webhooks`

**Request:**

```bash
curl -X POST https://api.reporadar.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhook",
    "events": ["analysis.completed", "batch.completed"],
    "secret": "your_webhook_secret"
  }'
```

**Webhook Payload:**

```json
{
  "event": "analysis.completed",
  "timestamp": "2025-01-10T12:00:00Z",
  "data": {
    "id": "analysis_123",
    "repository": {
      "name": "react",
      "owner": "facebook"
    },
    "scores": {
      "originality": 95,
      "completeness": 98
    }
  }
}
```

## Next Steps

- Learn about [Authentication](./authentication.md)
- Explore [Repository Endpoints](./repositories.md)
- Check [Webhook Setup](../features/webhooks.md)
