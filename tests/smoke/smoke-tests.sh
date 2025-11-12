#!/bin/bash

# Smoke Tests for AI Roadcall Assistant
# These tests verify basic functionality after deployment

set -e

API_URL="${API_URL:-http://localhost:3000}"
STAGE="${STAGE:-dev}"

echo "🔍 Running smoke tests for $STAGE environment"
echo "API URL: $API_URL"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run tests
run_test() {
  local test_name="$1"
  local test_command="$2"
  
  echo -n "Testing: $test_name... "
  
  if eval "$test_command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
    ((TESTS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}"
    ((TESTS_FAILED++))
    return 1
  fi
}

# Test 1: Health check
run_test "API Health Check" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/health | grep -q 200"

# Test 2: Auth service
run_test "Auth Service Registration" \
  "curl -f -s -X POST $API_URL/auth/register \
    -H 'Content-Type: application/json' \
    -d '{\"name\":\"Smoke Test\",\"phone\":\"+15559999999\",\"role\":\"driver\"}' \
    | grep -q userId"

# Test 3: Incidents API
run_test "Incidents API Availability" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/incidents | grep -q 401"

# Test 4: Vendors API
run_test "Vendors API Availability" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/vendors/search | grep -q 401"

# Test 5: Payments API
run_test "Payments API Availability" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/payments | grep -q 401"

# Test 6: Knowledge Base API
run_test "Knowledge Base API Availability" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/kb/search | grep -q 401"

# Test 7: Notifications API
run_test "Notifications API Availability" \
  "curl -f -s -o /dev/null -w '%{http_code}' $API_URL/notifications | grep -q 401"

# Test 8: Tracking API (AppSync)
if [ -n "$APPSYNC_URL" ]; then
  run_test "Tracking API (AppSync) Availability" \
    "curl -f -s -o /dev/null -w '%{http_code}' $APPSYNC_URL | grep -q 200"
fi

# Test 9: CloudWatch metrics
if [ "$STAGE" != "dev" ]; then
  run_test "CloudWatch Metrics Publishing" \
    "aws cloudwatch get-metric-statistics \
      --namespace RoadcallAssistant \
      --metric-name IncidentCreated \
      --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
      --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
      --period 300 \
      --statistics Sum \
      --region us-east-1 \
      | grep -q Datapoints"
fi

# Test 10: S3 buckets accessible
if [ "$STAGE" != "dev" ]; then
  run_test "S3 Buckets Accessible" \
    "aws s3 ls s3://roadcall-$STAGE-call-recordings --region us-east-1 > /dev/null 2>&1"
fi

# Summary
echo ""
echo "================================"
echo "Smoke Test Results"
echo "================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo "================================"

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}❌ Smoke tests failed${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All smoke tests passed${NC}"
  exit 0
fi
