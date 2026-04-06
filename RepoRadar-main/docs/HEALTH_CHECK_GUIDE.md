# Health Check Endpoints Guide

## Overview

RepoRadar provides three health check endpoints for monitoring system health, readiness, and liveness. These endpoints are designed to be compatible with Kubernetes probes and other monitoring systems.

## Endpoints

### 1. `/health` - Overall Health Status

**Purpose**: Comprehensive health check of all system components

**Method**: `GET`

**Response Codes**:
- `200`: System is healthy or degraded
- `503`: System is unhealthy

**Response Format**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-03T21:50:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 45
    },
    "cache": {
      "status": "up",
      "responseTime": 30
    },
    "api": {
      "status": "up",
      "responseTime": 5,
      "details": {
        "gemini": "enabled",
        "stripe": "disabled"
      }
    },
    "queue": {
      "status": "up",
      "responseTime": 20,
      "details": {
        "waiting": 5,
        "active": 2,
        "completed": 100,
        "failed": 1,
        "delayed": 0
      }
    }
  },
  "uptime": 12345.67
}
```

**Status Values**:
- `healthy`: All systems operational
- `degraded`: Some systems slow or non-critical issues
- `unhealthy`: Critical systems down

**Example Usage**:
```bash
curl http://localhost:5000/health
```

---

### 2. `/health/ready` - Readiness Check

**Purpose**: Verify application is ready to accept traffic

**Method**: `GET`

**Response Codes**:
- `200`: Application is ready
- `503`: Application is not ready

**Response Format**:
```json
{
  "status": "ready",
  "timestamp": "2025-10-03T21:50:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 45
    },
    "cache": {
      "status": "up",
      "responseTime": 30
    }
  }
}
```

**Status Values**:
- `ready`: Essential services are available
- `not ready`: Essential services are unavailable

**Example Usage**:
```bash
curl http://localhost:5000/health/ready
```

**Use Cases**:
- Load balancer health checks
- Kubernetes readiness probes
- Deployment verification

---

### 3. `/health/live` - Liveness Check

**Purpose**: Confirm application process is responsive

**Method**: `GET`

**Response Codes**:
- `200`: Application is alive (always)

**Response Format**:
```json
{
  "status": "alive",
  "timestamp": "2025-10-03T21:50:00.000Z",
  "uptime": 12345.67,
  "memoryUsage": {
    "heapUsed": 45,
    "heapTotal": 128,
    "external": 10,
    "rss": 256
  }
}
```

**Example Usage**:
```bash
curl http://localhost:5000/health/live
```

**Use Cases**:
- Kubernetes liveness probes
- Process monitoring
- Restart triggers

---

## Health Check Components

### Database Check
- Executes `SELECT 1` query
- **Up**: Response time < 100ms
- **Degraded**: Response time >= 100ms
- **Down**: Connection failed

### Cache Check (Redis)
- Performs PING command
- **Up**: Response time < 100ms
- **Degraded**: Response time >= 100ms
- **Down**: Connection failed

### API Check
- Verifies critical API dependencies
- **Up**: Gemini AI enabled
- **Degraded**: Gemini AI disabled
- **Down**: Critical failure

### Queue Check
- Monitors job queue statistics
- **Up**: Normal operation
- **Degraded**: High queue depth (>1000) or failure rate (>10%)
- **Down**: Queue unavailable

---

## Kubernetes Integration

### Liveness Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 5000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 2
  failureThreshold: 3
```

### Readiness Probe Configuration

```yaml
readinessProbe:
  httpGet:
    path: /health/ready
    port: 5000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 3
```

### Complete Deployment Example

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
        ports:
        - containerPort: 5000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 2
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 2
          failureThreshold: 3
```

---

## Load Balancer Integration

### Nginx Configuration

```nginx
upstream reporadar {
    server app1:5000 max_fails=3 fail_timeout=30s;
    server app2:5000 max_fails=3 fail_timeout=30s;
    server app3:5000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    
    location /health/ready {
        proxy_pass http://reporadar;
        proxy_connect_timeout 2s;
        proxy_read_timeout 2s;
    }
    
    location / {
        proxy_pass http://reporadar;
        # Only route to healthy backends
        proxy_next_upstream error timeout http_503;
    }
}
```

### HAProxy Configuration

```haproxy
backend reporadar
    balance roundrobin
    option httpchk GET /health/ready
    http-check expect status 200
    server app1 app1:5000 check inter 5s fall 3 rise 2
    server app2 app2:5000 check inter 5s fall 3 rise 2
    server app3 app3:5000 check inter 5s fall 3 rise 2
