#!/bin/bash

# Run performance and load tests for RepoRadar
#
# This script starts the application server and runs comprehensive
# performance and load tests including:
# - 100 concurrent users
# - 100 concurrent jobs
# - 1000 analytics events per minute
# - Multi-instance load distribution

set -e

# Default values
BASE_URL="${TEST_BASE_URL:-http://localhost:5000}"
SKIP_BUILD=false
TEST_PATTERN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --test-pattern)
            TEST_PATTERN="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --base-url URL       Base URL to test (default: http://localhost:5000)"
            echo "  --skip-build         Skip building the application"
            echo "  --test-pattern TEXT  Run specific test pattern"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🚀 RepoRadar Performance Testing Suite"
echo "============================================================"

# Check if server is already running
echo ""
echo "📡 Checking if server is running at $BASE_URL..."

SERVER_STARTED=false
if curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
    echo "✅ Server is already running"
else
    echo "⚠️  Server is not running, will start it..."
    SERVER_STARTED=true
fi

# Build application if needed
if [ "$SKIP_BUILD" = false ] && [ "$SERVER_STARTED" = true ]; then
    echo ""
    echo "🔨 Building application..."
    npm run build
    echo "✅ Build completed"
fi

# Start server if needed
SERVER_PID=""
if [ "$SERVER_STARTED" = true ]; then
    echo ""
    echo "🌐 Starting server..."
    
    # Start server in background
    npm start > /dev/null 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to be ready
    MAX_ATTEMPTS=30
    ATTEMPT=0
    SERVER_READY=false
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ] && [ "$SERVER_READY" = false ]; do
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
        
        if curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
            SERVER_READY=true
            echo "✅ Server is ready"
        else
            echo "   Waiting for server... ($ATTEMPT/$MAX_ATTEMPTS)"
        fi
    done
    
    if [ "$SERVER_READY" = false ]; then
        echo "❌ Server failed to start within timeout"
        if [ -n "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null || true
        fi
        exit 1
    fi
fi

# Cleanup function
cleanup() {
    if [ "$SERVER_STARTED" = true ] && [ -n "$SERVER_PID" ]; then
        echo ""
        echo "🛑 Stopping server..."
        kill $SERVER_PID 2>/dev/null || true
        echo "✅ Server stopped"
    fi
}

# Register cleanup on exit
trap cleanup EXIT

# Run performance tests
echo ""
echo "🧪 Running performance tests..."
echo "   Base URL: $BASE_URL"

export TEST_BASE_URL="$BASE_URL"

TEST_EXIT_CODE=0
if [ -n "$TEST_PATTERN" ]; then
    echo "   Test Pattern: $TEST_PATTERN"
    npm test tests/PerformanceLoad.test.ts -- --run --reporter=verbose -t "$TEST_PATTERN" || TEST_EXIT_CODE=$?
else
    npm test tests/PerformanceLoad.test.ts -- --run --reporter=verbose || TEST_EXIT_CODE=$?
fi

echo ""
echo "============================================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All performance tests passed!"
    echo "🎉 Performance testing completed successfully!"
else
    echo "⚠️  Some performance tests failed"
    echo "⚠️  Performance testing completed with issues"
fi

exit $TEST_EXIT_CODE
