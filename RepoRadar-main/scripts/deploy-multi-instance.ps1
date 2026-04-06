# Multi-Instance Deployment Script for RepoRadar (PowerShell)
# This script deploys RepoRadar with 3 instances behind a load balancer

param(
    [switch]$HA,
    [string]$EnvFile = "docker\.env.multi-instance",
    [switch]$Help
)

# Configuration
$ComposeFile = "docker\docker-compose.multi-instance.yml"

# Show help
if ($Help) {
    Write-Host "Usage: .\deploy-multi-instance.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -HA           Enable high availability (Redis replication and Sentinel)"
    Write-Host "  -EnvFile FILE Use custom environment file (default: docker\.env.multi-instance)"
    Write-Host "  -Help         Show this help message"
    exit 0
}

Write-Host "=== RepoRadar Multi-Instance Deployment ===" -ForegroundColor Green
Write-Host ""

# Check if environment file exists
if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: Environment file not found: $EnvFile" -ForegroundColor Red
    Write-Host "Please copy docker\.env.multi-instance.example to $EnvFile and configure it" -ForegroundColor Yellow
    exit 1
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "Error: Docker is not running" -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
try {
    docker-compose --version | Out-Null
    Write-Host "✓ Docker Compose is available" -ForegroundColor Green
} catch {
    Write-Host "Error: docker-compose is not installed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Build images
Write-Host "Building Docker images..." -ForegroundColor Yellow
docker-compose -f $ComposeFile --env-file $EnvFile build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build images" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Images built successfully" -ForegroundColor Green
Write-Host ""

# Start services
Write-Host "Starting services..." -ForegroundColor Yellow

if ($HA) {
    Write-Host "High availability mode enabled" -ForegroundColor Yellow
    docker-compose -f $ComposeFile --env-file $EnvFile --profile ha up -d
} else {
    docker-compose -f $ComposeFile --env-file $EnvFile up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start services" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Services started" -ForegroundColor Green
Write-Host ""

# Wait for services to be healthy
Write-Host "Waiting for services to be healthy..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Function to check health
function Check-Health {
    param([string]$Service)
    
    $maxAttempts = 30
    $attempt = 1
    
    while ($attempt -le $maxAttempts) {
        $status = docker-compose -f $ComposeFile --env-file $EnvFile ps | Select-String $Service
        if ($status -match "healthy") {
            Write-Host "✓ $Service is healthy" -ForegroundColor Green
            return $true
        }
        Write-Host "Waiting for $Service to be healthy (attempt $attempt/$maxAttempts)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        $attempt++
    }
    
    Write-Host "✗ $Service failed to become healthy" -ForegroundColor Red
    return $false
}

# Check critical services
$allHealthy = $true
$allHealthy = $allHealthy -and (Check-Health "postgres")
$allHealthy = $allHealthy -and (Check-Health "redis-master")
$allHealthy = $allHealthy -and (Check-Health "reporadar-1")
$allHealthy = $allHealthy -and (Check-Health "reporadar-2")
$allHealthy = $allHealthy -and (Check-Health "reporadar-3")
$allHealthy = $allHealthy -and (Check-Health "nginx")

if (-not $allHealthy) {
    Write-Host ""
    Write-Host "Warning: Some services are not healthy. Check logs for details." -ForegroundColor Yellow
    Write-Host "Run: docker-compose -f $ComposeFile --env-file $EnvFile logs" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Services are running:"
Write-Host "  - Load Balancer: http://localhost:80"
Write-Host "  - Instance 1: reporadar-1:3000"
Write-Host "  - Instance 2: reporadar-2:3000"
Write-Host "  - Instance 3: reporadar-3:3000"
Write-Host "  - PostgreSQL: localhost:5432"
Write-Host "  - Redis: localhost:6379"
Write-Host ""
Write-Host "Health check endpoints:"
Write-Host "  - Load Balancer: http://localhost/health"
Write-Host "  - Backend: http://localhost/health/backend"
Write-Host "  - Readiness: http://localhost/health/ready"
Write-Host "  - Liveness: http://localhost/health/live"
Write-Host ""
Write-Host "To view logs:"
Write-Host "  docker-compose -f $ComposeFile --env-file $EnvFile logs -f"
Write-Host ""
Write-Host "To stop services:"
Write-Host "  docker-compose -f $ComposeFile --env-file $EnvFile down"
Write-Host ""
