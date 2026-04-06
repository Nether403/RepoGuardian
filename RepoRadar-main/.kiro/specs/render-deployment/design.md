# Design Document

## Overview

This document outlines the technical design for deploying RepoRadar to Render's platform. The deployment architecture leverages Render's Web Service offering to host the full-stack application, with integration to external services for database (Neon PostgreSQL), caching (Redis), and other third-party APIs.

### Deployment Architecture

RepoRadar will be deployed as a single Render Web Service that serves both the Express API backend and the React frontend from one unified service. This approach:
- Simplifies deployment and reduces infrastructure complexity
- Eliminates CORS issues between frontend and backend
- Reduces costs by using a single service instance
- Leverages the existing build process that bundles both client and server

### Key Design Principles

1. **Single Service Architecture**: One Web Service handles all HTTP traffic
2. **External Service Integration**: Database and Redis are external managed services
3. **Environment-Based Configuration**: All settings via environment variables
4. **Zero-Downtime Deployments**: Leverage Render's rolling deployment strategy
5. **Graceful Degradation**: Application functions with reduced features if Redis unavailable
6. **Health-Based Monitoring**: Automated health checks for service reliability

## Architecture

### Service Topology

```
Internet Traffic (HTTPS)
         ↓
   Render Load Balancer (SSL Termination)
         ↓
   RepoRadar Web Service (Port 10000)
   ├── Express Server
   │   ├── API Routes (/api/*)
   │   ├── Health Endpoint (/health)
   │   ├── WebSocket Server (Socket.io)
   │   └── Static File Serving
   └── React Frontend (SPA)
         ↓
   External Services
   ├── Neon PostgreSQL (DATABASE_URL)
   ├── Redis (REDIS_URL) - Optional
   ├── Google Gemini API (GEMINI_API_KEY)
   ├── GitHub API (GITHUB_TOKEN)
   └── Stripe API (STRIPE_SECRET_KEY)
```

### Port Configuration

- **Render Default Port**: 10000 (automatically set via PORT environment variable)
- **Application Binding**: Server binds to `0.0.0.0:${PORT}`
- **SSL/TLS**: Handled by Render's load balancer (automatic HTTPS)
- **Internal Communication**: HTTP between load balancer and service

### Build and Deployment Pipeline

```
Git Push to Branch
       ↓
Render Detects Change
       ↓
Build Phase
├── npm ci (install dependencies)
├── npm run build
│   ├── vite build (client)
│   └── esbuild (server)
└── Output: dist/ directory
       ↓
Deploy Phase
├── Start Command: npm run start
├── Health Check: /health endpoint
└── Traffic Cutover (zero-downtime)
```

## Components and Interfaces

### 1. Web Service Configuration

**Service Type**: Web Service
**Runtime**: Node.js (detected automatically)
**Region**: Choose based on user base (e.g., Oregon for US West)

**Build Configuration**:
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`
- Auto-Deploy: Enabled on main branch

**Instance Configuration**:
- Instance Type: Starter or higher (Free tier has limitations)
- Scaling: Manual or auto-scaling based on traffic
- Health Check Path: `/health`
- Health Check Interval: 30 seconds

### 2. Environment Variables Management

Environment variables are organized into categories for clarity:

**Required Variables**:
```
NODE_ENV=production
PORT=10000
DATABASE_URL=<neon-connection-string>
GEMINI_API_KEY=<google-gemini-key>
SESSION_SECRET=<cryptographically-secure-random-string>
SESSION_ENCRYPTION_KEY=<64-char-hex-string>
```

**Optional but Recommended**:
```
REDIS_URL=<redis-connection-string>
GITHUB_TOKEN=<github-personal-access-token>
STRIPE_SECRET_KEY=<stripe-secret>
STRIPE_PUBLISHABLE_KEY=<stripe-public>
```

**Performance Configuration**:
```
CACHE_ENABLED=true
CACHE_TYPE=redis
COMPRESSION_ENABLED=true
COMPRESSION_ALGORITHMS=gzip,brotli
DB_POOL_MIN=2
DB_POOL_MAX=10
PERFORMANCE_MONITORING_ENABLED=true
```

**Security Configuration**:
```
FORCE_HTTPS=true
SECURITY_HEADERS_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000
```

**Feature Flags** (all default to true):
```
FEATURE_BACKGROUNDJOBS=true
FEATURE_HEALTHCHECKS=true
FEATURE_MONITORING=true
```

### 3. Database Integration (Neon PostgreSQL)

**Connection Strategy**:
- Use Neon's serverless PostgreSQL with connection pooling
- Connection string format: `postgresql://user:password@host/database?sslmode=require`
- SSL mode: Required for production security

