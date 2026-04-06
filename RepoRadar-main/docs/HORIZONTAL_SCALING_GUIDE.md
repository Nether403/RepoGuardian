# Horizontal Scaling Guide

This guide explains how RepoRadar is configured for horizontal scaling and how to deploy multiple instances.

## Overview

RepoRadar supports horizontal scaling by:
- Storing all session data in Redis (no in-memory state)
- Using Redis adapter for WebSocket communication across instances
- Implementing graceful shutdown with connection draining
- Adding instance identification for logging and debugging
- Sharing analytics opt-out preferences across instances

## Architecture

```
                    Load Balancer
                         |
        +----------------+----------------+
        |                |                |
   Instance 1       Instance 2       Instance 3
        |                |                |
        +----------------+----------------+
                         |
                    Redis Cluster
                         |
                    PostgreSQL
```

## Configuration

### Environment Variables

```bash
# Enable Redis for sessions and multi-instance support
USE_REDIS_SESSIONS=true

# Redis connection URL
REDIS_URL=redis://localhost:6379

# Session encryption key (generate with: openssl rand -hex 32)
SESSION_ENCRYPTION_KEY=your-secret-key-here

# Session secret (generate with: openssl rand -hex 32)
SESSION_SECRET=your-session-secret-here

# Optional: Set custom instance ID (useful for container orchestration)
INSTANCE_ID=instance-1

# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/reporadar
```

### Redis Setup

1. **Install Redis** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install redis-server
   
   # macOS
   brew install redis
   
   # Windows
   # Download from https://redis.io/download
   ```

2. **Start Redis**:
   ```bash
   redis-server
   ```

3. **Verify Redis is running**:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

## Deployment

### Single Instance (Development)

```bash
# Set environment variables
export USE_REDIS_SESSIONS=true
export REDIS_URL=redis://localhost:6379

# Start the application
npm run dev
```

### Multiple Instances (Production)

#### Option 1: Docker Compose

```yaml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: reporadar
      POSTGRES_USER: reporadar
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data

  reporadar-1:
    build: .
    environment:
      - USE_REDIS_SESSIONS=true
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://reporadar:${DB_PASSWORD}@postgres:5432/reporadar
      - INSTANCE_ID=instance-1
      - PORT=3000
    depends_on:
      - redis
      - postgres

  reporadar-2:
    build: .
    environment:
      - USE_REDIS_SESSIONS=true
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://reporadar:${DB_PASSWORD}@postgres:5432/reporadar
      - INSTANCE_ID=instance-2
      - PORT=3000
    depends_on:
      - redis
      - postgres

  reporadar-3:
    build: .
    environment:
      - USE_REDIS_SESSIONS=true
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://reporadar:${DB_PASSWORD}@postgres:5432/reporadar
      - INSTANCE_ID=instance-3
      - PORT=3000
    depends_on:
      - redis
      - postgres

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - reporadar-1
      - reporadar-2
      - reporadar-3

volumes:
  redis-data:
  postgres-data:
```

#### Option 2: Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: reporadar
spec:
  replicas: 3
  selector:
    matchLabels:
      app: reporadar
  template:
    metadata:
      labels:
        app: reporadar
    spec:
      containers:
      - name: reporadar
        image: reporadar:latest
        env:
        - name: USE_REDIS_SESSIONS
          value: "true"
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: reporadar-secrets
              key: database-url
        - name: INSTANCE_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: reporadar-service
spec:
  selector:
    app: reporadar
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Load Balancer Configuration

#### Nginx Configuration

```nginx
upstream reporadar {
    least_conn;
    server reporadar-1:3000 max_fails=3 fail_timeout=30s;
    server reporadar-2:3000 max_fails=3 fail_timeout=30s;
    server reporadar-3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://reporadar;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://reporadar;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health checks
    location /health {
        proxy_pass http://reporadar;
        access_log off;
    }
}
```

## Features

### 1. Stateless Application

All session data is stored in Redis, making the application completely stateless:

```typescript
// Sessions are stored in Redis
const store = await createSessionStore();
app.use(session(getSessionConfig(store)));
```

### 2. Instance Identification

Each instance has a unique identifier for logging and debugging:

```typescript
import { instanceId, logger } from './instanceId';

// Get instance metadata
const metadata = instanceId.getMetadata();
console.log(metadata);
// {
//   instanceId: 'hostname-12345-abc123',
//   hostname: 'server-1',
//   pid: 12345,
//   startTime: '2025-10-03T20:00:00.000Z',
//   uptime: 3600
// }

// Use enhanced logger
logger.info('Processing request');
// [2025-10-03T20:00:00.000Z] [INFO] [hostname-12345-abc123] Processing request
```

### 3. Graceful Shutdown

Instances handle shutdown signals gracefully:

```typescript
import { gracefulShutdown } from './gracefulShutdown';

// Initialize graceful shutdown
gracefulShutdown.initialize(server, {
  timeout: 30000, // 30 seconds
  logger: (message) => console.log(message),
});

// On SIGTERM or SIGINT:
// 1. Stop accepting new connections
// 2. Drain existing connections
// 3. Close Redis connection
// 4. Close job queue
// 5. Exit cleanly
```

### 4. WebSocket Multi-Instance Support

WebSockets work across instances using Redis adapter:

```typescript
import { createWebSocketAdapter } from './websocketAdapter';

