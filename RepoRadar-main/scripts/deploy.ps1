# RepoRadar Deployment Script with Performance Optimizations (PowerShell)
# This script handles deployment with performance optimization flags for Windows

param(
    [string]$Environment = "production",
    [bool]$EnablePerformanceOptimizations = $true,
    [bool]$SkipTests = $false,
    [bool]$SkipBuild = $false,
    [bool]$EnableMonitoring = $true,
    [bool]$EnableCaching = $true,
    [bool]$EnableCompression = $true,
    [switch]$Verbose,
    [switch]$Help
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    @"
Usage: .\deploy.ps1 [OPTIONS]

Deploy RepoRadar with performance optimizations

OPTIONS:
    -Environment ENV                Set deployment environment (development|staging|production) [default: production]
    -EnablePerformanceOptimizations Enable performance optimizations [default: true]
    -EnableMonitoring              Enable performance monitoring [default: true]
    -EnableCaching                 Enable caching optimizations [default: true]
    -EnableCompression             Enable compression optimizations [default: true]
    -SkipTests                     Skip running tests
    -SkipBuild                     Skip build process
    -Verbose                       Enable verbose output
    -Help                          Show this help message

EXAMPLES:
    .\deploy.ps1                                                    # Deploy with all optimizations enabled
    .\deploy.ps1 -Environment staging -SkipTests                    # Deploy to staging without tests
    .\deploy.ps1 -EnablePerformanceOptimizations `$false            # Deploy without performance features
    .\deploy.ps1 -Verbose                                          # Deploy with verbose output

"@
}

if ($Help) {
    Show-Usage
    exit 0
}

# Validate environment
if ($Environment -notin @("development", "staging", "production")) {
    Write-Error "Invalid environment: $Environment. Must be development, staging, or production."
    exit 1
}

Write-Status "Starting deployment for environment: $Environment"

# Set environment variables based on performance flags
$env:NODE_ENV = $Environment

if ($EnablePerformanceOptimizations) {
    Write-Status "Performance optimizations enabled"
    
    # Database optimizations
    $env:DB_QUERY_MONITORING_ENABLED = "true"
    $env:DB_AUTO_CREATE_INDEXES = "true"
    $env:DB_ANALYZE_QUERIES_ENABLED = "true"
    
    # Frontend optimizations
    $env:FRONTEND_CODE_SPLITTING_ENABLED = "true"
    $env:FRONTEND_LAZY_LOADING_ENABLED = "true"
    $env:FRONTEND_TREE_SHAKING_ENABLED = "true"
    
    # GitHub API optimizations
    $env:GITHUB_OPTIMIZATION_ENABLED = "true"
    $env:GITHUB_CACHING_ENABLED = "true"
} else {
    Write-Warning "Performance optimizations disabled"
    $env:DB_QUERY_MONITORING_ENABLED = "false"
    $env:DB_AUTO_CREATE_INDEXES = "false"
    $env:FRONTEND_CODE_SPLITTING_ENABLED = "false"
    $env:FRONTEND_LAZY_LOADING_ENABLED = "false"
    $env:GITHUB_OPTIMIZATION_ENABLED = "false"
}

if ($EnableMonitoring) {
    Write-Status "Performance monitoring enabled"
    $env:PERFORMANCE_MONITORING_ENABLED = "true"
    $env:PERFORMANCE_ALERTING_ENABLED = "true"
    $env:PERFORMANCE_DASHBOARD_ENABLED = "true"
} else {
    Write-Warning "Performance monitoring disabled"
    $env:PERFORMANCE_MONITORING_ENABLED = "false"
    $env:PERFORMANCE_ALERTING_ENABLED = "false"
    $env:PERFORMANCE_DASHBOARD_ENABLED = "false"
}

if ($EnableCaching) {
    Write-Status "Caching optimizations enabled"
    $env:CACHE_ENABLED = "true"
    $env:CACHE_COMPRESSION_ENABLED = "true"
} else {
    Write-Warning "Caching optimizations disabled"
    $env:CACHE_ENABLED = "false"
    $env:CACHE_COMPRESSION_ENABLED = "false"
}

if ($EnableCompression) {
    Write-Status "Compression optimizations enabled"
    $env:COMPRESSION_ENABLED = "true"
} else {
    Write-Warning "Compression optimizations disabled"
    $env:COMPRESSION_ENABLED = "false"
}

# Set environment-specific optimizations
switch ($Environment) {
    "production" {
        Write-Status "Applying production optimizations"
        $env:FRONTEND_TREE_SHAKING_ENABLED = "true"
        $env:COMPRESSION_LEVEL = "9"
        $env:CACHE_DEFAULT_TTL = "7200"
        $env:METRICS_RETENTION_DAYS = "90"
    }
    "staging" {
        Write-Status "Applying staging optimizations"
        $env:COMPRESSION_LEVEL = "6"
        $env:CACHE_DEFAULT_TTL = "3600"
        $env:METRICS_RETENTION_DAYS = "30"
    }
    "development" {
        Write-Status "Applying development settings"
        $env:COMPRESSION_LEVEL = "1"
        $env:CACHE_DEFAULT_TTL = "300"
        $env:METRICS_RETENTION_DAYS = "7"
    }
}

# Check for required environment variables
Write-Status "Checking environment configuration"
if (-not $env:DATABASE_URL) {
    Write-Error "DATABASE_URL is required"
    exit 1
}

# Install dependencies
Write-Status "Installing dependencies"
try {
    if ($Verbose) {
        npm ci
    } else {
        npm ci --silent
    }
} catch {
    Write-Error "Failed to install dependencies: $_"
    exit 1
}

# Run tests if not skipped
if (-not $SkipTests) {
    Write-Status "Running tests"
    try {
        if ($Verbose) {
            npm run test:run
        } else {
            npm run test:run --silent
        }
        Write-Success "Tests passed"
    } catch {
        Write-Error "Tests failed: $_"
        exit 1
    }
} else {
    Write-Warning "Skipping tests"
}

# Database migrations
Write-Status "Running database migrations"
try {
    npm run db:push
} catch {
    Write-Error "Database migration failed: $_"
    exit 1
}

# Build application if not skipped
if (-not $SkipBuild) {
    Write-Status "Building application with optimizations"
    
    # Set build-time environment variables
    if ($Environment -eq "production") {
        $env:VITE_BUILD_ANALYZE = "false"
        $env:VITE_MINIFY = "true"
        $env:VITE_SOURCEMAP = "false"
    } else {
        $env:VITE_BUILD_ANALYZE = "true"
        $env:VITE_MINIFY = "false"
        $env:VITE_SOURCEMAP = "true"
    }
    
    try {
        if ($Verbose) {
            npm run build
        } else {
            npm run build --silent
        }
        Write-Success "Build completed"
    } catch {
        Write-Error "Build failed: $_"
        exit 1
    }
} else {
    Write-Warning "Skipping build"
}

# Performance configuration validation
Write-Status "Validating performance configuration"
try {
    $validationScript = @"
const { performanceConfig } = require('./config/performance.config.js');
const validation = performanceConfig.validateConfig();
if (!validation.valid) {
    console.error('Configuration validation failed:');
    validation.errors.forEach(error => console.error('  -', error));
    process.exit(1);
}
console.log('Configuration validation passed');
"@
    
    node -e $validationScript
} catch {
    Write-Error "Configuration validation failed: $_"
    exit 1
}

# Create performance monitoring setup
if ($EnableMonitoring) {
    Write-Status "Setting up performance monitoring"
    
    # Create monitoring directories
    if (-not (Test-Path "logs\performance")) {
        New-Item -ItemType Directory -Path "logs\performance" -Force | Out-Null
    }
    if (-not (Test-Path "data\metrics")) {
        New-Item -ItemType Directory -Path "data\metrics" -Force | Out-Null
    }
    
    Write-Success "Performance monitoring setup completed"
}

# Health check
Write-Status "Performing deployment health check"
$port = if ($env:PORT) { $env:PORT } else { "3000" }
$healthUrl = "http://localhost:$port/health"

$timeout = 30
$elapsed = 0
$healthCheckPassed = $false

while ($elapsed -lt $timeout -and -not $healthCheckPassed) {
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -TimeoutSec 2 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $healthCheckPassed = $true
        }
    } catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}

if (-not $healthCheckPassed) {
    Write-Error "Health check failed"
    exit 1
}

Write-Success "Deployment completed successfully!"

# Print deployment summary
$performanceStatus = if ($EnablePerformanceOptimizations) { "✓ Enabled" } else { "✗ Disabled" }
$monitoringStatus = if ($EnableMonitoring) { "✓ Enabled" } else { "✗ Disabled" }
$cachingStatus = if ($EnableCaching) { "✓ Enabled" } else { "✗ Disabled" }
$compressionStatus = if ($EnableCompression) { "✓ Enabled" } else { "✗ Disabled" }

Write-Host ""
Write-Host "=== DEPLOYMENT SUMMARY ===" -ForegroundColor Green
Write-Host "Environment: $Environment"
Write-Host "Performance Optimizations: $EnablePerformanceOptimizations"
Write-Host "Monitoring: $EnableMonitoring"
Write-Host "Caching: $EnableCaching"
Write-Host "Compression: $EnableCompression"
Write-Host ""
Write-Host "Performance Features:" -ForegroundColor Blue
Write-Host "- Database connection pooling: $performanceStatus"
Write-Host "- Query monitoring: $performanceStatus"
Write-Host "- API response caching: $cachingStatus"
Write-Host "- Response compression: $compressionStatus"
Write-Host "- Frontend code splitting: $performanceStatus"
Write-Host "- Lazy loading: $performanceStatus"
Write-Host "- GitHub API optimization: $performanceStatus"
Write-Host "- Performance monitoring: $monitoringStatus"
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Monitor application performance at /api/performance/dashboard"
Write-Host "2. Check logs in logs/performance/ directory"
Write-Host "3. Review metrics in data/metrics/ directory"
Write-Host "4. Configure alerts based on your requirements"