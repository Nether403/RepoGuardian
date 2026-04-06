# Multi-Instance Deployment - Quick Start Guide

Get RepoRadar running with 3 instances behind a load balancer in 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- 4GB RAM available
- Ports 80, 5432, and 6379 available

## Quick Start (5 Steps)

### Step 1: Configure Environment

```bash
# Copy the environment template
cp docker/.env.multi-instance.example docker/.env.multi-instance
```

Edit `docker/.env.multi-instance` and set these required values:

```bash
# Set a secure PostgreSQL password
POSTGRES_PASSWORD=your_secure_password_here

# Set a session secret (min 32 characters)
SESSION_SECRET=your_session_secret_min_32_chars_change_in_production

# Set a session encryption key (64 hex characters)
SESSION_ENCRYPTION_KEY=your_64_char_hex_encryption_key_here_change_in_production

# Set your GitHub token
GITHUB_TOKEN=your_github_token_here
```

**Generate secure keys:**

```bash
# Session secret (Linux/Mac)
openssl rand -base64 32

# Encryption key (Linux/Mac)
openssl rand -hex 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

### Step 2: Deploy

**Linux/Mac:**
```bash
npm run deploy:multi
```

**Windows:**
```powershell
npm run deploy:multi:windows
```

**Manual:**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  --env-file docker/.env.multi-instance up -d
```

### Step 3: Wait for Services

The deployment script will automatically wait for services to be healthy. If deploying manually, wait about 30 seconds for all services to start.

### Step 4: Verify

```bash
# Run verification script
npm run verify:multi

# Or manually check health
curl http://localhost/health
```

### Step 5: Access Application

Open your browser and go to:
- **Application**: http://localhost
- **Health Status**: http://localhost/health/backend

## What You Get

✅ **3 Application Instances** running in parallel
✅ **Nginx Load Balancer** distributing traffic
✅ **PostgreSQL Database** with connection pooling
✅ **Redis** for shared sessions and caching
✅ **Automatic Health Checks** and failover
✅ **Graceful Shutdown** and connection draining

## Architecture

```
Internet → Nginx (Port 80) → [Instance 1, Instance 2, Instance 3]
                                      ↓
                              [PostgreSQL, Redis]
```

## Verify It's Working

### Check Load Distribution

Make multiple requests and see different instances respond:

```bash
for i in {1..10}; do
  curl -s http://localhost/health/backend | grep -o '"instanceId":"[^"]*"'
done
```

You should see requests distributed across `reporadar-1`, `reporadar-2`, and `reporadar-3`.

### Check All Services

```bash
docker-compose -f docker/docker-compose.multi-instance.yml ps
```

All services should show status as "healthy".

## Common Commands

### View Logs

```bash
# All services
docker-compose -f docker/docker-compose.multi-instance.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.multi-instance.yml logs -f nginx
docker-compose -f docker/docker-compose.multi-instance.yml logs -f reporadar-1
```

### Stop Services

```bash
docker-compose -f docker/docker-compose.multi-instance.yml down
```

### Restart Services

```bash
docker-compose -f docker/docker-compose.multi-instance.yml restart
```

### Scale to More Instances

```bash
docker-compose -f docker/docker-compose.multi-instance.yml up -d --scale reporadar-1=5
```

## High Availability Mode

For production deployments with Redis replication and automatic failover:

**Linux/Mac:**
```bash
npm run deploy:multi:ha
```

**Windows:**
```powershell
npm run deploy:multi:windows:ha
```

This adds:
- Redis replica for data redundancy
- Redis Sentinel for automatic failover
- ~15 second recovery time on Redis master failure

## Troubleshooting

### Services Not Starting

Check logs for errors:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml logs
```

### Port Already in Use

Change ports in `docker/.env.multi-instance`:
```bash
LB_PORT=8080  # Change from 80
```

### Health Checks Failing

Test instance directly:
```bash
docker-compose -f docker/docker-compose.multi-instance.yml \
  exec reporadar-1 curl http://localhost:3000/health
```

### Reset Everything

**WARNING: Deletes all data!**
```bash
docker-compose -f docker/docker-compose.multi-instance.yml down -v
```

## Next Steps

- Read the [Full Deployment Guide](docs/MULTI_INSTANCE_DEPLOYMENT.md)
- Configure [SSL/TLS for HTTPS](docs/MULTI_INSTANCE_DEPLOYMENT.md#ssl-configuration)
- Set up [Monitoring and Alerts](docs/MULTI_INSTANCE_DEPLOYMENT.md#monitoring)
- Review [Production Checklist](docs/MULTI_INSTANCE_DEPLOYMENT.md#production-checklist)

## Need Help?

- Check the [Troubleshooting Guide](docs/MULTI_INSTANCE_DEPLOYMENT.md#troubleshooting)
- Review [Docker README](docker/README.md)
- Run verification: `npm run verify:multi`

---

**Deployment Time**: ~5 minutes
**Difficulty**: Easy
**Production Ready**: Yes (with proper configuration)