**Connection Pool Configuration**:
```javascript
{
  min: 2,                    // Minimum connections
  max: 10,                   // Maximum connections (adjust based on instance)
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout for new connections
  maxRetries: 3              // Retry failed connections
}
```

**Schema Management**:
- Migrations: Run `npm run db:push` before deployment or as part of build
- Schema defined in `shared/schema.ts` using Drizzle ORM
- Automatic index creation based on DB_AUTO_CREATE_INDEXES flag

**Health Check Integration**:
- Health endpoint verifies database connectivity
- Query: `SELECT 1` with 5-second timeout
- Failure triggers service restart by Render

### 4. Redis Integration

**Connection Strategy**:
- Optional external Redis service (Render Redis or external provider)
- Graceful fallback to memory cache if unavailable
- Used for: session storage, caching, BullMQ job queues, Socket.io adapter

**Configuration**:
```javascript
{
  url: process.env.REDIS_URL,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 50, 2000)
}
```

**Fallback Behavior**:
- Cache: Falls back to memory cache (memorystore)
- Sessions: Falls back to PostgreSQL-backed sessions (connect-pg-simple)
- BullMQ: Jobs disabled if Redis unavailable
- Socket.io: Single-instance mode without Redis adapter

**Health Check Integration**:
- Health endpoint checks Redis connectivity
- Non-blocking check (doesn't fail health if Redis down)
- Reports degraded status in health response

### 5. Static Asset Serving

**Asset Strategy**:
- Built assets in `dist/public/` directory
- Served by Express with cache headers
- Compression enabled (gzip/brotli)

**Cache Headers**:
```javascript
{
  'Cache-Control': 'public, max-age=31536000, immutable', // JS/CSS with hashes
  'Cache-Control': 'public, max-age=3600',                // HTML files
}
```

**Compression Configuration**:
- Threshold: 1KB minimum file size
- Algorithms: Brotli (preferred), Gzip (fallback)
- Level: 6 (balance between speed and compression)
- Excluded: Images, videos, audio (already compressed)

### 6. WebSocket Support

**Socket.io Configuration**:
- Path: `/socket.io`
- Transport: WebSocket with polling fallback
- CORS: Configured for production domain

**Single Instance Mode**:
```javascript
const io = new Server(server, {
  cors: { origin: process.env.APP_URL || '*' },
  transports: ['websocket', 'polling']
});
```

**Multi-Instance Mode** (with Redis):
```javascript
const io = new Server(server, {
  adapter: createAdapter(redisClient, redisClient.duplicate()),
  cors: { origin: process.env.APP_URL || '*' }
});
```

**Connection Handling**:
- Graceful shutdown: Close connections before process exit
- Reconnection: Client auto-reconnects with exponential backoff
- Authentication: Verify session before accepting connection

### 7. Background Job Processing

**BullMQ Configuration**:
- Queue: `reporadar-jobs`
- Worker: Runs in same process as web server
- Concurrency: 5 concurrent jobs
- Retry Strategy: 3 attempts with exponential backoff

**Job Types**:
- Repository batch analysis
- PDF/CSV export generation
- Email notifications
- Analytics aggregation

**Graceful Shutdown**:
```javascript
worker.on('closing', async () => {
  await worker.close(); // Wait for active jobs to complete
});
```

### 8. Health Check System

**Endpoint**: `GET /health`

**Response Format**:
```json
{
  "status": "healthy" | "degraded" | "unhealthy",
  "timestamp": "2025-01-15T10:30:00Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "healthy", "latency": 15 },
    "redis": { "status": "healthy", "latency": 5 },
    "memory": { "status": "healthy", "usage": 45.2 },
    "cpu": { "status": "healthy", "usage": 23.5 }
  }
}
```

**Health Status Logic**:
- **Healthy**: All critical services operational
- **Degraded**: Redis unavailable but core functionality works
- **Unhealthy**: Database unavailable or critical error

**Render Integration**:
- Health check path: `/health`
- Expected status: 200 for healthy/degraded, 503 for unhealthy
- Check interval: 30 seconds
- Failure threshold: 3 consecutive failures trigger restart

## Data Models

### Environment Configuration Model

The application uses a centralized configuration model that validates and provides typed access to environment variables:

```typescript
interface DeploymentConfig {
  // Core
  nodeEnv: 'development' | 'staging' | 'production';
  port: number;
  appUrl: string;
  
  // Database
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
      idleTimeout: number;
      connectionTimeout: number;
    };
    ssl: boolean;
  };
  
  // Cache
  cache: {
    enabled: boolean;
    type: 'memory' | 'redis' | 'hybrid';
    redis?: {
      url: string;
      keyPrefix: string;
    };
  };
  
  // External APIs
  apis: {
    gemini: { apiKey: string };
    github?: { token: string };
    stripe?: {
      secretKey: string;
      publishableKey: string;
    };
  };
  
  // Security
  security: {
    sessionSecret: string;
    sessionEncryptionKey: string;
    forceHttps: boolean;
    hstsMaxAge: number;
  };
}
```

### Session Storage Model

**PostgreSQL-backed sessions** (default):
```typescript
{
  tableName: 'sessions',
  pool: pgPool,
  pruneSessionInterval: 60 * 15, // 15 minutes
  ttl: 7 * 24 * 60 * 60          // 7 days
}
```

**Redis-backed sessions** (when Redis available):
```typescript
{
  client: redisClient,
  prefix: 'reporadar:session:',
  ttl: 7 * 24 * 60 * 60
}
```

## Error Handling

### Deployment Errors

**Build Failures**:
- **Cause**: Missing dependencies, TypeScript errors, build script failures
- **Detection**: Build command exits with non-zero code
- **Response**: Deployment aborted, previous version remains active
- **Resolution**: Check build logs in Render dashboard, fix errors, push again

**Start Failures**:
- **Cause**: Missing environment variables, port binding issues, runtime errors
- **Detection**: Start command fails or health check fails
- **Response**: Deployment marked as failed, automatic rollback
- **Resolution**: Check runtime logs, verify environment variables

**Health Check Failures**:
- **Cause**: Database connection issues, application crashes, timeout
- **Detection**: 3 consecutive health check failures
- **Response**: Service automatically restarted by Render
- **Resolution**: Check logs for root cause, verify external service connectivity

### Runtime Errors

**Database Connection Errors**:
```typescript
try {
  await db.query('SELECT 1');
} catch (error) {
  logger.error('Database connection failed', { error });
  // Retry with exponential backoff
  await retryWithBackoff(connectDatabase, { maxRetries: 3 });
}
```

**Redis Connection Errors**:
```typescript
redisClient.on('error', (error) => {
  logger.warn('Redis connection error, falling back to memory cache', { error });
  useFallbackCache();
});
```

**External API Errors**:
```typescript
async function callGeminiAPI(prompt: string) {
  try {
    return await gemini.generateContent(prompt);
  } catch (error) {
    if (error.status === 429) {
      // Rate limit - retry with backoff
      await sleep(exponentialBackoff(retryCount));
      return callGeminiAPI(prompt);
    }
    throw new APIError('Gemini API failed', { cause: error });
  }
}
```

### Error Monitoring

**Logging Strategy**:
- **Console logs**: Captured by Render's log aggregation
- **Error levels**: ERROR, WARN, INFO, DEBUG
- **Structured logging**: JSON format with context

**Error Tracking**:
- Health endpoint exposes error metrics
- Performance monitoring tracks error rates
- Alerts triggered when error rate exceeds threshold

## Testing Strategy

### Pre-Deployment Testing

**Local Production Build**:
```bash
# Build the application
npm run build

# Test production build locally
NODE_ENV=production npm run start

# Verify health endpoint
curl http://localhost:3000/health
```

**Environment Variable Validation**:
```bash
# Validate configuration
npm run config:validate

# View configuration summary
npm run config:summary
```

**Database Connectivity**:
```bash
# Test database connection with production URL
DATABASE_URL=<neon-url> npm run db:push
```

### Post-Deployment Testing

**Health Check Verification**:
```bash
# Check service health
curl https://your-app.onrender.com/health

# Expected response: 200 OK with health status
```

**Functional Testing**:
- Test user authentication flow
- Test repository analysis
- Test WebSocket connections
- Test background job processing
- Test API endpoints

**Performance Testing**:
```bash
# Run performance benchmarks
npm run test:performance

# Run load tests
npm run test:load
```

**Integration Testing**:
- Verify database operations
- Verify Redis caching (if enabled)
- Verify external API integrations
- Verify session management

### Monitoring and Validation

**Render Dashboard Monitoring**:
- CPU and memory usage
- Request rate and response times
- Error rates
- Build and deploy history

**Application Metrics**:
- Access `/api/performance/dashboard` for internal metrics
- Monitor slow query logs
- Track cache hit rates
- Monitor job queue status

**Log Analysis**:
- Review application logs in Render dashboard
- Filter by error level
- Search for specific error patterns
- Track deployment-related issues

## Deployment Workflow

### Initial Deployment

**Step 1: Prepare Repository**
1. Ensure code is pushed to GitHub/GitLab/Bitbucket
2. Verify `package.json` has correct build and start scripts
3. Ensure `.gitignore` excludes `node_modules`, `.env`, `dist`

**Step 2: Create Neon Database**
1. Sign up for Neon (https://neon.tech)
2. Create a new project
3. Copy the connection string (includes SSL)
4. Note: Neon provides serverless PostgreSQL with automatic scaling

**Step 3: Create Redis Instance (Optional)**
1. Option A: Use Render Redis
   - Create Redis instance in Render dashboard
   - Copy internal connection URL
2. Option B: Use external provider (Upstash, Redis Cloud)
   - Create instance
   - Copy connection URL

**Step 4: Create Web Service on Render**
1. Go to Render Dashboard → New → Web Service
2. Connect your Git repository
3. Configure service:
   - Name: `reporadar` (or your preferred name)
   - Region: Choose based on user location
   - Branch: `main` (or your production branch)
   - Runtime: Node
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
   - Instance Type: Starter or higher

**Step 5: Configure Environment Variables**
1. In Render dashboard, go to Environment tab
2. Add all required variables from `.env.example`
3. Critical variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<neon-connection-string>
   GEMINI_API_KEY=<your-key>
   SESSION_SECRET=<generate-secure-random>
   SESSION_ENCRYPTION_KEY=<generate-64-char-hex>
   ```
4. Optional but recommended:
   ```
   REDIS_URL=<redis-connection-string>
   GITHUB_TOKEN=<your-token>
   STRIPE_SECRET_KEY=<your-key>
   ```

**Step 6: Configure Health Check**
1. In Render dashboard, go to Settings
2. Set Health Check Path: `/health`
3. Set Health Check Interval: 30 seconds

**Step 7: Deploy**
1. Click "Create Web Service"
2. Render will automatically:
   - Clone repository
   - Install dependencies
   - Run build command
   - Start application
   - Run health checks
3. Monitor deployment in Events tab

**Step 8: Verify Deployment**
1. Check health endpoint: `https://your-app.onrender.com/health`
2. Test application functionality
3. Review logs for any errors
4. Monitor performance metrics

### Continuous Deployment

**Automatic Deployments**:
- Enabled by default for connected branch
- Triggered on every push to branch
- Zero-downtime rolling deployment

**Manual Deployments**:
- Trigger from Render dashboard
- Deploy specific commit
- Useful for hotfixes or rollbacks

**Deployment Process**:
1. Render detects new commit
2. Starts new instance with updated code
3. Runs build command
4. Runs start command
5. Waits for health check to pass
6. Routes traffic to new instance
7. Gracefully shuts down old instance

### Rollback Strategy

**Automatic Rollback**:
- Triggered if health checks fail after deployment
- Reverts to previous working version
- No manual intervention required

**Manual Rollback**:
1. Go to Render dashboard → Events
2. Find previous successful deployment
3. Click "Rollback to this version"
4. Confirm rollback

**Rollback Considerations**:
- Database migrations: May need manual reversal
- Environment variables: Ensure compatibility
- External services: Verify API compatibility

## Scaling Strategy

### Vertical Scaling

**Instance Types** (Render):
- **Free**: 512 MB RAM, 0.1 CPU (limited, sleeps after inactivity)
- **Starter**: 512 MB RAM, 0.5 CPU ($7/month)
- **Standard**: 2 GB RAM, 1 CPU ($25/month)
- **Pro**: 4 GB RAM, 2 CPU ($85/month)
- **Pro Plus**: 8 GB RAM, 4 CPU ($175/month)

**Scaling Triggers**:
- High CPU usage (>80% sustained)
- High memory usage (>85%)
- Slow response times (>2s average)
- Increased traffic volume

### Horizontal Scaling

**Requirements for Multi-Instance**:
- Redis required for session sharing
- Redis adapter for Socket.io
- Shared PostgreSQL database
- Stateless application design

**Configuration**:
1. Enable Redis for sessions and Socket.io
2. Set instance count in Render dashboard
3. Render automatically load balances traffic
4. Each instance connects to shared services

**Load Balancing**:
- Handled automatically by Render
- Round-robin distribution
- Sticky sessions for WebSocket connections
- Health-based routing

**Session Management**:
```typescript
// With Redis - supports multiple instances
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));
```

### Auto-Scaling

**Render Auto-Scaling** (Pro plans and above):
- Configure min and max instances
- Scale based on CPU/memory metrics
- Automatic scale-up during traffic spikes
- Automatic scale-down during low traffic

**Configuration**:
```yaml
# In Render dashboard
minInstances: 1
maxInstances: 5
targetCPU: 70%
targetMemory: 80%
```

## Security Configuration

### SSL/TLS

**Automatic HTTPS**:
- Render provides free SSL certificates
- Automatic renewal
- Supports custom domains
- HTTP automatically redirects to HTTPS

**Configuration**:
```typescript
// Force HTTPS in production
if (process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### Security Headers

**Helmet.js Configuration**:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.github.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### CORS Configuration

**Production CORS**:
```typescript
app.use(cors({
  origin: process.env.APP_URL || 'https://your-app.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### Session Security

**Secure Session Configuration**:
```typescript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,           // HTTPS only
    httpOnly: true,         // No JavaScript access
    sameSite: 'strict',     // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
}));
```

### Environment Variable Security

**Best Practices**:
- Never commit `.env` files
- Use Render's environment variable management
- Rotate secrets regularly
- Use different secrets for each environment
- Generate cryptographically secure random values

**Secret Generation**:
```bash
# Generate SESSION_SECRET (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Rate Limiting

**Production Rate Limits**:
```typescript
// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 100,                   // 100 requests per hour (free tier)
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore           // Use Redis for distributed rate limiting
});

// Analysis rate limiting
const analysisLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,  // 24 hours
  max: 10,                         // 10 analyses per day (free tier)
  standardHeaders: true
});
```

## Performance Optimization

### Database Optimization

**Connection Pooling**:
- Min connections: 2
- Max connections: 10 (adjust based on instance size)
- Idle timeout: 30 seconds
- Connection timeout: 5 seconds

**Query Optimization**:
- Indexes on frequently queried columns
- Prepared statements for repeated queries
- Query result caching (Redis)
- Slow query logging (threshold: 1000ms)

**Neon-Specific Optimizations**:
- Use connection pooling (built-in)
- Leverage serverless scaling
- Use read replicas for read-heavy workloads (if available)

### Caching Strategy

**Multi-Layer Cache**:
1. **Memory Cache** (L1): Fast, limited capacity
2. **Redis Cache** (L2): Shared across instances, larger capacity
3. **Database** (L3): Source of truth

**Cache Configuration**:
```typescript
{
  memory: {
    maxSize: 100,        // MB
    maxEntries: 10000,
    ttl: 3600            // 1 hour
  },
  redis: {
    ttl: 3600,           // 1 hour
    compression: true,
    compressionThreshold: 1024  // 1KB
  }
}
```

**Cache Invalidation**:
- Time-based: TTL expiration
- Event-based: Invalidate on data updates
- Manual: Admin endpoint for cache clearing

### Response Compression

**Compression Middleware**:
```typescript
app.use(compression({
  threshold: 1024,              // 1KB minimum
  level: 6,                     // Balance speed/compression
  filter: (req, res) => {
    // Don't compress already compressed content
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
```

**Brotli Support**:
- Enabled for modern browsers
- Better compression than gzip
- Automatic fallback to gzip

### Frontend Optimization

**Code Splitting**:
- Route-based splitting
- Component lazy loading
- Vendor chunk separation

**Asset Optimization**:
- Minification (Vite)
- Tree shaking
- Image optimization
- Font subsetting

**Caching Strategy**:
- Immutable assets: 1 year cache
- HTML: 1 hour cache
- API responses: No cache or short TTL

## Monitoring and Observability

### Health Monitoring

**Health Check Endpoint**:
- Path: `/health`
- Method: GET
- Response time: <500ms
- Checks: Database, Redis, Memory, CPU

**Metrics Exposed**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "latency": 15,
      "connections": { "active": 5, "idle": 3 }
    },
    "redis": {
      "status": "healthy",
      "latency": 5,
      "memory": { "used": "45MB", "peak": "60MB" }
    },
    "memory": {
      "status": "healthy",
      "usage": 45.2,
      "total": "512MB",
      "free": "280MB"
    },
    "cpu": {
      "status": "healthy",
      "usage": 23.5
    }
  }
}
```

### Application Logging

**Log Levels**:
- ERROR: Critical errors requiring attention
- WARN: Warning conditions
- INFO: Informational messages
- DEBUG: Detailed debugging information

**Structured Logging**:
```typescript
logger.info('Request processed', {
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  duration: Date.now() - startTime,
  userId: req.user?.id
});
```

**Log Aggregation**:
- Render captures all console output
- Searchable in Render dashboard
- Filterable by level and time
- Exportable for external analysis

### Performance Monitoring

**Metrics Collection**:
- Request rate and response times
- Database query performance
- Cache hit rates
- Error rates
- Memory and CPU usage

**Performance Dashboard**:
- Endpoint: `/api/performance/dashboard`
- Real-time metrics
- Historical data (7 days)
- Alerting thresholds

**Slow Query Logging**:
```typescript
// Log queries exceeding threshold
if (queryDuration > 1000) {
  logger.warn('Slow query detected', {
    query: sql,
    duration: queryDuration,
    params: params
  });
}
```

### Alerting

**Alert Conditions**:
- Database query time > 1000ms
- API response time > 2000ms
- Error rate > 5%
- Cache hit rate < 80%
- Memory usage > 85%
- CPU usage > 80%

**Alert Channels**:
- Console logs (captured by Render)
- Email notifications (via Resend)
- Webhook integrations (future)

## Troubleshooting Guide

### Common Issues

**Issue: Build Fails**
- **Symptoms**: Deployment fails during build phase
- **Causes**: 
  - TypeScript errors
  - Missing dependencies
  - Build script errors
- **Solutions**:
  - Run `npm run build` locally to reproduce
  - Check build logs in Render dashboard
  - Verify all dependencies in `package.json`
  - Ensure TypeScript compiles without errors

**Issue: Health Check Fails**
- **Symptoms**: Deployment succeeds but service marked unhealthy
- **Causes**:
  - Database connection failure
  - Missing environment variables
  - Application crashes on startup
  - Health endpoint not responding
- **Solutions**:
  - Check runtime logs for errors
  - Verify DATABASE_URL is correct
  - Test database connectivity from local machine
  - Ensure health endpoint returns 200 status

**Issue: Application Crashes**
- **Symptoms**: Service restarts frequently
- **Causes**:
  - Unhandled exceptions
  - Memory leaks
  - Database connection exhaustion
- **Solutions**:
  - Review error logs for stack traces
  - Monitor memory usage trends
  - Check database connection pool settings
  - Add error handling for async operations

**Issue: Slow Performance**
- **Symptoms**: High response times, timeouts
- **Causes**:
  - Database queries not optimized
  - Missing indexes
  - Cache not configured
  - Insufficient instance resources
- **Solutions**:
  - Enable slow query logging
  - Add database indexes
  - Configure Redis caching
  - Upgrade to larger instance type

**Issue: WebSocket Disconnections**
- **Symptoms**: Real-time features not working
- **Causes**:
  - Redis not configured (multi-instance)
  - CORS misconfiguration
  - Load balancer timeout
- **Solutions**:
  - Configure Redis adapter for Socket.io
  - Verify CORS settings
  - Use single instance or configure Redis

**Issue: Session Loss**
- **Symptoms**: Users logged out unexpectedly
- **Causes**:
  - Session store not configured
  - Redis connection issues
  - Cookie settings incorrect
- **Solutions**:
  - Configure PostgreSQL session store
  - Verify Redis connectivity
  - Check cookie secure/sameSite settings

### Debugging Tools

**View Logs**:
```bash
# In Render dashboard
# Go to Logs tab
# Filter by level: ERROR, WARN, INFO
# Search for specific errors
```

**Test Health Endpoint**:
```bash
curl -v https://your-app.onrender.com/health
```

**Test Database Connection**:
```bash
# From local machine
psql $DATABASE_URL -c "SELECT 1"
```

**Test Redis Connection**:
```bash
# From local machine
redis-cli -u $REDIS_URL ping
```

**Monitor Performance**:
```bash
# Access performance dashboard
curl https://your-app.onrender.com/api/performance/dashboard
```

## Migration from Other Platforms

### From Heroku

**Similarities**:
- Git-based deployment
- Environment variable management
- Automatic SSL
- Add-on ecosystem

**Differences**:
- Build command: Explicitly set in Render
- Port: Use PORT environment variable (default 10000)
- Database: Migrate from Heroku Postgres to Neon
- Redis: Migrate from Heroku Redis to Render Redis

**Migration Steps**:
1. Export Heroku database: `heroku pg:backups:capture`
2. Download backup: `heroku pg:backups:download`
3. Import to Neon: Use Neon's import tool
4. Update DATABASE_URL in Render
5. Deploy to Render
6. Test thoroughly
7. Update DNS to point to Render

### From Vercel/Netlify

**Key Differences**:
- Vercel/Netlify: Serverless functions
- Render: Long-running server process

**Migration Considerations**:
- Convert serverless functions to Express routes
- Set up persistent database connection
- Configure session management
- Set up WebSocket server
- Configure background jobs

## Cost Optimization

### Instance Sizing

**Recommendations**:
- **Development**: Free tier (with limitations)
- **Small production**: Starter ($7/month)
- **Medium production**: Standard ($25/month)
- **Large production**: Pro ($85/month)

**Cost Factors**:
- Instance type and count
- Database storage and compute (Neon)
- Redis instance (if used)
- Bandwidth (usually included)

### Optimization Strategies

**Reduce Instance Costs**:
- Start with smaller instance, scale as needed
- Use auto-scaling to handle traffic spikes
- Optimize code to reduce CPU/memory usage

**Reduce Database Costs**:
- Use Neon's serverless pricing (pay for what you use)
- Optimize queries to reduce compute time
- Use connection pooling efficiently
- Archive old data

**Reduce Redis Costs**:
- Use memory cache for frequently accessed data
- Configure appropriate TTLs
- Use Redis only when needed (multi-instance, jobs)

**Bandwidth Optimization**:
- Enable compression
- Optimize asset sizes
- Use CDN for static assets (future enhancement)

## Future Enhancements

### CDN Integration
- Serve static assets from CDN
- Reduce bandwidth costs
- Improve global performance

### Database Read Replicas
- Separate read and write operations
- Improve read performance
- Reduce load on primary database

### Advanced Monitoring
- Integration with external monitoring tools
- Custom dashboards
- Advanced alerting rules

### Blue-Green Deployments
- Zero-downtime deployments
- Easy rollback
- A/B testing capabilities

### Geographic Distribution
- Deploy to multiple regions
- Route users to nearest region
- Improve global latency

