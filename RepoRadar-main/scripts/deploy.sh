#!/bin/bash

# RepoRadar Deployment Script with Performance Optimizations
# This script handles deployment with performance optimization flags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
ENABLE_PERFORMANCE_OPTIMIZATIONS=true
SKIP_TESTS=false
SKIP_BUILD=false
ENABLE_MONITORING=true
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
VERBOSE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy RepoRadar with performance optimizations

OPTIONS:
    -e, --environment ENV       Set deployment environment (development|staging|production) [default: production]
    -p, --performance BOOL      Enable performance optimizations [default: true]
    -m, --monitoring BOOL       Enable performance monitoring [default: true]
    -c, --caching BOOL          Enable caching optimizations [default: true]
    -z, --compression BOOL      Enable compression optimizations [default: true]
    --skip-tests               Skip running tests
    --skip-build               Skip build process
    -v, --verbose              Enable verbose output
    -h, --help                 Show this help message

EXAMPLES:
    $0                                          # Deploy with all optimizations enabled
    $0 -e staging --skip-tests                  # Deploy to staging without tests
    $0 --performance false --monitoring false   # Deploy without performance features
    $0 -v                                      # Deploy with verbose output

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -p|--performance)
            ENABLE_PERFORMANCE_OPTIMIZATIONS="$2"
            shift 2
            ;;
        -m|--monitoring)
            ENABLE_MONITORING="$2"
            shift 2
            ;;
        -c|--caching)
            ENABLE_CACHING="$2"
            shift 2
            ;;
        -z|--compression)
            ENABLE_COMPRESSION="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=false
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
    exit 1
fi

print_status "Starting deployment for environment: $ENVIRONMENT"

# Set environment variables based on performance flags
export NODE_ENV="$ENVIRONMENT"

if [[ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ]]; then
    print_status "Performance optimizations enabled"
    
    # Database optimizations
    export DB_QUERY_MONITORING_ENABLED=true
    export DB_AUTO_CREATE_INDEXES=true
    export DB_ANALYZE_QUERIES_ENABLED=true
    
    # Frontend optimizations
    export FRONTEND_CODE_SPLITTING_ENABLED=true
    export FRONTEND_LAZY_LOADING_ENABLED=true
    export FRONTEND_TREE_SHAKING_ENABLED=true
    
    # GitHub API optimizations
    export GITHUB_OPTIMIZATION_ENABLED=true
    export GITHUB_CACHING_ENABLED=true
else
    print_warning "Performance optimizations disabled"
    export DB_QUERY_MONITORING_ENABLED=false
    export DB_AUTO_CREATE_INDEXES=false
    export FRONTEND_CODE_SPLITTING_ENABLED=false
    export FRONTEND_LAZY_LOADING_ENABLED=false
    export GITHUB_OPTIMIZATION_ENABLED=false
fi

if [[ "$ENABLE_MONITORING" == "true" ]]; then
    print_status "Performance monitoring enabled"
    export PERFORMANCE_MONITORING_ENABLED=true
    export PERFORMANCE_ALERTING_ENABLED=true
    export PERFORMANCE_DASHBOARD_ENABLED=true
else
    print_warning "Performance monitoring disabled"
    export PERFORMANCE_MONITORING_ENABLED=false
    export PERFORMANCE_ALERTING_ENABLED=false
    export PERFORMANCE_DASHBOARD_ENABLED=false
fi

if [[ "$ENABLE_CACHING" == "true" ]]; then
    print_status "Caching optimizations enabled"
    export CACHE_ENABLED=true
    export CACHE_COMPRESSION_ENABLED=true
else
    print_warning "Caching optimizations disabled"
    export CACHE_ENABLED=false
    export CACHE_COMPRESSION_ENABLED=false
fi

if [[ "$ENABLE_COMPRESSION" == "true" ]]; then
    print_status "Compression optimizations enabled"
    export COMPRESSION_ENABLED=true
else
    print_warning "Compression optimizations disabled"
    export COMPRESSION_ENABLED=false
fi

