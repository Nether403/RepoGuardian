# Redis Setup Guide for RepoRadar

## Overview
RepoRadar uses Redis for session storage and background job queuing to support horizontal scaling and improved performance.

## Installation

### Local Development

#### Windows
```powershell
# Using Chocolatey
choco install redis-64

# Or download from: https://github.com/microsoftarchive/redis/releases
```

#### macOS
```bash
# Using Homebrew
brew install redis

# Start Redis
brew services start redis
```

#### Linux (Ubuntu/Debian)
```bash
# Install Redis
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Docker
```bash
# Run Redis in Docker
docker run -d --name redis -p 6379:6379 redis:latest

# With persistence
docker run -d --name redis -p 6379:6379 -v redis-data:/data redis:latest redis-server --appendonly yes
```

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Redis Connection
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_KEY_PREFIX=reporadar:

# Session Configuration
USE_REDIS_SESSIONS=true
SESSION_SECRET=your-secure-secret-minimum-32-characters
SESSION_ENCRYPTION_KEY=your-64-character-hex-encryption-key-here
```

### Generate Secure Keys

```bash
# Generate SESSION_SECRET (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SESSION_ENCRYPTION_KEY (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Usage

### Basic Redis Operations

```typescript
import { redisManager } from './server/redis';

// Get Redis client
const client = await redisManager.getClient();

// Store data with expiration
await client.set('user:123', JSON.stringify(userData), { EX: 3600 });

// Retrieve data
const data = await client.get('user:123');

// Delete data
await client.del('user:123');

// Check health
const health = await redisManager.getHealthStatus();
console.log(`Redis: ${health.status}, ${health.responseTime}ms`);
```

### Session Storage

Sessions are automatically stored in Redis when `USE_REDIS_SESSIONS=true`:

```typescript
// Sessions work transparently
app.get('/api/profile', (req, res) => {
  // Session data is automatically loaded from Redis
  const userId = req.session.userId;
  res.json({ userId });
});
```

## Production Deployment

### Redis Cloud Services

#### AWS ElastiCache
```env
REDIS_URL=redis://your-elasticache-endpoint:6379
```

#### Redis Cloud
```env
REDIS_URL=redis://default:password@your-redis-cloud-endpoint:port
```

#### Azure Cache for Redis
```env
REDIS_URL=rediss://your-azure-redis.redis.cache.windows.net:6380?password=your-password
```

### Security Best Practices

1. **Use TLS/SSL in Production**
   ```env
   REDIS_URL=rediss://your-redis-host:6380
   ```

2. **Enable Redis AUTH**
   ```env
   REDIS_URL=redis://:your-password@your-redis-host:6379
   ```

3. **Use Strong Passwords**
   - Minimum 32 characters
   - Mix of letters, numbers, symbols
   - Rotate regularly

4. **Network Security**
   - Use VPC/private networks
   - Restrict access by IP
   - Enable firewall rules

5. **Encryption**
   - Session data is encrypted at rest (AES-256-GCM)
   - Use TLS for data in transit

### High Availability

#### Redis Sentinel
```env
REDIS_URL=redis-sentinel://sentinel1:26379,sentinel2:26379,sentinel3:26379/mymaster
```

#### Redis Cluster
```env
REDIS_URL=redis://node1:6379,node2:6379,node3:6379
```

### Monitoring

#### Health Checks
```bash
# Check Redis health
curl http://localhost:3000/health

# Response includes Redis status
{
  "status": "healthy",
  "checks": {
    "cache": {
      "status": "up",
      "responseTime": 5
    }
  }
}
```

#### Redis CLI
```bash
# Connect to Redis
redis-cli

# Check connection
PING
# Response: PONG

# Monitor commands
MONITOR

# Get info
INFO

# Check memory usage
INFO memory
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Redis
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions**:
1. Check if Redis is running: `redis-cli ping`
2. Verify REDIS_URL in .env
3. Check firewall settings
4. Ensure Redis is listening on correct port

### Memory Issues

**Problem**: Redis running out of memory

**Solutions**:
1. Configure maxmemory policy:
   ```bash
   redis-cli CONFIG SET maxmemory 256mb
   redis-cli CONFIG SET maxmemory-policy allkeys-lru
   ```

2. Monitor memory usage:
   ```bash
   redis-cli INFO memory
   ```

3. Clear old data:
   ```bash
   redis-cli FLUSHDB  # Clear current database
   redis-cli FLUSHALL # Clear all databases
   ```

### Performance Issues

**Problem**: Slow Redis responses

**Solutions**:
1. Check latency:
   ```bash
   redis-cli --latency
   ```

2. Monitor slow queries:
   ```bash
   redis-cli SLOWLOG GET 10
   ```

3. Optimize configuration:
   ```bash
   # Disable persistence for better performance (if acceptable)
   redis-cli CONFIG SET save ""
   ```

### Session Issues

**Problem**: Sessions not persisting across restarts

**Solution**: Enable Redis persistence
```bash
# Enable AOF (Append Only File)
redis-cli CONFIG SET appendonly yes

# Or enable RDB snapshots
redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

## Testing

### Run Redis Tests
```bash
# All Redis tests
npm test -- server/__tests__/redis.test.ts --run

# Session store tests
npm test -- server/__tests__/sessionStore.test.ts --run
```

### Manual Testing
```bash
# Start Redis
redis-server

# In another terminal, start the app
npm run dev

# Test session storage
curl -c cookies.txt http://localhost:3000/api/login
curl -b cookies.txt http://localhost:3000/api/profile
```

## Performance Tuning

### Connection Pooling
```typescript
// Adjust connection pool size
const client = createClient({
  socket: {
    connectTimeout: 5000,
    keepAlive: 5000,
  },
});
```

### Caching Strategy
```typescript
// Set appropriate TTLs
await client.set('key', 'value', { EX: 3600 }); // 1 hour

// Use pipelining for multiple operations
const pipeline = client.multi();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
await pipeline.exec();
```

### Memory Optimization
```bash
# Configure memory limits
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Enable compression (in application)
# Session data is automatically compressed
```

## Backup and Recovery

### Backup
```bash
# Manual backup
redis-cli BGSAVE

# Backup file location
/var/lib/redis/dump.rdb
```

### Restore
```bash
# Stop Redis
sudo systemctl stop redis-server

# Copy backup file
sudo cp backup.rdb /var/lib/redis/dump.rdb

# Start Redis
sudo systemctl start redis-server
```

## Migration

### From Memory Store to Redis

1. Update environment variables:
   ```env
   USE_REDIS_SESSIONS=true
   REDIS_URL=redis://localhost:6379
   ```

2. Restart application:
   ```bash
   npm run dev
   ```

3. Existing sessions will be lost (users need to re-login)

### From PostgreSQL Sessions to Redis

1. Sessions are automatically migrated on first access
2. Old PostgreSQL sessions remain until expiry
3. New sessions use Redis

## Resources

- [Redis Documentation](https://redis.io/documentation)
- [Redis Best Practices](https://redis.io/topics/best-practices)
- [Redis Security](https://redis.io/topics/security)
- [connect-redis Documentation](https://github.com/tj/connect-redis)

## Support

For issues or questions:
1. Check logs: `redis-cli MONITOR`
2. Review health checks: `curl http://localhost:3000/health`
3. Check Redis status: `redis-cli INFO`
4. Review application logs for Redis errors
