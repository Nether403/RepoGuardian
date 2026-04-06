# RepoRadar

<p align="center">
  <img src="client/public/Images/repo.gif" alt="RepoRadar Demo" width="800" />
</p>

## Overview

RepoRadar is a high-performance, full-stack web application that provides AI-powered analysis of GitHub repositories. The platform helps users discover, analyze, and compare repositories based on key metrics including originality, completeness, marketability, monetization potential, and usefulness. Built with a modern React frontend and Express.js backend, it leverages Google's Gemini 2.5 Pro AI model to provide comprehensive repository insights.

**🚀 Performance Optimized**: RepoRadar includes comprehensive performance optimization features across database, API, and frontend layers, with intelligent caching, compression, and fallback strategies for enterprise-grade reliability.
** Live-Beta v1.29 @ Https://RepoRadar.online
## 🎯 Key Features

### Core Analysis Features
- **AI-Powered Repository Analysis**: Comprehensive scoring across 5 key metrics
- **Advanced Search & Filtering**: Multi-criteria search with language, stars, and date filters
- **Batch Analysis**: Process multiple repositories simultaneously with progress tracking
- **Export Functionality**: PDF and CSV export for analysis results
- **Find Similar Repositories**: AI-powered similarity matching

### User Experience Features
- **Interactive Onboarding**: Guided tour for new users
- **Micro-interactions**: Smooth animations and responsive feedback
- **Intelligent User Profiles**: Bookmarks, collections, and personalized recommendations
- **AI Assistant**: Context-aware help with holographic interface
- **Comprehensive Documentation**: Detailed guides and API reference

### Enterprise Features
- **API Access & Developer Tools**: RESTful API with rate limiting
- **Advanced Analytics Dashboard**: Time series analysis and trend predictions
- **Integration Hub**: Connect with GitHub, GitLab, Slack, Discord, Jira, and CI/CD tools
- **AI-Powered Code Review**: Security analysis and quality metrics
- **Subscription Management**: Tiered plans with Stripe integration

### Performance & Reliability
- **Database Optimization**: Connection pooling, query monitoring, and automatic indexing
- **Intelligent Caching**: Multi-layer caching with Redis support and compression
- **Response Compression**: Gzip/Brotli compression with configurable thresholds
- **GitHub API Optimization**: Request batching, rate limiting, and intelligent caching
- **Frontend Performance**: Code splitting, lazy loading, and bundle optimization
- **Fallback Strategies**: Graceful degradation for maximum reliability
- **Performance Monitoring**: Real-time metrics, alerting, and dashboard

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- GitHub token (optional, for higher rate limits)
- Google Gemini API key (required for primary AI)
- OpenAI API key (optional, for AI fallback)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/reporadar.git
cd reporadar

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run db:push

# Start development server
npm run dev
```### Production Deployment

#### Render Deployment (Recommended)
```bash
# See comprehensive deployment guide
docs/RENDER_DEPLOYMENT_GUIDE.md

# Quick start:
# 1. Create Neon database
# 2. Create Render Web Service
# 3. Configure environment variables
# 4. Deploy!
```

**Deployment Resources:**
- **[Render Deployment Guide](docs/RENDER_DEPLOYMENT_GUIDE.md)** - Complete step-by-step guide
- **[Environment Variables Template](docs/RENDER_ENV_TEMPLATE.md)** - Copy-paste template
- **[Troubleshooting Guide](docs/RENDER_TROUBLESHOOTING.md)** - Quick solutions
- **[Deployment Checklist](docs/RENDER_DEPLOYMENT_CHECKLIST.md)** - Pre/post deployment checks
- **[Deployment Verification](docs/DEPLOYMENT_VERIFICATION.md)** - Verify deployed application

**Verify Deployment:**
```bash
# Test your deployed application
npm run verify:deployment https://your-app.onrender.com

# With authentication token
export VERIFY_AUTH_TOKEN=your-token
npm run verify:deployment https://your-app.onrender.com
```

#### Standard Deployment
```bash
# Linux/macOS
./scripts/deploy.sh --environment production --performance true

