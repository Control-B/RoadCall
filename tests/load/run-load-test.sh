#!/bin/bash

# Load test runner script for AI Roadcall Assistant
# Usage: ./run-load-test.sh <environment> [test-type]
# Example: ./run-load-test.sh staging full

set -e

ENVIRONMENT=${1:-dev}
TEST_TYPE=${2:-full}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== AI Roadcall Assistant Load Test ===${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "Test Type: ${YELLOW}${TEST_TYPE}${NC}"
echo ""

# Check if Artillery is installed
if ! command -v artillery &> /dev/null; then
    echo -e "${RED}Error: Artillery is not installed${NC}"
    echo "Install with: npm install -g artillery"
    exit 1
fi

# Get API URL from environment
case $ENVIRONMENT in
  dev)
    API_URL="https://api-dev.roadcall.example.com"
    ;;
  staging)
    API_URL="https://api-staging.roadcall.example.com"
    ;;
  prod)
    API_URL="https://api.roadcall.example.com"
    ;;
  *)
    echo -e "${RED}Error: Invalid environment. Use dev, staging, or prod${NC}"
    exit 1
    ;;
esac

export API_URL

echo -e "API URL: ${YELLOW}${API_URL}${NC}"
echo ""

# Create results directory
RESULTS_DIR="./results/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${GREEN}Running load test...${NC}"
echo ""

# Run appropriate test based on type
case $TEST_TYPE in
  quick)
    echo "Running quick smoke test (1 minute)..."
    artillery quick --count 10 --num 100 "$API_URL/health" \
      --output "$RESULTS_DIR/quick-test.json"
    ;;
  
  full)
    echo "Running full load test..."
    artillery run artillery-config.yml \
      --output "$RESULTS_DIR/full-test.json"
    ;;
  
  incidents)
    echo "Running incident creation test (1000 concurrent)..."
    artillery run incident-load-test.yml \
      --output "$RESULTS_DIR/incidents-test.json"
    ;;
  
  *)
    echo -e "${RED}Error: Invalid test type. Use quick, full, or incidents${NC}"
    exit 1
    ;;
esac

# Generate HTML report
echo ""
echo -e "${GREEN}Generating HTML report...${NC}"
artillery report "$RESULTS_DIR"/*.json --output "$RESULTS_DIR/report.html"

echo ""
echo -e "${GREEN}=== Load Test Complete ===${NC}"
echo -e "Results saved to: ${YELLOW}${RESULTS_DIR}${NC}"
echo -e "HTML Report: ${YELLOW}${RESULTS_DIR}/report.html${NC}"
echo ""

# Check if test passed thresholds
if grep -q "All checks passed" "$RESULTS_DIR"/*.json 2>/dev/null; then
    echo -e "${GREEN}✓ All performance thresholds met${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Some performance thresholds not met. Check report for details.${NC}"
    exit 1
fi
