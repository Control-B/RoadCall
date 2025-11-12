#!/bin/bash

# Verification script for performance optimization implementation
# Checks that all components are properly configured

set -e

echo "=== Performance Stack Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0

# Check infrastructure files
echo "Checking infrastructure files..."
if [ -f "infrastructure/lib/performance-stack.ts" ]; then
    echo -e "${GREEN}✓${NC} performance-stack.ts exists"
else
    echo -e "${RED}✗${NC} performance-stack.ts missing"
    ERRORS=$((ERRORS + 1))
fi

# Check utility files
echo ""
echo "Checking utility files..."
FILES=(
    "packages/utils/src/cache/redis-client.ts"
    "packages/utils/src/cache/vendor-cache.ts"
    "packages/utils/src/database/aurora-pool.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $(basename $file) exists"
    else
        echo -e "${RED}✗${NC} $file missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check service integration
echo ""
echo "Checking service integration..."
if [ -f "services/vendor-svc/src/cache-service.ts" ]; then
    echo -e "${GREEN}✓${NC} vendor-svc cache integration exists"
else
    echo -e "${RED}✗${NC} vendor-svc cache integration missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "services/payments-svc/src/database.ts" ]; then
    echo -e "${GREEN}✓${NC} payments-svc database integration exists"
else
    echo -e "${RED}✗${NC} payments-svc database integration missing"
    ERRORS=$((ERRORS + 1))
fi

# Check load test files
echo ""
echo "Checking load test files..."
LOAD_TEST_FILES=(
    "tests/load/artillery-config.yml"
    "tests/load/incident-load-test.yml"
    "tests/load/test-helpers.js"
    "tests/load/run-load-test.sh"
    "tests/load/setup.sh"
    "tests/load/package.json"
    "tests/load/README.md"
)

for file in "${LOAD_TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $(basename $file) exists"
    else
        echo -e "${RED}✗${NC} $file missing"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check documentation
echo ""
echo "Checking documentation..."
if [ -f "PERFORMANCE_OPTIMIZATION.md" ]; then
    echo -e "${GREEN}✓${NC} PERFORMANCE_OPTIMIZATION.md exists"
else
    echo -e "${RED}✗${NC} PERFORMANCE_OPTIMIZATION.md missing"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "TASK_35_IMPLEMENTATION_SUMMARY.md" ]; then
    echo -e "${GREEN}✓${NC} TASK_35_IMPLEMENTATION_SUMMARY.md exists"
else
    echo -e "${RED}✗${NC} TASK_35_IMPLEMENTATION_SUMMARY.md missing"
    ERRORS=$((ERRORS + 1))
fi

# Check package.json dependencies
echo ""
echo "Checking dependencies..."
if grep -q '"redis"' packages/utils/package.json; then
    echo -e "${GREEN}✓${NC} redis dependency added"
else
    echo -e "${RED}✗${NC} redis dependency missing"
    ERRORS=$((ERRORS + 1))
fi

if grep -q '"pg"' packages/utils/package.json; then
    echo -e "${GREEN}✓${NC} pg dependency added"
else
    echo -e "${RED}✗${NC} pg dependency missing"
    ERRORS=$((ERRORS + 1))
fi

# Build check
echo ""
echo "Running build check..."
if pnpm --filter @roadcall/utils build > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Utils package builds successfully"
else
    echo -e "${RED}✗${NC} Utils package build failed"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "==================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Performance optimization implementation is complete."
    echo ""
    echo "Next steps:"
    echo "1. Deploy infrastructure: cd infrastructure && pnpm cdk deploy PerformanceStack"
    echo "2. Run load tests: cd tests/load && ./setup.sh && ./run-load-test.sh dev quick"
    echo "3. Monitor metrics in CloudWatch"
    exit 0
else
    echo -e "${RED}✗ $ERRORS check(s) failed${NC}"
    echo ""
    echo "Please review the errors above and fix any missing components."
    exit 1
fi