# Windows
.\scripts\deploy.ps1 -Environment production -EnablePerformanceOptimizations $true
```

#### Docker Deployment
```bash
# Deploy with performance optimizations
docker-compose -f docker/docker-compose.performance.yml up -d

# Scale for high availability
docker-compose -f docker/docker-compose.performance.yml up -d --scale reporadar=3
```

## 🔐 Authentication & Security

RepoRadar includes production-grade authentication and security features:

### Authentication Methods

#### Password Authentication
- **Secure Password Hashing**: bcrypt with configurable cost factor (default: 12)
- **Password Strength Validation**: Minimum 8 characters required
- **Account Lockout**: Automatic lockout after 5 failed attempts (15-minute duration)
- **Password Reset**: Secure email-based password reset with time-limited tokens

#### OAuth Social Login (Stack Auth)
- **Google OAuth**: Sign in with Google account
- **GitHub OAuth**: Sign in with GitHub account
- **Account Linking**: Automatically link OAuth providers to existing accounts
- **Profile Sync**: Sync profile information from OAuth providers

### Security Features

#### Rate Limiting
- **Login Attempts**: 5 per 15 minutes per IP address
- **Password Reset**: 3 per hour per email address
- **API Calls**: Tier-based limits (Free: 100/hour, Pro: 1000/hour)
- **Analysis Requests**: Daily limits based on subscription tier

#### Session Security
- **Session Regeneration**: New session ID on login and privilege changes
- **Session Metadata**: Track IP address and user agent
- **Session Timeout**: Configurable timeout with sliding window
- **Suspicious Activity Detection**: Automatic session invalidation

#### HTTPS & Security Headers
- **HTTPS Enforcement**: Automatic redirect in production
- **HSTS Headers**: HTTP Strict Transport Security enabled
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, CSP
- **Secure Cookies**: HttpOnly, Secure, and SameSite flags

### Configuration

#### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Session Security
SESSION_SECRET=your_secure_random_secret_here
SESSION_ENCRYPTION_KEY=your_64_char_hex_key_here

# Password Security
BCRYPT_ROUNDS=12
```

#### OAuth Setup (Optional)
```bash
# Stack Auth Configuration
VITE_STACK_PROJECT_ID=your_project_id
VITE_STACK_PUBLISHABLE_CLIENT_KEY=your_client_key
STACK_SECRET_SERVER_KEY=your_secret_key
```