// Initialize WebSocket with Redis adapter
const adapter = await createWebSocketAdapter();
if (adapter) {
  io.adapter(adapter);
}

// Messages are broadcast across all instances
io.to('user:123').emit('notification', data);
```

### 5. Shared Analytics Opt-Out

Analytics opt-out preferences are shared across instances:

```typescript
// Instance 1: User opts out
await analyticsService.optOut(sessionId);

// Instance 2: Check opt-out status
const hasOptedOut = await analyticsService.hasOptedOut(sessionId);
// Returns: true
```

## Monitoring

### Instance Identification in Logs

All log messages include the instance ID:

```
[2025-10-03T20:00:00.000Z] [INFO] [instance-1] Server listening on port 3000
[2025-10-03T20:00:01.000Z] [INFO] [instance-2] Server listening on port 3000
[2025-10-03T20:00:02.000Z] [INFO] [instance-3] Server listening on port 3000
```

### Health Check Endpoints

Each instance exposes health check endpoints:

- `/health` - Overall health status
- `/health/ready` - Readiness check (for load balancer)
- `/health/live` - Liveness check (for container orchestration)

### Instance Metadata Header

Each response includes the instance ID in the header:

```
X-Instance-Id: hostname-12345-abc123
```

## Testing

### Unit Tests

```bash
# Run horizontal scaling tests
npm test -- server/__tests__/horizontalScaling.test.ts
```

### Integration Tests

```bash
# Run multi-instance integration tests
npm test -- server/__tests__/multiInstance.integration.test.ts
```

### Manual Testing

1. **Start Redis**:
   ```bash
   redis-server
   ```

2. **Start multiple instances**:
   ```bash
   # Terminal 1
   PORT=3001 INSTANCE_ID=instance-1 npm run dev
   
   # Terminal 2
   PORT=3002 INSTANCE_ID=instance-2 npm run dev
   
   # Terminal 3
   PORT=3003 INSTANCE_ID=instance-3 npm run dev
   ```

3. **Test session sharing**:
   - Login on instance 1 (port 3001)
   - Make request to instance 2 (port 3002)
   - Session should be maintained

4. **Test graceful shutdown**:
   - Send SIGTERM to one instance
   - Verify connections are drained
   - Verify other instances continue serving

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis is running
redis-cli ping

# Check Redis logs
tail -f /var/log/redis/redis-server.log

# Test connection from application
node -e "const redis = require('redis'); const client = redis.createClient(); client.connect().then(() => console.log('Connected')).catch(console.error);"
```

### Session Not Shared

1. Verify `USE_REDIS_SESSIONS=true` is set
2. Check Redis URL is correct
3. Verify all instances connect to same Redis
4. Check Redis logs for errors

### WebSocket Issues

1. Verify Redis adapter is initialized
2. Check WebSocket connection in browser console
3. Verify load balancer supports WebSocket upgrade
4. Check for CORS issues

### Instance Not Shutting Down Gracefully

1. Check shutdown timeout is sufficient
2. Verify no long-running operations blocking shutdown
3. Check for unclosed database connections
4. Review shutdown logs for errors

## Best Practices

1. **Always use Redis in production** - Set `USE_REDIS_SESSIONS=true`
2. **Set unique instance IDs** - Use container/pod name in orchestration
3. **Configure health checks** - Use `/health/ready` for load balancer
4. **Monitor instance logs** - Track which instance handles each request
5. **Test graceful shutdown** - Ensure no data loss during deployments
6. **Use connection pooling** - Configure database connection limits per instance
7. **Set appropriate timeouts** - Balance between graceful shutdown and deployment speed
8. **Monitor Redis health** - Track connection status and latency
9. **Use sticky sessions if needed** - Configure load balancer for WebSocket affinity
10. **Scale based on metrics** - Monitor CPU, memory, and request latency

## Performance Considerations

- **Redis latency**: Keep Redis close to application instances (< 1ms)
- **Connection pooling**: Configure appropriate pool sizes for database
- **Session TTL**: Set reasonable session expiration (24 hours default)
- **WebSocket connections**: Monitor connection count per instance
- **Graceful shutdown timeout**: Balance between clean shutdown and deployment speed

## Security

- **Encrypt session data**: Session data is encrypted at rest in Redis
- **Secure Redis**: Use Redis AUTH and TLS in production
- **Rotate secrets**: Regularly rotate SESSION_SECRET and SESSION_ENCRYPTION_KEY
- **Network isolation**: Keep Redis and database in private network
- **Monitor access**: Track which instances access shared resources

## Scaling Guidelines

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Usage | > 70% | Add instance |
| Memory Usage | > 80% | Add instance |
| Response Time | > 500ms | Add instance |
| Redis Latency | > 10ms | Scale Redis or move closer |
| Active Connections | > 1000/instance | Add instance |

## Support

For issues or questions about horizontal scaling:
1. Check logs with instance ID filtering
2. Verify Redis connection health
3. Review health check endpoints
4. Check load balancer configuration
5. Consult this guide for troubleshooting steps
