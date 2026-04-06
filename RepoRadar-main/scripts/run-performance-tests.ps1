#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run performance and load tests for RepoRadar

.DESCRIPTION
    This script starts the application server and runs comprehensive
    performance and load tests including:
    - 100 concurrent users
    - 100 concurrent jobs
    - 1000 analytics events per minute
    - Multi-instance load distribution

.PARAMETER BaseUrl
    Base URL of the application to test (default: http://localhost:5000)

.PARAMETER SkipBuild
    Skip building the application before testing

.PARAMETER TestPattern
    Run specific test pattern (e.g., "Concurrent User")

.EXAMPLE
    .\scripts\run-performance-tests.ps1
    Run all performance tests with default settings

.EXAMPLE
    .\scripts\run-performance-tests.ps1 -BaseUrl http://localhost:8080
    Run tests against a different URL

.EXAMPLE
    .\scripts\run-performance-tests.ps1 -TestPattern "Concurrent User"
    Run only concurrent user tests
#>

param(
    [string]$BaseUrl = "http://localhost:5000",
    [switch]$SkipBuild = $false,
    [string]$TestPattern = ""
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 RepoRadar Performance Testing Suite" -ForegroundColor Cyan
Write-Host "=" * 60

# Check if server is already running
Write-Host "`n📡 Checking if server is running at $BaseUrl..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 5 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Server is already running" -ForegroundColor Green
        $serverStarted = $false
    }
} catch {
    Write-Host "⚠️  Server is not running, will start it..." -ForegroundColor Yellow
    $serverStarted = $true
}

# Build application if needed
if (-not $SkipBuild -and $serverStarted) {
    Write-Host "`n🔨 Building application..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Build completed" -ForegroundColor Green
}

# Start server if needed
$serverProcess = $null
if ($serverStarted) {
    Write-Host "`n🌐 Starting server..." -ForegroundColor Yellow
    
    # Start server in background
    $serverProcess = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow
    
    # Wait for server to be ready
    $maxAttempts = 30
    $attempt = 0
    $serverReady = $false
    
    while ($attempt -lt $maxAttempts -and -not $serverReady) {
        Start-Sleep -Seconds 2
        $attempt++
        
        try {
            $response = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $serverReady = $true
                Write-Host "✅ Server is ready" -ForegroundColor Green
            }
        } catch {
            Write-Host "   Waiting for server... ($attempt/$maxAttempts)" -ForegroundColor Gray
        }
    }
    
    if (-not $serverReady) {
        Write-Host "❌ Server failed to start within timeout" -ForegroundColor Red
        if ($serverProcess) {
            Stop-Process -Id $serverProcess.Id -Force
        }
        exit 1
    }
}

# Run performance tests
Write-Host "`n🧪 Running performance tests..." -ForegroundColor Yellow
Write-Host "   Base URL: $BaseUrl" -ForegroundColor Gray

$env:TEST_BASE_URL = $BaseUrl

try {
    if ($TestPattern) {
        Write-Host "   Test Pattern: $TestPattern" -ForegroundColor Gray
        npm test tests/PerformanceLoad.test.ts -- --run --reporter=verbose -t "$TestPattern"
    } else {
        npm test tests/PerformanceLoad.test.ts -- --run --reporter=verbose
    }
    
    $testExitCode = $LASTEXITCODE
    
    if ($testExitCode -eq 0) {
        Write-Host "`n✅ All performance tests passed!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️  Some performance tests failed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "`n❌ Error running tests: $_" -ForegroundColor Red
    $testExitCode = 1
} finally {
    # Stop server if we started it
    if ($serverStarted -and $serverProcess) {
        Write-Host "`n🛑 Stopping server..." -ForegroundColor Yellow
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
        Write-Host "✅ Server stopped" -ForegroundColor Green
    }
}

Write-Host "`n" + "=" * 60
if ($testExitCode -eq 0) {
    Write-Host "🎉 Performance testing completed successfully!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Performance testing completed with issues" -ForegroundColor Yellow
}

exit $testExitCode
