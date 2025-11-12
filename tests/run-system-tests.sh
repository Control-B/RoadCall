#!/bin/bash

###############################################################################
# System Test Runner Script
# Executes all integration and system tests for the AI Roadcall Assistant
# Requirements: Task 37 - Final integration and system testing
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-dev}
SKIP_LOAD_TESTS=${SKIP_LOAD_TESTS:-false}
SKIP_SECURITY_TESTS=${SKIP_SECURITY_TESTS:-false}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}AI Roadcall Assistant - System Tests${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}Error: pnpm is not installed${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Load environment variables
if [ -f ".env.${ENVIRONMENT}" ]; then
    echo -e "${YELLOW}Loading environment variables from .env.${ENVIRONMENT}${NC}"
    export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: .env.${ENVIRONMENT} not found, using defaults${NC}"
fi

# Set test environment variables
export NODE_ENV=test
export AWS_REGION=${AWS_REGION:-us-east-1}
export API_URL=${API_URL:-https://api-${ENVIRONMENT}.roadcall.example.com}

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pnpm install --frozen-lockfile
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Run test suites
TEST_RESULTS=()

# 1. Complete Incident Flow Test
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}1. Complete Incident Flow Test${NC}"
echo -e "${BLUE}========================================${NC}"
if pnpm jest tests/integration/complete-incident-flow.test.ts --config tests/jest.config.integration.js; then
    echo -e "${GREEN}✓ Complete incident flow test passed${NC}"
    TEST_RESULTS+=("PASS: Complete Incident Flow")
else
    echo -e "${RED}✗ Complete incident flow test failed${NC}"
    TEST_RESULTS+=("FAIL: Complete Incident Flow")
fi
echo ""

# 2. EventBridge Flows Test
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}2. EventBridge Event Flows Test${NC}"
echo -e "${BLUE}========================================${NC}"
if pnpm jest tests/integration/eventbridge-flows.test.ts --config tests/jest.config.integration.js; then
    echo -e "${GREEN}✓ EventBridge flows test passed${NC}"
    TEST_RESULTS+=("PASS: EventBridge Flows")
else
    echo -e "${RED}✗ EventBridge flows test failed${NC}"
    TEST_RESULTS+=("FAIL: EventBridge Flows")
fi
echo ""

# 3. Disaster Recovery Test
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}3. Disaster Recovery and Failover Test${NC}"
echo -e "${BLUE}========================================${NC}"
if pnpm jest tests/integration/disaster-recovery.test.ts --config tests/jest.config.integration.js; then
    echo -e "${GREEN}✓ Disaster recovery test passed${NC}"
    TEST_RESULTS+=("PASS: Disaster Recovery")
else
    echo -e "${RED}✗ Disaster recovery test failed${NC}"
    TEST_RESULTS+=("FAIL: Disaster Recovery")
fi
echo ""

# 4. Security Validation Test
if [ "$SKIP_SECURITY_TESTS" != "true" ]; then
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}4. Security Controls Validation Test${NC}"
    echo -e "${BLUE}========================================${NC}"
    if pnpm jest tests/integration/security-validation.test.ts --config tests/jest.config.integration.js; then
        echo -e "${GREEN}✓ Security validation test passed${NC}"
        TEST_RESULTS+=("PASS: Security Validation")
    else
        echo -e "${RED}✗ Security validation test failed${NC}"
        TEST_RESULTS+=("FAIL: Security Validation")
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping security tests (SKIP_SECURITY_TESTS=true)${NC}"
    TEST_RESULTS+=("SKIP: Security Validation")
    echo ""
fi

# 5. Performance and SLA Test
if [ "$SKIP_LOAD_TESTS" != "true" ]; then
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}5. Performance and SLA Validation Test${NC}"
    echo -e "${BLUE}========================================${NC}"
    if pnpm jest tests/load/performance-sla.test.ts --config tests/jest.config.integration.js; then
        echo -e "${GREEN}✓ Performance test passed${NC}"
        TEST_RESULTS+=("PASS: Performance & SLA")
    else
        echo -e "${RED}✗ Performance test failed${NC}"
        TEST_RESULTS+=("FAIL: Performance & SLA")
    fi
    echo ""
else
    echo -e "${YELLOW}Skipping load tests (SKIP_LOAD_TESTS=true)${NC}"
    TEST_RESULTS+=("SKIP: Performance & SLA")
    echo ""
fi

# 6. Audit and Compliance Test
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}6. Audit Logging and Compliance Test${NC}"
echo -e "${BLUE}========================================${NC}"
if pnpm jest tests/integration/audit-compliance.test.ts --config tests/jest.config.integration.js; then
    echo -e "${GREEN}✓ Audit and compliance test passed${NC}"
    TEST_RESULTS+=("PASS: Audit & Compliance")
else
    echo -e "${RED}✗ Audit and compliance test failed${NC}"
    TEST_RESULTS+=("FAIL: Audit & Compliance")
fi
echo ""

# Generate test report
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for result in "${TEST_RESULTS[@]}"; do
    if [[ $result == PASS:* ]]; then
        echo -e "${GREEN}✓ ${result#PASS: }${NC}"
        ((PASS_COUNT++))
    elif [[ $result == FAIL:* ]]; then
        echo -e "${RED}✗ ${result#FAIL: }${NC}"
        ((FAIL_COUNT++))
    else
        echo -e "${YELLOW}⊘ ${result#SKIP: }${NC}"
        ((SKIP_COUNT++))
    fi
done

echo ""
echo -e "${BLUE}Total: ${#TEST_RESULTS[@]} test suites${NC}"
echo -e "${GREEN}Passed: ${PASS_COUNT}${NC}"
echo -e "${RED}Failed: ${FAIL_COUNT}${NC}"
echo -e "${YELLOW}Skipped: ${SKIP_COUNT}${NC}"
echo ""

# Generate coverage report
if [ -d "tests/coverage" ]; then
    echo -e "${YELLOW}Generating coverage report...${NC}"
    echo -e "${GREEN}Coverage report available at: tests/coverage/index.html${NC}"
    echo ""
fi

# Exit with appropriate code
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}System tests FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
else
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}All system tests PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
fi
