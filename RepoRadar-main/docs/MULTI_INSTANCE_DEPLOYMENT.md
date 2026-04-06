# Multi-Instance Deployment Guide

This guide explains how to deploy RepoRadar with multiple instances behind a load balancer for horizontal scaling and high availability.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Deployment Options](#deployment-options)
- [Load Balancing](#load-balancing)
- [High Availability](#high-availability)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Scaling](#scaling)

## Overview

The multi-instance deployment configuration allows RepoRadar to:

- **Scale horizontally** by running multiple application instances
- **Handle increased load** by distributing requests across instances
- **Provide high availability** with automatic failover
- **Share session state** using Redis
- **Balance load** using Nginx as a reverse proxy

### Key Features

- ✅ 3 application instances by default (configurable)
- ✅ Nginx load balancer with health checks
- ✅ Redis for shared session storage and caching
- ✅ PostgreSQL database with connection pooling
- ✅ Automatic health monitoring and failover
- ✅ Graceful shutdown and connection draining
- ✅ Optional Redis replication for high availability

## Architecture

```
                    ┌─────────────────┐
                    │  Nginx (Port 80)│
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼────────┐
    │ RepoRadar-1  │ │ RepoRadar-2  │ │ RepoRadar-3  │
    │  (Port 3000) │ │  (Port 3000) │ │  (Port 3000) │
    └───────┬──────┘ └──────┬───────┘ └─────┬────────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐ ┌──────▼───────┐        │
    │  PostgreSQL  │ │    Redis     │        │
    │  (Port 5432) │ │  (Port 6379) │        │
    └──────────────┘ └──────────────┘        │
                                              │
                    ┌─────────────────────────▼──┐
                    │  Shared Session Storage    │
                    │  Shared Cache              │
                    │  Job Queue                 │
                    └────────────────────────────┘
```

### Component Responsibilities

- **Nginx**: Load balancing, health checks, SSL termination
- **RepoRadar Instances**: Stateless application servers
- **PostgreSQL**: Persistent data storage
- **Redis**: Session storage, caching, job queue

## Prerequisites

### Required Software

- Docker 20.10 or higher
- Docker Compose 2.0 or higher
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

### Verify Installation

```bash
# Check Docker
docker --version
docker-compose --version

# Check Docker is running
docker info
```

## Quick Start

### 1. Configure Environment

Copy the example environment file and configure it:

```bash
# Linux/Mac
cp docker/.env.multi-instance.example docker/.env.multi-instance

# Windows
copy docker\.env.multi-instance.example docker\.env.multi-instance
```

Edit `docker/.env.multi-instance` and set:

```bash
# Required: Set secure passwords
POSTGRES_PASSWORD=your_secure_password_here
SESSION_SECRET=your_session_secret_min_32_chars_change_in_production
SESSION_ENCRYPTION_KEY=your_64_char_hex_encryption_key_here

# Required: Set GitHub token
GITHUB_TOKEN=your_github_token_here
```

### 2. Deploy

**Linux/Mac:**
```bash
chmod +x scripts/deploy-multi-instance.sh
./scripts/deploy-multi-instance.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-multi-instance.ps1
```

**Manual Deployment:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml --env-file docker/.env.multi-instance up -d
```

### 3. Verify Deployment

Check that all services are running:

```bash
docker-compose -f docker/docker-compose.multi-instance.yml ps
```

Test health endpoints:

```bash
# Load balancer health
curl http://localhost/health

# Backend health
curl http://localhost/health/backend

# Readiness check
curl http://localhost/health/ready

# Liveness check
curl http://localhost/health/live
```

### 4. Access Application

Open your browser and navigate to:
- **Application**: http://localhost
- **Health Dashboard**: http://localhost/health/backend

## Configuration

### Environment Variables

Key configuration options in `.env.multi-instance`:

#### Database Configuration
```bash
DATABASE_URL=postgresql://reporadar:password@postgres:5432/reporadar
DB_POOL_MIN=2          # Minimum connections per instance
DB_POOL_MAX=10         # Maximum connections per instance
```

#### Redis Configuration
```bash
REDIS_URL=redis://redis-master:6379
USE_REDIS_SESSIONS=true  # Must be true for multi-instance
```

#### Session Configuration
```bash
SESSION_SECRET=your_secret_here
SESSION_ENCRYPTION_KEY=your_key_here
```

#### Load Balancer Configuration
```bash
LB_PORT=80             # HTTP port
LB_HTTPS_PORT=443      # HTTPS port (requires SSL setup)
```

### Generating Secure Keys

**Session Secret:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Encryption Key:**
```bash
# Linux/Mac
openssl rand -hex 32

# Windows (PowerShell)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

## Deployment Options

### Standard Deployment (3 Instances)

Default configuration with 3 application instances:

```bash
./scripts/deploy-multi-instance.sh
```

### High Availability Deployment

Includes Redis replication and Sentinel for automatic failover:

```bash
# Linux/Mac
./scripts/deploy-multi-instance.sh --ha

# Windows
.\scripts\deploy-multi-instance.ps1 -HA
```

### Custom Number of Instances

Scale to a different number of instances:

```bash
# Scale to 5 instances
docker-compose -f docker/docker-compose.multi-instance.yml up -d --scale reporadar-1=5

# Note: You'll need to update nginx.conf to include additional instances
```

## Load Balancing

### Load Balancing Strategies

The default configuration uses **least connections** algorithm:

```nginx
upstream reporadar_backend {
    least_conn;  # Route to instance with fewest active connections
    server reporadar-1:3000;
    server reporadar-2:3000;
    server reporadar-3:3000;
}
```

#### Available Strategies

1. **Least Connections (Default)**: Routes to instance with fewest connections
   - Best for: Variable request processing times
   - Configuration: `least_conn;`

2. **Round Robin**: Distributes requests evenly in rotation
   - Best for: Uniform request processing times
   - Configuration: Remove `least_conn;` directive

3. **IP Hash (Sticky Sessions)**: Routes same client to same instance
   - Best for: When Redis sessions are not available
   - Configuration: `ip_hash;`

### Sticky Sessions

By default, sticky sessions are **NOT required** because session data is stored in Redis. However, you can enable them if needed:

1. Copy the example configuration:
```bash
cp docker/nginx/conf.d/sticky-sessions.conf.example docker/nginx/conf.d/sticky-sessions.conf
```

2. Update `docker/nginx/nginx.conf` to use the sticky upstream

3. Reload Nginx:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec nginx nginx -s reload
```

### Health Checks

Nginx automatically monitors backend health:

- **Health Check Interval**: Every 15 seconds
- **Failure Threshold**: 3 consecutive failures
- **Timeout**: 30 seconds
- **Recovery**: Automatic when instance becomes healthy

Failed instances are automatically removed from the load balancer pool.

## High Availability

### Redis Replication

Enable Redis replication for high availability:

1. Start with HA profile:
```bash
./scripts/deploy-multi-instance.sh --ha
```

2. This deploys:
   - Redis Master (primary)
   - Redis Replica (standby)
   - Redis Sentinel (automatic failover)

### Automatic Failover

Redis Sentinel monitors the master and automatically promotes a replica if the master fails:

- **Detection Time**: 5 seconds
- **Failover Time**: ~10 seconds
- **Quorum**: 2 sentinels must agree

### Database High Availability

For production deployments, consider:

1. **PostgreSQL Replication**: Set up streaming replication
2. **Connection Pooling**: Already configured (2-10 connections per instance)
3. **Backup Strategy**: Regular automated backups

## Monitoring

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/health` | Load balancer health | `200 OK` |
| `/health/backend` | Application health | `200 OK` with status |
| `/health/ready` | Readiness probe | `200 OK` when ready |
| `/health/live` | Liveness probe | `200 OK` when alive |

### Viewing Logs

**All services:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml logs -f
```

**Specific service:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml logs -f reporadar-1
docker-compose -f docker/docker-compose.multi-instance.yml logs -f nginx
docker-compose -f docker/docker-compose.multi-instance.yml logs -f redis-master
```

**Nginx access logs:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec nginx tail -f /var/log/nginx/access.log
```

### Monitoring Metrics

**Nginx status:**
```bash
curl http://localhost/nginx_status
```

**Redis info:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec redis-master redis-cli info
```

**PostgreSQL connections:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec postgres psql -U reporadar -c "SELECT count(*) FROM pg_stat_activity;"
```

## Troubleshooting

### Common Issues

#### 1. Services Not Starting

**Check logs:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml logs
```

**Common causes:**
- Missing environment variables
- Port conflicts
- Insufficient resources

#### 2. Health Checks Failing

**Check instance health:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec reporadar-1 curl http://localhost:3000/health
```

**Common causes:**
- Database connection issues
- Redis connection issues
- Application startup errors

#### 3. Session Not Persisting

**Verify Redis connection:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec redis-master redis-cli ping
```

**Check session configuration:**
- Ensure `USE_REDIS_SESSIONS=true`
- Verify `SESSION_SECRET` is set
- Check Redis is accessible from all instances

#### 4. Load Balancer Not Distributing

**Check Nginx configuration:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec nginx nginx -t
```

**Verify upstream servers:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml exec nginx cat /etc/nginx/nginx.conf
```

### Debug Mode

Enable debug logging:

1. Edit `docker/.env.multi-instance`:
```bash
NODE_ENV=development
```

2. Restart services:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml restart
```

### Reset Deployment

Complete reset (WARNING: Deletes all data):

```bash
docker-compose -f docker/docker-compose.multi-instance.yml down -v
docker-compose -f docker/docker-compose.multi-instance.yml up -d
```

## Scaling

### Horizontal Scaling

Add more instances dynamically:

```bash
# Scale to 5 instances
docker-compose -f docker/docker-compose.multi-instance.yml up -d --scale reporadar-1=5
```

**Note**: When scaling beyond 3 instances, update `docker/nginx/nginx.conf` to include the new instances in the upstream block.

### Vertical Scaling

Adjust resource limits in `docker-compose.multi-instance.yml`:

```yaml
deploy:
  resources:
    limits:
      memory: 4G      # Increase memory
      cpus: '2.0'     # Increase CPU
```

### Database Scaling

Adjust connection pool per instance:

```bash
DB_POOL_MIN=5
DB_POOL_MAX=20
```

**Total connections** = `DB_POOL_MAX` × `number_of_instances`

Example: 3 instances × 10 max connections = 30 total database connections

### Performance Tuning

1. **Increase worker processes** (nginx.conf):
```nginx
worker_processes auto;  # Use all available CPU cores
```

2. **Adjust keepalive connections**:
```nginx
keepalive 64;  # Increase from 32
```

3. **Tune Redis memory**:
```bash
# In docker-compose.multi-instance.yml
command: redis-server --maxmemory 1gb
```

## Production Checklist

Before deploying to production:

- [ ] Set strong `SESSION_SECRET` and `SESSION_ENCRYPTION_KEY`
- [ ] Set secure `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- [ ] Configure SSL/TLS for Nginx
- [ ] Enable Redis replication (HA mode)
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure monitoring and alerting
- [ ] Test failover scenarios
- [ ] Document disaster recovery procedures
- [ ] Set up log aggregation
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Set up CDN for static assets

## Additional Resources

- [Horizontal Scaling Guide](./HORIZONTAL_SCALING_GUIDE.md)
- [Health Check Guide](./HEALTH_CHECK_GUIDE.md)
- [Redis Setup Guide](./REDIS_SETUP.md)
- [Performance Configuration](./PERFORMANCE_CONFIGURATION.md)

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs for error messages
3. Consult the related documentation guides
4. Open an issue on GitHub

---

**Last Updated**: 2025-10-04
