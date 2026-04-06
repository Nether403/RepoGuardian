# Render Environment Variables Template

Copy and paste this template into Render's Environment Variables section.
Replace placeholder values with your actual credentials.

## Required Variables (Minimum for Deployment)

```bash
# Application Environment
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# Database (from Neon - https://neon.tech)
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# AI Service (from Google AI Studio - https://makersuite.google.com/app/apikey)
GEMINI_API_KEY=your_gemini_api_key_here

# Session Security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=generate_64_char_hex_string_here
SESSION_ENCRYPTION_KEY=generate_64_char_hex_string_here

# Security
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000
```

## Recommended Optional Variables

```bash
# Redis (for caching and sessions - improves performance)
# Get from Render Redis or external provider
REDIS_URL=redis://user:password@host:port

# GitHub API (for higher rate limits - https://github.com/settings/tokens)
GITHUB_TOKEN=ghp_your_github_token_here

# AI Fallback (optional but recommended - https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your_openai_api_key_here

# Application URL (update after deployment)
APP_URL=https://your-app.onrender.com

# CORS Configuration (optional - for multiple domains)
# If you have a custom domain, add both URLs separated by commas
# Example: https://reporadar.online,https://reporadar-t0wc.onrender.com
CORS_ALLOWED_ORIGINS=https://your-custom-domain.com,https://your-app.onrender.com

# Email Service (from Resend - https://resend.com/api-keys)
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=RepoRadar

# Stripe (if using payments - https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
```

## Performance Configuration (Optional)

```bash
# Database Connection Pool
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000

# Cache Configuration
CACHE_ENABLED=true
CACHE_TYPE=redis
CACHE_DEFAULT_TTL=3600
CACHE_COMPRESSION_ENABLED=true

# Compression
COMPRESSION_ENABLED=true
COMPRESSION_ALGORITHMS=gzip,brotli
COMPRESSION_LEVEL=6

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
METRICS_COLLECTION_INTERVAL=60
```

## Feature Flags (Optional - all default to true)

```bash
FEATURE_BACKGROUNDJOBS=true
FEATURE_HEALTHCHECKS=true
FEATURE_MONITORING=true
FEATURE_ADMINDASHBOARD=true
FEATURE_HORIZONTALSCALING=true
```

## How to Generate Secrets

```bash
# Generate SESSION_SECRET (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (32 bytes = 64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Notes

1. **Never commit secrets to Git** - Use Render's environment variable management
2. **Update APP_URL** after deployment with your actual Render URL
3. **Redis is optional** - Application works without it but with reduced performance
4. **GitHub token is optional** - Increases API rate limits from 60 to 5000 requests/hour
5. **OpenAI key is optional** - Provides AI fallback if Gemini fails
6. **Stripe keys are optional** - Only needed if using payment features

## Validation

After setting environment variables, verify configuration:

```bash
# In Render logs, look for:
# "Configuration validated successfully"
# "Server started on port 10000"
# "Database connected successfully"
```

## See Also

- Full deployment guide: `docs/RENDER_DEPLOYMENT_GUIDE.md`
- Complete .env.example: `.env.example` in repository root
- Security configuration: `docs/SECURITY_CONFIGURATION.md`
