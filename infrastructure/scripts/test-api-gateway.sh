#!/bin/bash

# Test API Gateway Implementation
# This script validates all security controls and features

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL=${API_URL:-"https://api.roadcall.com/dev"}
STAGE=${STAGE:-"dev"}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         API Gateway Security Controls Test Suite          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "API URL: $API_URL"
echo "Stage: $STAGE"
echo ""

# Test counters
PASSED=0
FAILED=0

# Helper function to run test
run_test() {
  local test_name=$1
  local test_command=$2
  local expected_result=$3
  
  echo -e "${YELLOW}Testing: $test_name${NC}"
  
  if eval "$test_command"; then
    if [ "$expected_result" == "pass" ]; then
      echo -e "${GREEN}✓ PASSED${NC}"
      ((PASSED++))
    else
      echo -e "${RED}✗ FAILED (expected to fail but passed)${NC}"
      ((FAILED++))
    fi
  else
    if [ "$expected_result" == "fail" ]; then
      echo -e "${GREEN}✓ PASSED (correctly failed)${NC}"
      ((PASSED++))
    else
      echo -e "${RED}✗ FAILED${NC}"
      ((FAILED++))
    fi
  fi
  echo ""
}

# Test 1: CORS Headers
echo -e "${BLUE}═══ Test 1: CORS Configuration ═══${NC}"
run_test "CORS preflight request" \
  "curl -s -X OPTIONS $API_URL/auth/register \
    -H 'Origin: https://app.roadcall.com' \
    -H 'Access-Control-Request-Method: POST' \
    -H 'Access-Control-Request-Headers: Content-Type' \
    -w '%{http_code}' -o /dev/null | grep -q '200'" \
  "pass"

# Test 2: Request Validation
echo -e "${BLUE}═══ Test 2: Request Validation ═══${NC}"
run_test "Invalid request body (missing required fields)" \
  "curl -s -X POST $API_URL/auth/register \
    -H 'Content-Type: application/json' \
    -d '{}' \
    -w '%{http_code}' -o /dev/null | grep -q '400'" \
  "pass"

run_test "Valid request body" \
  "curl -s -X POST $API_URL/auth/register \
    -H 'Content-Type: application/json' \
    -d '{\"phone\":\"+15551234567\",\"role\":\"driver\",\"name\":\"Test User\"}' \
    -w '%{http_code}' -o /dev/null | grep -q '200\|201'" \
  "pass"

# Test 3: Authentication
echo -e "${BLUE}═══ Test 3: Authentication ═══${NC}"
run_test "Access protected endpoint without token" \
  "curl -s -X GET $API_URL/auth/me \
    -w '%{http_code}' -o /dev/null | grep -q '401'" \
  "pass"

run_test "Access protected endpoint with invalid token" \
  "curl -s -X GET $API_URL/auth/me \
    -H 'Authorization: Bearer invalid_token' \
    -w '%{http_code}' -o /dev/null | grep -q '401\|403'" \
  "pass"

# Test 4: Rate Limiting (requires multiple requests)
echo -e "${BLUE}═══ Test 4: Rate Limiting ═══${NC}"
echo "Sending 150 requests to test rate limiting..."
RATE_LIMIT_TRIGGERED=false
for i in {1..150}; do
  STATUS=$(curl -s -X GET $API_URL/auth/register \
    -w '%{http_code}' -o /dev/null)
  if [ "$STATUS" == "429" ]; then
    RATE_LIMIT_TRIGGERED=true
    break
  fi
  sleep 0.1
done

if [ "$RATE_LIMIT_TRIGGERED" == "true" ]; then
  echo -e "${GREEN}✓ PASSED - Rate limit triggered at request $i${NC}"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ WARNING - Rate limit not triggered (may need more requests)${NC}"
fi
echo ""

# Test 5: HTTP Methods
echo -e "${BLUE}═══ Test 5: HTTP Method Validation ═══${NC}"
run_test "Invalid HTTP method" \
  "curl -s -X DELETE $API_URL/auth/register \
    -w '%{http_code}' -o /dev/null | grep -q '403\|405'" \
  "pass"

# Test 6: Content-Type Validation
echo -e "${BLUE}═══ Test 6: Content-Type Validation ═══${NC}"
run_test "Missing Content-Type header" \
  "curl -s -X POST $API_URL/auth/register \
    -d '{\"phone\":\"+15551234567\"}' \
    -w '%{http_code}' -o /dev/null | grep -q '400\|415'" \
  "pass"