```

---

## Monitoring Integration

### Prometheus

```yaml
scrape_configs:
  - job_name: 'reporadar-health'
    metrics_path: '/health'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:5000']
```

### Datadog

```yaml
init_config:

instances:
  - url: http://localhost:5000/health
    name: reporadar
    timeout: 2
    http_response_status_code: 200
```

### Nagios

```bash
define service {
    use                     generic-service
    host_name               reporadar
    service_description     Health Check
    check_command           check_http!-H localhost -p 5000 -u /health/ready -s "ready"
    check_interval          5
}
```

---

## Monitoring Scripts

### Bash Health Monitor

```bash
#!/bin/bash

ENDPOINT="http://localhost:5000/health"
INTERVAL=5

while true; do
    RESPONSE=$(curl -s -w "\n%{http_code}" "$ENDPOINT")
    STATUS_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$STATUS_CODE" -eq 200 ]; then
        STATUS=$(echo "$BODY" | jq -r '.status')
        echo "[$(date)] Health: $STATUS"
    else
        echo "[$(date)] Health check failed: HTTP $STATUS_CODE"
    fi
    
    sleep $INTERVAL
done
```

### Python Health Monitor

```python
import requests
import time
import json

def check_health():
    try:
        response = requests.get('http://localhost:5000/health', timeout=2)
        data = response.json()
        
        print(f"Status: {data['status']}")
        print(f"Database: {data['checks']['database']['status']}")
        print(f"Cache: {data['checks']['cache']['status']}")
        print(f"Queue: {data['checks']['queue']['status']}")
        print(f"Uptime: {data['uptime']:.2f}s")
        print("-" * 40)
        
        return response.status_code == 200
    except Exception as e:
        print(f"Health check failed: {e}")
        return False

if __name__ == '__main__':
    while True:
        check_health()
        time.sleep(5)
```

---

## Troubleshooting

### Health Check Returns Unhealthy

1. **Check Database**:
   ```bash
   curl http://localhost:5000/health | jq '.checks.database'
   ```

2. **Check Redis**:
   ```bash
   curl http://localhost:5000/health | jq '.checks.cache'
   ```

3. **Check Job Queue**:
   ```bash
   curl http://localhost:5000/health | jq '.checks.queue'
   ```

### Readiness Check Fails

1. **Verify Database Connection**:
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```

2. **Verify Redis Connection**:
   ```bash
   redis-cli -u $REDIS_URL ping
   ```

### High Response Times

If health checks are slow:

1. **Check Database Performance**:
   - Review connection pool settings
   - Check for long-running queries
   - Monitor database load

2. **Check Redis Performance**:
   - Review Redis memory usage
   - Check for slow commands
   - Monitor Redis latency

3. **Check Network**:
   - Verify network connectivity
   - Check for DNS issues
   - Monitor network latency

---

## Performance Characteristics

- **Health Check**: ~10-20ms average
- **Readiness Check**: ~5-10ms average
- **Liveness Check**: <5ms average
- **Timeout**: 2 seconds maximum
- **Concurrent Requests**: Supports 10+ simultaneous checks

---

## Best Practices

1. **Use Appropriate Endpoints**:
   - Use `/health/live` for liveness probes
   - Use `/health/ready` for readiness probes
   - Use `/health` for monitoring dashboards

2. **Set Reasonable Intervals**:
   - Liveness: 10-30 seconds
   - Readiness: 5-10 seconds
   - Monitoring: 30-60 seconds

3. **Configure Failure Thresholds**:
   - Allow 2-3 failures before taking action
   - Avoid flapping by using appropriate thresholds

4. **Monitor Trends**:
   - Track response times over time
   - Alert on degraded status
   - Monitor queue depth and failure rates

5. **Test Health Checks**:
   - Verify health checks during deployment
   - Test failure scenarios
   - Validate timeout behavior

---

## Security Considerations

- Health check endpoints are public (no authentication required)
- Endpoints don't expose sensitive information
- Error messages are user-friendly, not revealing internal details
- Consider rate limiting for public deployments

---

## Support

For issues or questions about health check endpoints:
1. Check the logs for detailed error messages
2. Review the troubleshooting section
3. Verify all dependencies are running
4. Contact the development team

---

## Version History

- **v1.0.0** (2025-10-03): Initial implementation
  - Added `/health`, `/health/ready`, `/health/live` endpoints
  - Kubernetes compatibility
  - 2-second timeout guarantee
  - Comprehensive component checks