# Set production-specific optimizations
if [[ "$ENVIRONMENT" == "production" ]]; then
    print_status "Applying production optimizations"
    export FRONTEND_TREE_SHAKING_ENABLED=true
    export COMPRESSION_LEVEL=9
    export CACHE_DEFAULT_TTL=7200
    export METRICS_RETENTION_DAYS=90
elif [[ "$ENVIRONMENT" == "staging" ]]; then
    print_status "Applying staging optimizations"
    export COMPRESSION_LEVEL=6
    export CACHE_DEFAULT_TTL=3600
    export METRICS_RETENTION_DAYS=30
else
    print_status "Applying development settings"
    export COMPRESSION_LEVEL=1
    export CACHE_DEFAULT_TTL=300
    export METRICS_RETENTION_DAYS=7
fi

# Check for required environment variables
print_status "Checking environment configuration"
if [[ -z "$DATABASE_URL" ]]; then
    print_error "DATABASE_URL is required"
    exit 1
fi

# Install dependencies
print_status "Installing dependencies"
if [[ "$VERBOSE" == "true" ]]; then
    npm ci
else
    npm ci --silent
fi

# Run tests if not skipped
if [[ "$SKIP_TESTS" == "false" ]]; then
    print_status "Running tests"
    if [[ "$VERBOSE" == "true" ]]; then
        npm run test:run
    else
        npm run test:run --silent
    fi
    print_success "Tests passed"
else
    print_warning "Skipping tests"
fi

# Database migrations
print_status "Running database migrations"
npm run db:push

# Build application if not skipped
if [[ "$SKIP_BUILD" == "false" ]]; then
    print_status "Building application with optimizations"
    
    # Set build-time environment variables
    if [[ "$ENVIRONMENT" == "production" ]]; then
        export VITE_BUILD_ANALYZE=false
        export VITE_MINIFY=true
        export VITE_SOURCEMAP=false
    else
        export VITE_BUILD_ANALYZE=true
        export VITE_MINIFY=false
        export VITE_SOURCEMAP=true
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        npm run build
    else
        npm run build --silent
    fi
    print_success "Build completed"
else
    print_warning "Skipping build"
fi

# Performance configuration validation
print_status "Validating performance configuration"
node -e "
const { performanceConfig } = require('./config/performance.config.js');
const validation = performanceConfig.validateConfig();
if (!validation.valid) {
    console.error('Configuration validation failed:');
    validation.errors.forEach(error => console.error('  -', error));
    process.exit(1);
}
console.log('Configuration validation passed');
"

# Create performance monitoring setup
if [[ "$ENABLE_MONITORING" == "true" ]]; then
    print_status "Setting up performance monitoring"
    
    # Create monitoring directories
    mkdir -p logs/performance
    mkdir -p data/metrics
    
    # Set appropriate permissions
    chmod 755 logs/performance
    chmod 755 data/metrics
    
    print_success "Performance monitoring setup completed"
fi

# Health check
print_status "Performing deployment health check"
timeout 30s bash -c 'until curl -f http://localhost:${PORT:-3000}/health; do sleep 2; done' || {
    print_error "Health check failed"
    exit 1
}

print_success "Deployment completed successfully!"

# Print deployment summary
cat << EOF

${GREEN}=== DEPLOYMENT SUMMARY ===${NC}
Environment: $ENVIRONMENT
Performance Optimizations: $ENABLE_PERFORMANCE_OPTIMIZATIONS
Monitoring: $ENABLE_MONITORING
Caching: $ENABLE_CACHING
Compression: $ENABLE_COMPRESSION

${BLUE}Performance Features:${NC}
- Database connection pooling: $([ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- Query monitoring: $([ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- API response caching: $([ "$ENABLE_CACHING" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- Response compression: $([ "$ENABLE_COMPRESSION" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- Frontend code splitting: $([ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- Lazy loading: $([ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- GitHub API optimization: $([ "$ENABLE_PERFORMANCE_OPTIMIZATIONS" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")
- Performance monitoring: $([ "$ENABLE_MONITORING" == "true" ] && echo "✓ Enabled" || echo "✗ Disabled")

${YELLOW}Next Steps:${NC}
1. Monitor application performance at /api/performance/dashboard
2. Check logs in logs/performance/ directory
3. Review metrics in data/metrics/ directory
4. Configure alerts based on your requirements

EOF