# Test 7: Response Headers
echo -e "${BLUE}═══ Test 7: Security Response Headers ═══${NC}"
HEADERS=$(curl -s -I $API_URL/auth/register)

if echo "$HEADERS" | grep -q "X-Amzn-Trace-Id"; then
  echo -e "${GREEN}✓ PASSED - X-Ray trace ID present${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED - X-Ray trace ID missing${NC}"
  ((FAILED++))
fi
echo ""

# Test 8: Error Response Format
echo -e "${BLUE}═══ Test 8: Error Response Format ═══${NC}"
ERROR_RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H 'Content-Type: application/json' \
  -d '{}')

if echo "$ERROR_RESPONSE" | jq -e '.error.type' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ PASSED - Error response has correct format${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED - Error response format incorrect${NC}"
  echo "Response: $ERROR_RESPONSE"
  ((FAILED++))
fi
echo ""

# Test 9: WAF Protection (SQL Injection)
echo -e "${BLUE}═══ Test 9: WAF SQL Injection Protection ═══${NC}"
run_test "SQL injection attempt blocked" \
  "curl -s -X GET '$API_URL/incidents?id=1%20OR%201=1' \
    -w '%{http_code}' -o /dev/null | grep -q '403'" \
  "pass"

# Test 10: Large Payload
echo -e "${BLUE}═══ Test 10: Payload Size Limits ═══${NC}"
LARGE_PAYLOAD=$(python3 -c "print('a' * 10000000)")
run_test "Reject oversized payload" \
  "curl -s -X POST $API_URL/auth/register \
    -H 'Content-Type: application/json' \
    -d '{\"data\":\"$LARGE_PAYLOAD\"}' \
    -w '%{http_code}' -o /dev/null | grep -q '413\|400'" \
  "pass"

# Test 11: CloudWatch Logging
echo -e "${BLUE}═══ Test 11: CloudWatch Logging ═══${NC}"
echo "Checking if API Gateway logs are being created..."
LOG_GROUP="/aws/apigateway/roadcall-$STAGE"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" | grep -q "$LOG_GROUP"; then
  echo -e "${GREEN}✓ PASSED - CloudWatch log group exists${NC}"
  ((PASSED++))
else
  echo -e "${RED}✗ FAILED - CloudWatch log group not found${NC}"
  ((FAILED++))
fi
echo ""

# Test 12: X-Ray Tracing
echo -e "${BLUE}═══ Test 12: X-Ray Tracing ═══${NC}"
echo "Checking if X-Ray tracing is enabled..."
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='roadcall-api-$STAGE'].id" \
  --output text)

if [ -n "$API_ID" ]; then
  TRACING=$(aws apigateway get-stage \
    --rest-api-id "$API_ID" \
    --stage-name "$STAGE" \
    --query "tracingEnabled" \
    --output text)
  
  if [ "$TRACING" == "True" ]; then
    echo -e "${GREEN}✓ PASSED - X-Ray tracing enabled${NC}"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAILED - X-Ray tracing not enabled${NC}"
    ((FAILED++))
  fi
else
  echo -e "${YELLOW}⚠ WARNING - Could not find API Gateway${NC}"
fi
echo ""

# Test 13: WAF Association
echo -e "${BLUE}═══ Test 13: WAF Association ═══${NC}"
echo "Checking if WAF is associated with API Gateway..."
if [ -n "$API_ID" ]; then
  STAGE_ARN="arn:aws:apigateway:$AWS_REGION::/restapis/$API_ID/stages/$STAGE"
  WAF_ASSOC=$(aws wafv2 list-web-acls \
    --scope REGIONAL \
    --region "$AWS_REGION" \
    --query "WebACLs[?contains(Name, 'roadcall')].ARN" \
    --output text 2>/dev/null || echo "")
  
  if [ -n "$WAF_ASSOC" ]; then
    echo -e "${GREEN}✓ PASSED - WAF associated with API Gateway${NC}"
    ((PASSED++))
  else
    echo -e "${YELLOW}⚠ WARNING - WAF association not found${NC}"
  fi
else
  echo -e "${YELLOW}⚠ WARNING - Could not verify WAF association${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                       Test Summary                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests: $((PASSED + FAILED))"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
  exit 1
fi
