# Graceful Shutdown Guide

## Overview

RepoRadar implements comprehensive graceful shutdown handling to ensure clean termination of all services and connections when the server receives shutdown signals or encounters critical errors. This prevents data loss, ensures resource cleanup, and provides a better experience for connected clients.

## Table of Contents

- [How It Works](#how-it-works)
- [Shutdown Sequence](#shutdown-sequence)
- [Configuration](#configuration)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## How It Works

### Signal Handling

The graceful shutdown handler listens for the following signals:

1. **SIGTERM** - Standard termination signal
   - Sent by Render, Docker, Kubernetes, and other platforms
   - Indicates the process should terminate gracefully

2. **SIGINT** - Interrupt signal
   - Triggered by Ctrl+C in terminal
   - Used for manual shutdown during development

3. **uncaughtException** - Unhandled exceptions
   - Catches critical errors that would crash the application
   - Triggers graceful shutdown before exit

4. **unhandledRejection** - Unhandled promise rejections
   - Catches unhandled async errors
   - Triggers graceful shutdown before exit

### Connection Tracking

The handler tracks all active HTTP connections:

```typescript
server.on('connection', (connection) => {
  // Add to active connections set
  activeConnections.add(connection);
  
  // Remove when connection closes
  connection.on('close', () => {
    activeConnections.delete(connection);
  });
});
```

This allows the handler to:
- Know how many connections are active
- Wait for connections to close naturally
- Force close remaining connections if needed

## Shutdown Sequence

The graceful shutdown follows a specific order to ensure data integrity:

### 1. WebSocket Connections (First)

**Why First**: Notify clients immediately so they can reconnect to other instances

```typescript
// Notify all connected clients
wss.clients.forEach((ws) => {
  ws.send(JSON.stringify({
    type: 'server_shutdown',
    message: 'Server is shutting down for maintenance',
    timestamp: new Date().toISOString()
  }));
  ws.close(1001, 'Server shutting down');
});
```

**Actions**:
- Send shutdown notification to all connected clients
- Close WebSocket connections gracefully
- Close WebSocket server

### 2. Job Queue (Second)

**Why Second**: Prevent new jobs and complete active ones before other services close

```typescript
await jobQueue.close();
```

**Actions**:
- Stop accepting new jobs
- Wait for active BullMQ jobs to complete
- Close worker connections
- Ensures no data loss from in-progress background tasks

### 3. HTTP Connections (Third)

**Why Third**: Allow time for in-flight requests to complete

```typescript
// Stop accepting new connections
server.close();

// Wait for active connections to close (10 seconds)
while (activeConnections.size > 0 && !timeout) {
  await sleep(100);
}

// Force close remaining connections
activeConnections.forEach(conn => conn.destroy());
```

**Actions**:
- Stop accepting new HTTP connections
- Wait up to 10 seconds for active connections to close
- Force close remaining connections if timeout exceeded

### 4. Cache Service (Fourth)

**Why Fourth**: Can be closed once no more requests are being processed

```typescript
await cacheService.shutdown();
```

**Actions**:
- Stop cleanup intervals
- Clear memory cache
- Disconnect from cache services

### 5. Database Connections (Fifth)

**Why Fifth**: Close after all operations that might need database access

```typescript
await closePool();
```

**Actions**:
- Close all database connections in the pool
- Wait for active queries to complete
- Release all database resources

### 6. Redis Connection (Last)

**Why Last**: Other services may depend on Redis during their shutdown

```typescript
await redisManager.disconnect();
```

**Actions**:
- Disconnect from Redis (if enabled)
- Close Redis client connections
- Use `quit()` for clean shutdown, fallback to `disconnect()`

## Configuration

### Basic Configuration

In `server/index.ts`:

```typescript
gracefulShutdown.initialize(server, {
  timeout: 30000, // 30 seconds
  logger: (message: string) => logger.info(message),
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | number | 30000 | Maximum time (ms) to wait for graceful shutdown |
| `logger` | function | console.log | Custom logger function for shutdown messages |

### Timeout Behavior

If graceful shutdown doesn't complete within the timeout:

1. Log timeout message
2. Force close all remaining connections
3. Exit with error code 1

**Recommended Timeouts**:
- Development: 10-15 seconds
- Production: 30 seconds (matches Render's grace period)
- High-traffic: 45-60 seconds (if you have long-running operations)

## Testing

### Automated Test

Run the automated test script:

```bash
node scripts/test-graceful-shutdown.js
```

This script:
1. Starts the server
2. Waits for it to be ready
3. Sends SIGTERM signal
4. Verifies shutdown sequence
5. Reports success or failure

### Manual Testing

#### Test SIGTERM (Production-like)

```bash
# Start the server
npm run dev

# In another terminal, find the process ID
ps aux | grep node

# Send SIGTERM
kill -TERM <pid>

# Or on Windows
taskkill /PID <pid>
```

#### Test SIGINT (Ctrl+C)

```bash
# Start the server
npm run dev

# Press Ctrl+C
# Watch the shutdown sequence in logs
```

#### Test with Active Connections

```bash
# Start the server
npm run dev

# In another terminal, make a long-running request
curl http://localhost:5000/api/repositories/search?q=test

# While request is running, send shutdown signal
# Verify request completes before shutdown
```

### Expected Log Output

```
Received SIGTERM, starting graceful shutdown...
Closing WebSocket connections...
Closing 3 active WebSocket connections...
WebSocket server closed
WebSocket connections closed
Closing job queue...
Job queue closed (active jobs completed)
Draining 5 active connections...
Connection draining complete
Shutting down cache service...
Cache service shutdown complete
Closing database connections...
Database connections closed
Closing Redis connection...
Redis connection closed
HTTP server closed
Graceful shutdown complete
```

## Production Deployment

### Render Platform

Render automatically sends SIGTERM before stopping instances:

1. **Deployment Process**:
   - New instance starts
   - Health checks pass
   - Traffic routes to new instance
   - SIGTERM sent to old instance
   - 30-second grace period
   - Old instance terminates

2. **Configuration**:
   - Set timeout to 30 seconds (matches Render's grace period)
   - Ensure health checks stop passing during shutdown
   - Monitor shutdown logs in Render dashboard

### Docker

In your Dockerfile:

```dockerfile
# Use SIGTERM for graceful shutdown
STOPSIGNAL SIGTERM

# Allow time for graceful shutdown
# docker stop will wait this long before SIGKILL
```

Docker stop command:

```bash
# Stop with 30-second grace period
docker stop --time 30 <container>
```

### Kubernetes

In your deployment YAML:

```yaml
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 30
      containers:
      - name: reporadar
        # ... other config
```

Kubernetes will:
1. Send SIGTERM to container
2. Wait up to 30 seconds
3. Send SIGKILL if still running

### Load Balancer Considerations

When using a load balancer:

1. **Health Check Behavior**:
   - Health checks should fail during shutdown
   - Prevents new requests from being routed
   - Existing connections complete gracefully

2. **Connection Draining**:
   - Load balancer stops sending new requests
   - Existing requests complete
   - Server shuts down after connections drain

3. **Zero-Downtime Deployments**:
   - New instances start and pass health checks
   - Traffic shifts to new instances
   - Old instances shut down gracefully
   - No dropped requests

## Troubleshooting

### Shutdown Takes Too Long

**Symptoms**: Shutdown exceeds timeout, forced termination

**Possible Causes**:
- Long-running background jobs
- Slow database queries
- Stuck connections
- Redis connection issues

**Solutions**:
1. Increase timeout if operations legitimately take longer
2. Optimize long-running operations
3. Add timeouts to database queries
4. Check for connection leaks

**Debug**:
```typescript
// Add detailed logging
gracefulShutdown.initialize(server, {
  timeout: 30000,
  logger: (message) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
  },
});
```

### Jobs Not Completing

**Symptoms**: Jobs interrupted during shutdown

**Possible Causes**:
- Jobs taking longer than shutdown timeout
- Job queue not closing properly
- Redis connection issues

**Solutions**:
1. Increase shutdown timeout
2. Implement job checkpointing
3. Mark jobs as failed and retry later
4. Reduce job processing time

**Check Job Status**:
```bash
# View active jobs before shutdown
curl http://localhost:5000/api/admin/jobs/stats
```

### Database Connections Not Closing

**Symptoms**: Database pool doesn't close cleanly

**Possible Causes**:
- Active transactions
- Long-running queries
- Connection leaks

**Solutions**:
1. Add query timeouts
2. Ensure transactions are committed/rolled back
3. Check for connection leaks
4. Monitor connection pool stats

**Debug**:
```typescript
// In server/db.ts
pool.on('error', (err) => {
  console.error('Pool error:', err);
});

pool.on('connect', () => {
  console.log('New connection:', pool.totalCount);
});

pool.on('remove', () => {
  console.log('Connection removed:', pool.totalCount);
});
```

### WebSocket Clients Not Notified

**Symptoms**: Clients don't receive shutdown notification

**Possible Causes**:
- WebSocket server not attached to HTTP server
- Clients not listening for shutdown event
- Connection already closed

**Solutions**:
1. Verify WebSocket server attachment in routes.ts
2. Implement client-side shutdown handler
3. Add reconnection logic to clients

**Client-Side Handler**:
```javascript
socket.on('server_shutdown', (data) => {
  console.log('Server shutting down:', data.message);
  // Show notification to user
  // Attempt reconnection after delay
  setTimeout(() => socket.connect(), 5000);
});
```

### Forced Shutdown Occurring

**Symptoms**: Shutdown timeout reached, forced termination

**Possible Causes**:
- One or more services not closing
- Deadlock in shutdown sequence
- Infinite loop in cleanup code

**Solutions**:
1. Check logs to see which step is stuck
2. Add timeouts to individual shutdown steps
3. Ensure all async operations have timeouts
4. Test each service's shutdown method independently

**Debug Each Step**:
```typescript
// Add timing to each step
const startTime = Date.now();
await this.closeWebSockets(logger);
logger(`WebSockets closed in ${Date.now() - startTime}ms`);
```

## Best Practices

### 1. Keep Shutdown Fast

- Aim for shutdown under 10 seconds
- Optimize cleanup operations
- Don't perform unnecessary work during shutdown

### 2. Handle Errors Gracefully

- Wrap each shutdown step in try-catch
- Log errors but continue shutdown
- Don't let one failure block others

### 3. Test Regularly

- Test shutdown in development
- Test with active connections
- Test with background jobs running
- Test timeout scenarios

### 4. Monitor in Production

- Log all shutdown events
- Track shutdown duration
- Alert on forced shutdowns
- Monitor for incomplete shutdowns

### 5. Document Dependencies

- Document shutdown order
- Explain why each step is positioned where it is
- Update documentation when adding new services

## Monitoring

### Metrics to Track

1. **Shutdown Duration**
   - Average time to complete shutdown
   - 95th percentile shutdown time
   - Maximum shutdown time

2. **Forced Shutdowns**
   - Count of timeouts
   - Which step caused timeout
   - Frequency of forced shutdowns

3. **Connection Draining**
   - Number of connections at shutdown
   - Time to drain connections
   - Forced connection closures

4. **Job Completion**
   - Jobs completed during shutdown
   - Jobs interrupted
   - Job completion time

### Logging

Add structured logging for analysis:

```typescript
logger.info('Graceful shutdown initiated', {
  signal: 'SIGTERM',
  activeConnections: activeConnections.size,
  activeJobs: jobQueue.getActiveCount(),
  timestamp: new Date().toISOString(),
});
```

### Alerts

Set up alerts for:
- Shutdown duration > 25 seconds (approaching timeout)
- Forced shutdowns (timeout exceeded)
- High frequency of shutdowns (potential issues)
- Jobs interrupted during shutdown

## Related Documentation

- [Health Check Guide](./HEALTH_CHECK_GUIDE.md)
- [Production Deployment Checklist](../PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- [Horizontal Scaling Guide](./HORIZONTAL_SCALING_GUIDE.md)
- [Multi-Instance Deployment](./MULTI_INSTANCE_DEPLOYMENT.md)

## Support

If you encounter issues with graceful shutdown:

1. Check the logs for error messages
2. Review this troubleshooting guide
3. Test shutdown in isolation
4. Monitor resource usage during shutdown
5. Contact support with logs and metrics
