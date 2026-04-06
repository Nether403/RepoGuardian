---
title: "Repository Endpoints"
description: "API endpoints for repository analysis"
category: "api-reference"
order: 3
lastUpdated: "2025-01-10"
tags: ["api", "repositories"]
---

# Repository Endpoints

API endpoints for analyzing and managing repositories.

## Analyze Repository

Analyze a GitHub repository.

**Endpoint:** `POST /api/v1/analyze`

**Request:**

```bash
curl -X POST https://api.reporadar.com/v1/analyze \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/facebook/react"
  }'
```

**Response:**

```json
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
  "insights": {
    "summary": "React is a highly original...",
    "strengths": ["Large community", "Excellent documentation"],
    "weaknesses": ["Steep learning curve"],
    "recommendations": ["Consider TypeScript"]
  },
  "analyzedAt": "2025-01-10T12:00:00Z"
}
```

## Get Analysis

Retrieve a previous analysis.

**Endpoint:** `GET /api/v1/analysis/:id`

**Request:**

```bash
curl https://api.reporadar.com/v1/analysis/analysis_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:** Same as analyze endpoint.

## Find Similar Repositories

Find repositories similar to a given repository.

**Endpoint:** `POST /api/v1/similar`

**Request:**

```bash
curl -X POST https://api.reporadar.com/v1/similar \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://github.com/facebook/react",
    "limit": 10
  }'
```

**Response:**

```json
{
  "similar": [
    {
      "repository": {
        "name": "vue",
        "owner": "vuejs",
        "url": "https://github.com/vuejs/vue"
      },
      "similarity": 0.92,
      "scores": {
        "originality": 93,
        "completeness": 96,
        "marketability": 97,
        "monetization": 82,
        "usefulness": 98
      }
    }
  ]
}
```

## Batch Analysis

Analyze multiple repositories (Pro/Enterprise only).

**Endpoint:** `POST /api/v1/batch-analysis`

**Request:**

```bash
curl -X POST https://api.reporadar.com/v1/batch-analysis \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "repositories": [
      "https://github.com/facebook/react",
      "https://github.com/vuejs/vue"
    ]
  }'
```

**Response:**

```json
{
  "batchId": "batch_123",
  "status": "processing",
  "total": 2,
  "completed": 0,
  "results": []
}
```

## Get Batch Status

Check batch analysis progress.

**Endpoint:** `GET /api/v1/batch-analysis/:batchId`

**Request:**

```bash
curl https://api.reporadar.com/v1/batch-analysis/batch_123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Error Responses

### 400 Bad Request

```json
{
  "error": "Invalid repository URL",
  "code": "INVALID_URL"
}
```

### 404 Not Found

```json
{
  "error": "Repository not found",
  "code": "NOT_FOUND"
}
```

### 422 Unprocessable Entity

```json
{
  "error": "Repository is private and requires Pro plan",
  "code": "PRIVATE_REPO_REQUIRES_PRO"
}
```

## Next Steps

- Learn about [Analytics Endpoints](./analytics.md)
- Check [Authentication](./authentication.md)
- Explore [Batch Analysis](../features/batch-analysis.md)