Get your Stack Auth credentials from [Neon Console → Auth](https://console.neon.tech).

#### Email Service (Optional)
```bash
# Resend Configuration
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Your App Name
PASSWORD_RESET_URL=https://yourdomain.com/reset-password
```

Get your Resend API key from [resend.com/api-keys](https://resend.com/api-keys).

#### Rate Limiting Configuration
```bash
# Storage: memory (single instance), redis (multi-instance), or postgres (fallback)
RATE_LIMIT_STORAGE=memory
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Authentication Rate Limits
RATE_LIMIT_AUTH_LOGIN_LIMIT=5
RATE_LIMIT_AUTH_LOGIN_WINDOW=900000      # 15 minutes
RATE_LIMIT_AUTH_RESET_LIMIT=3
RATE_LIMIT_AUTH_RESET_WINDOW=3600000     # 1 hour
```

#### HTTPS Configuration
```bash
# Production Settings
FORCE_HTTPS=true
HSTS_MAX_AGE=31536000                    # 1 year
HSTS_INCLUDE_SUBDOMAINS=true

# Security Headers
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
```

### Setup Guides

For detailed setup instructions, see:
- [OAuth Setup Guide](docs/OAUTH_SETUP.md) - Configure Google and GitHub OAuth
- [Email Service Guide](docs/EMAIL_SERVICE.md) - Configure password reset emails
- [Rate Limiting Guide](docs/RATE_LIMITING.md) - Configure rate limiting
- [Security Best Practices](docs/SECURITY_BEST_PRACTICES.md) - Production security checklist

## ⚙️ Performance Configuration

RepoRadar includes a comprehensive performance configuration system. All settings can be configured through environment variables or the centralized configuration manager.

### Quick Configuration Check
```bash
# Validate current configuration
npm run config:validate

# View configuration summary
npm run config:summary

# Export configuration
npm run config:export
```

### Key Performance Settings

#### Database Performance
```bash
DB_POOL_MIN=2                    # Minimum connections
DB_POOL_MAX=10                   # Maximum connections  
DB_QUERY_MONITORING_ENABLED=true # Enable query monitoring
DB_SLOW_QUERY_THRESHOLD=1000     # Slow query threshold (ms)
DB_AUTO_CREATE_INDEXES=true      # Auto-create missing indexes
```

#### Cache Configuration
```bash
CACHE_ENABLED=true               # Enable caching
CACHE_TYPE=memory                # memory, redis, or hybrid
CACHE_MEMORY_MAX_SIZE=100        # Cache size (MB)
CACHE_COMPRESSION_ENABLED=true   # Compress cache entries
```

#### Compression Settings
```bash
COMPRESSION_ENABLED=true         # Enable response compression
COMPRESSION_ALGORITHMS=gzip,brotli # Supported algorithms
COMPRESSION_LEVEL=6              # Compression level (1-9)
COMPRESSION_THRESHOLD=1024       # Min size to compress (bytes)
```

#### GitHub API Optimization
```bash
GITHUB_OPTIMIZATION_ENABLED=true # Enable API optimizations
GITHUB_BATCH_SIZE=10             # Batch request size
GITHUB_CACHING_ENABLED=true      # Cache API responses
GITHUB_CACHE_TTL=300             # Cache TTL (seconds)
```

#### Frontend Performance
```bash
FRONTEND_CODE_SPLITTING_ENABLED=true  # Enable code splitting
FRONTEND_LAZY_LOADING_ENABLED=true    # Enable lazy loading
FRONTEND_TREE_SHAKING_ENABLED=true    # Enable tree shaking
FRONTEND_SERVICE_WORKER_ENABLED=false # Enable service worker
```

For complete configuration options, see [Performance Configuration Guide](docs/PERFORMANCE_CONFIGURATION.md).

## 📊 System Architecture

### Performance-Optimized Architecture

RepoRadar is built with performance as a core principle, featuring:

#### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and caching
- **UI Framework**: Radix UI with shadcn/ui design system
- **Styling**: Tailwind CSS with responsive design
- **Build Tool**: Vite with performance optimizations
- **Performance Features**:
  - Code splitting with route and component-based chunks
  - Lazy loading with intersection observer
  - Bundle optimization with tree shaking
  - Service worker caching (optional)
  - Compression and minification

#### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with structured error handling
- **Session Management**: PostgreSQL-backed sessions
- **Performance Features**:
  - Connection pooling with health monitoring
  - Query performance monitoring and optimization
  - Automatic index creation and management
  - Multi-layer caching (memory/Redis)
  - Response compression (gzip/brotli)
  - GitHub API optimization with batching
  - Graceful fallback strategies

#### Database Layer
- **Primary Database**: PostgreSQL with Neon serverless
- **ORM**: Drizzle ORM for type-safe operations
- **Performance Features**:
  - Optimized connection pooling
  - Slow query monitoring and logging
  - Automatic index creation
  - Query analysis and optimization
  - Health checks and fallback connections

#### Caching Strategy
- **Multi-Layer Caching**: Memory + Redis support
- **Intelligent Invalidation**: Time, event, and manual strategies
- **Compression**: Automatic compression for large cache entries
- **Fallback**: Direct retrieval when cache is unavailable

### AI Integration
- **AI Provider**: Google Gemini 2.5 Pro for repository analysis
- **Analysis Metrics**: Five-factor scoring system
- **Response Format**: Structured JSON with comprehensive insights
- **Rate Limiting**: Built-in request management

### External Integrations
- **GitHub API**: Repository data with optimization
- **Stripe**: Payment processing for subscriptions
- **Authentication**: Stack Auth (OAuth) with secure password hashing
- **Monitoring**: Performance metrics and alerting

## 🛠️ Development

### Development Workflow
```bash
# Start development server
npm run dev

# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Type checking
npm run check

# Build for production
npm run build
```

### Performance Testing
```bash
# Run performance benchmarks
npm run test -- tests/PerformanceBenchmark.test.ts

# Run load testing
npm run test -- server/performance/__tests__/LoadTesting.integration.test.ts

# Run end-to-end performance tests
npm run test -- tests/EndToEnd.integration.test.ts
```

### Configuration Management
```bash
# Validate configuration
npm run config:validate

# View configuration summary  
npm run config:summary

# Export configuration as JSON
npm run config:export
```

## 📚 Documentation

### Deployment
- **[Render Deployment Guide](docs/RENDER_DEPLOYMENT_GUIDE.md)** - Complete Render deployment guide
- **[Environment Variables Template](docs/RENDER_ENV_TEMPLATE.md)** - Environment configuration template
- **[Troubleshooting Guide](docs/RENDER_TROUBLESHOOTING.md)** - Common issues and solutions
- **[Deployment Checklist](docs/RENDER_DEPLOYMENT_CHECKLIST.md)** - Pre/post deployment verification
- **[Scaling Configuration](docs/SCALING_CONFIGURATION.md)** - Vertical and horizontal scaling guide

### Performance & Configuration
- **[Performance Configuration Guide](docs/PERFORMANCE_CONFIGURATION.md)** - Comprehensive performance tuning guide
- **[Configuration System](config/README.md)** - Configuration management documentation
- **[Deployment Scripts](scripts/)** - Deployment automation documentation
- **[Docker Setup](docker/)** - Container deployment with performance optimizations

### Security & Authentication
- **[OAuth Setup Guide](docs/OAUTH_SETUP.md)** - Configure Google and GitHub OAuth
- **[Email Service Guide](docs/EMAIL_SERVICE.md)** - Configure password reset emails
- **[Rate Limiting Guide](docs/RATE_LIMITING.md)** - Configure rate limiting
- **[Security Best Practices](docs/SECURITY_BEST_PRACTICES.md)** - Production security checklist
- **[Security Configuration](docs/SECURITY_CONFIGURATION.md)** - Security headers and HTTPS

## 🔧 Environment Configuration

### Development
```bash
NODE_ENV=development
DB_POOL_MAX=5
CACHE_MEMORY_MAX_SIZE=50
COMPRESSION_LEVEL=1
METRICS_RETENTION_DAYS=7
```

### Staging
```bash
NODE_ENV=staging
DB_POOL_MAX=15
CACHE_MEMORY_MAX_SIZE=128
COMPRESSION_LEVEL=6
METRICS_RETENTION_DAYS=30
```

### Production
```bash
NODE_ENV=production
DB_POOL_MAX=30
CACHE_MEMORY_MAX_SIZE=512
COMPRESSION_LEVEL=9
METRICS_RETENTION_DAYS=90
```

## 📈 Performance Monitoring

RepoRadar includes comprehensive performance monitoring:

- **Real-time Metrics**: Database, API, and frontend performance
- **Alerting System**: Configurable thresholds with multiple channels
- **Performance Dashboard**: Visual metrics and historical data
- **Health Checks**: Automated system health monitoring
- **Fallback Tracking**: Monitor fallback usage and recovery

Access the performance dashboard at `/api/performance/dashboard` when monitoring is enabled.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and performance benchmarks
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the [docs](docs/) directory
- **Configuration Issues**: Run `npm run config:validate`
- **Performance Issues**: Check the performance dashboard
- **General Issues**: Create an issue on GitHub

---

**Built with ❤️ and optimized for ⚡ performance**
