#!/bin/bash

# Multi-Instance Deployment Script for RepoRadar
# This script deploys RepoRadar with 3 instances behind a load balancer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker/docker-compose.multi-instance.yml"
ENV_FILE="docker/.env.multi-instance"
ENABLE_HA=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ha)
            ENABLE_HA=true
            shift
            ;;
        --env)
            ENV_FILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --ha          Enable high availability (Redis replication and Sentinel)"
            echo "  --env FILE    Use custom environment file (default: docker/.env.multi-instance)"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}=== RepoRadar Multi-Instance Deployment ===${NC}"
echo ""

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: Environment file not found: $ENV_FILE${NC}"
    echo -e "${YELLOW}Please copy docker/.env.multi-instance.example to $ENV_FILE and configure it${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Build images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

echo -e "${GREEN}✓ Images built successfully${NC}"
echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"

if [ "$ENABLE_HA" = true ]; then
    echo -e "${YELLOW}High availability mode enabled${NC}"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" --profile ha up -d
else
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
fi

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Check health of each service
check_health() {
    local service=$1
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps | grep "$service" | grep -q "healthy"; then
            echo -e "${GREEN}✓ $service is healthy${NC}"
            return 0
        fi
        echo -e "${YELLOW}Waiting for $service to be healthy (attempt $attempt/$max_attempts)...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}✗ $service failed to become healthy${NC}"
    return 1
}

# Check critical services
check_health "postgres"
check_health "redis-master"
check_health "reporadar-1"
check_health "reporadar-2"
check_health "reporadar-3"
check_health "nginx"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Services are running:"
echo "  - Load Balancer: http://localhost:80"
echo "  - Instance 1: reporadar-1:3000"
echo "  - Instance 2: reporadar-2:3000"
echo "  - Instance 3: reporadar-3:3000"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "Health check endpoints:"
echo "  - Load Balancer: http://localhost/health"
echo "  - Backend: http://localhost/health/backend"
echo "  - Readiness: http://localhost/health/ready"
echo "  - Liveness: http://localhost/health/live"
echo ""
echo "To view logs:"
echo "  docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE logs -f"
echo ""
echo "To stop services:"
echo "  docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE down"
echo ""
echo "To scale instances:"
echo "  docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE up -d --scale reporadar-1=2"
echo ""
