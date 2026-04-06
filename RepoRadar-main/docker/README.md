# Docker Deployment Configurations

This directory contains Docker configurations for deploying RepoRadar in different modes.

## Available Configurations

### 1. Performance Deployment (Single Instance)
**File**: `docker-compose.performance.yml`

Single instance deployment optimized for performance with monitoring capabilities.

**Features**:
- Single application instance
- PostgreSQL database
- Redis for caching and sessions
- Optional Grafana for monitoring
- Performance optimizations enabled

**Usage**:
```bash
docker-compose -f docker/docker-compose.performance.yml up -d
```

### 2. Multi-Instance Deployment (Horizontal Scaling)
**File**: `docker-compose.multi-instance.yml`

Production-ready deployment with multiple instances behind a load balancer.

**Features**:
- 3 application instances (configurable)
- Nginx load balancer with health checks
- Redis for shared session storage
- PostgreSQL with connection pooling
- Optional Redis replication for HA
- Automatic failover support

**Usage**:
```bash
# Standard deployment
npm run deploy:multi

# High availability mode
npm run deploy:multi:ha

# Windows
npm run deploy:multi:windows
```

**See**: [Multi-Instance Deployment Guide](../docs/MULTI_INSTANCE_DEPLOYMENT.md)

## Directory Structure

```
docker/
├── docker-compose.performance.yml      # Single instance configuration
├── docker-compose.multi-instance.yml   # Multi-instance configuration
├── Dockerfile.performance              # Optimized production Dockerfile
├── .env.multi-instance.example         # Environment template for multi-instance
├── nginx/                              # Nginx load balancer configuration
│   ├── nginx.conf                      # Main Nginx configuration
│   └── conf.d/
│       └── sticky-sessions.conf.example # Optional sticky sessions config
├── redis/                              # Redis configuration
│   └── sentinel.conf                   # Redis Sentinel for HA
└── postgres/                           # PostgreSQL configuration
    └── postgresql.conf                 # PostgreSQL tuning
```

## Configuration Files

### Environment Files

- `.env.multi-instance.example`: Template for multi-instance deployment
  - Copy to `.env.multi-instance` and configure
  - Set secure passwords and secrets
  - Configure GitHub token

### Nginx Configuration

- `nginx/nginx.conf`: Main load balancer configuration
  - Load balancing strategy: least connections
  - Health check integration
  - WebSocket support
  - Gzip compression

- `nginx/conf.d/sticky-sessions.conf.example`: Optional sticky sessions
  - Use if Redis sessions are not available
  - IP-based session affinity

### Redis Configuration

- `redis/sentinel.conf`: Redis Sentinel for automatic failover
  - Monitors Redis master
  - Automatic promotion of replicas
  - Used in HA mode only

## Quick Start

### Single Instance

```bash
# Copy environment file
cp .env.example .env

# Configure environment
# Edit .env and set required variables

# Deploy
docker-compose -f docker/docker-compose.performance.yml up -d
```

### Multi-Instance

```bash
# Copy environment file
cp docker/.env.multi-instance.example docker/.env.multi-instance

# Configure environment
# Edit docker/.env.multi-instance and set:
# - POSTGRES_PASSWORD
# - SESSION_SECRET
# - SESSION_ENCRYPTION_KEY
# - GITHUB_TOKEN

# Deploy
npm run deploy:multi

# Or manually
docker-compose -f docker/docker-compose.multi-instance.yml \
  --env-file docker/.env.multi-instance up -d
```

## Verification

### Check Services

```bash
# List running services
docker-compose -f docker/docker-compose.multi-instance.yml ps

# View logs
docker-compose -f docker/docker-compose.multi-instance.yml logs -f

# Check health
curl http://localhost/health
```

### Run Verification Script

```bash
npm run verify:multi
```

This script tests:
- Instance health checks
- Load distribution
- Session persistence
- Health endpoints

## Scaling

### Horizontal Scaling

Add more instances:

```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  up -d --scale reporadar-1=5
```

**Note**: Update `nginx/nginx.conf` to include new instances in the upstream block.

### Vertical Scaling

Edit resource limits in `docker-compose.multi-instance.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 4G
      cpus: '2.0'
```

## Monitoring

### Health Endpoints

- Load Balancer: `http://localhost/health`
- Backend: `http://localhost/health/backend`
- Readiness: `http://localhost/health/ready`
- Liveness: `http://localhost/health/live`

### Logs

```bash
# All services
docker-compose -f docker/docker-compose.multi-instance.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.multi-instance.yml logs -f nginx
docker-compose -f docker/docker-compose.multi-instance.yml logs -f reporadar-1
```

### Metrics

```bash
# Nginx status
curl http://localhost/nginx_status

# Redis info
docker-compose -f docker/docker-compose.multi-instance.yml \
  exec redis-master redis-cli info
```

## Troubleshooting

### Services Not Starting

1. Check logs:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml logs
```

2. Verify environment variables:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml config
```

3. Check port conflicts:
```bash
netstat -an | grep -E ':(80|443|5432|6379)'
```

### Health Checks Failing

1. Test instance directly:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  exec reporadar-1 curl http://localhost:3000/health
```

2. Check database connection:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  exec postgres psql -U reporadar -c "SELECT 1"
```

3. Check Redis connection:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  exec redis-master redis-cli ping
```

### Reset Deployment

**WARNING**: This deletes all data!

```bash
docker-compose -f docker/docker-compose.multi-instance.yml down -v
docker-compose -f docker/docker-compose.multi-instance.yml up -d
```

## Production Checklist

Before deploying to production:

- [ ] Set strong passwords and secrets
- [ ] Configure SSL/TLS certificates
- [ ] Enable Redis replication (HA mode)
- [ ] Set up automated backups
- [ ] Configure monitoring and alerting
- [ ] Test failover scenarios
- [ ] Document disaster recovery
- [ ] Set up log aggregation
- [ ] Configure firewall rules
- [ ] Enable rate limiting

## Additional Resources

- [Multi-Instance Deployment Guide](../docs/MULTI_INSTANCE_DEPLOYMENT.md)
- [Horizontal Scaling Guide](../docs/HORIZONTAL_SCALING_GUIDE.md)
- [Health Check Guide](../docs/HEALTH_CHECK_GUIDE.md)
- [Redis Setup Guide](../docs/REDIS_SETUP.md)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs for error messages
3. Consult the documentation guides
4. Open an issue on GitHub
