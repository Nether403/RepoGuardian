---
title: "Authentication"
description: "API authentication and security"
category: "api-reference"
order: 2
lastUpdated: "2025-01-10"
tags: ["api", "authentication", "security"]
---

# Authentication

RepoRadar API uses API keys for authentication.

## Getting Your API Key

1. Sign in to RepoRadar
2. Navigate to Settings > API Keys
3. Click "Generate New API Key"
4. Copy and securely store your key

## Using Your API Key

Include your API key in the `Authorization` header:

```bash
curl https://api.reporadar.com/v1/analyze \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Security Best Practices

### Keep Keys Secret

- Never commit API keys to version control
- Use environment variables
- Rotate keys regularly
- Revoke compromised keys immediately

### Use HTTPS Only

All API requests must use HTTPS. HTTP requests will be rejected.

### Rate Limiting

API keys are subject to rate limits based on your subscription tier:

| Tier | Requests/Hour | Requests/Day |
|------|---------------|--------------|
| Free | 10 | 100 |
| Pro | 100 | 1,000 |
| Enterprise | 1,000 | 10,000 |

### IP Whitelisting (Enterprise)

Enterprise customers can restrict API key usage to specific IP addresses.

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Invalid or missing API key",
  "code": "UNAUTHORIZED"
}
```

**Solution:** Check that your API key is correct and included in the Authorization header.

### 403 Forbidden

```json
{
  "error": "API key does not have permission for this resource",
  "code": "FORBIDDEN"
}
```

**Solution:** Upgrade your plan or check your API key permissions.

### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 3600
}
```

**Solution:** Wait for the specified time or upgrade your plan.

## API Key Management

### Listing Keys

View all your API keys in Settings > API Keys.

### Revoking Keys

1. Navigate to Settings > API Keys
2. Click "Revoke" next to the key
3. Confirm revocation

Revoked keys are immediately invalidated.

### Key Rotation

Best practice: Rotate keys every 90 days:
1. Generate a new key
2. Update your applications
3. Revoke the old key

## Next Steps

- Explore [Repository Endpoints](./repositories.md)
- Learn about [Analytics Endpoints](./analytics.md)
- Check [Rate Limiting](../../docs/RATE_LIMITING.md)
