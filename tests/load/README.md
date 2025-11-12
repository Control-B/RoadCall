# Load Testing for AI Roadcall Assistant

This directory contains load testing configurations and scripts using Artillery.

## Prerequisites

Install Artillery globally:

```bash
npm install -g artillery
```

## Test Configurations

### 1. Full Load Test (`artillery-config.yml`)

Comprehensive load test covering all major endpoints:
- Incident creation (40% of traffic)
- Vendor search (30% of traffic)
- Vendor profile retrieval (20% of traffic)
- Location updates (10% of traffic)

**Phases:**
1. Warm-up: 10 req/s for 60s
2. Ramp-up: 10 → 50 req/s over 120s
3. Sustained: 100 req/s for 300s
4. Peak: 200 req/s for 120s
5. Spike: 500 req/s for 60s
6. Cool down: 10 req/s for 60s

**Performance Thresholds:**
- Max error rate: 1%
- P95 latency: < 300ms
- P99 latency: < 500ms

### 2. Incident Load Test (`incident-load-test.yml`)

Focused test for incident creation and lifecycle:
- Tests 1000 concurrent incident creations
- Validates end-to-end incident flow
- Includes vendor matching simulation

**Phases:**
1. Warm-up: 10 req/s for 30s
2. Ramp-up: 100 → 1000 req/s over 60s
3. Sustained: 1000 req/s for 300s
4. Cool down: 10 req/s for 30s

**Performance Thresholds:**
- Max error rate: 2%
- P95 latency: < 5s
- P99 latency: < 10s

## Running Tests

### Quick Smoke Test

```bash
./run-load-test.sh dev quick
```

Runs a quick 1-minute smoke test with 10 concurrent users.

### Full Load Test

```bash
./run-load-test.sh staging full
```

Runs the complete load test suite against staging environment.

### Incident Load Test

```bash
./run-load-test.sh staging incidents
```

Runs the 1000 concurrent incidents test.

### Production Load Test

```bash
./run-load-test.sh prod full
```

⚠️ **Warning:** Only run against production during planned load testing windows.

## Environment Configuration

The test script supports three environments:
- `dev`: Development environment
- `staging`: Staging environment
- `prod`: Production environment

API URLs are configured in `run-load-test.sh`.

## Test Results

Results are saved to `./results/<timestamp>/`:
- `*.json`: Raw test results
- `report.html`: HTML report with charts and metrics

### Viewing Results

Open the HTML report in a browser:

```bash
open ./results/<timestamp>/report.html
```

## Custom Test Helpers

The `test-helpers.js` file provides utility functions:
- `randomString()`: Generate random strings
- `randomNumber(min, max)`: Generate random numbers
- `randomChoice(array)`: Pick random item from array
- `randomLat()`: Generate random latitude
- `randomLon()`: Generate random longitude
- `beforeScenario()`: Setup before each scenario
- `afterResponse()`: Log slow responses

## Performance Targets

Based on requirements 25.1, 25.2, 25.3:

| Metric | Target | Critical |
|--------|--------|----------|
| Incident creation P95 | < 300ms | < 500ms |
| Incident creation P99 | < 500ms | < 1s |
| Vendor matching | < 10s | < 15s |
| Location update propagation | < 2s | < 5s |
| API error rate | < 1% | < 5% |
| Concurrent incidents | 1000 | 500 |

## Monitoring During Tests

Monitor these metrics during load tests:

### CloudWatch Metrics
- Lambda concurrent executions
- DynamoDB consumed capacity
- API Gateway latency
- ElastiCache CPU utilization
- Aurora connections

### Custom Metrics
- Incident creation rate
- Vendor matching success rate
- Cache hit rate
- Database connection pool usage

## Troubleshooting

### High Error Rates

If error rates exceed thresholds:
1. Check CloudWatch logs for errors
2. Verify Lambda concurrency limits
3. Check DynamoDB throttling
4. Review API Gateway rate limits

### High Latency

If latency exceeds targets:
1. Check cache hit rates (Redis)
2. Review database query performance
3. Check Lambda cold starts
4. Verify network connectivity

### Connection Timeouts

If seeing connection timeouts:
1. Increase HTTP pool size in config
2. Check VPC NAT Gateway capacity
3. Verify security group rules
4. Review Lambda timeout settings

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Load Tests
  run: |
    cd tests/load
    ./run-load-test.sh staging full
  env:
    API_URL: ${{ secrets.STAGING_API_URL }}
```

## Best Practices

1. **Always warm up**: Start with low load to warm Lambda functions
2. **Gradual ramp-up**: Increase load gradually to avoid overwhelming the system
3. **Monitor continuously**: Watch CloudWatch metrics during tests
4. **Test in isolation**: Run load tests when other testing is minimal
5. **Document results**: Save and compare results over time
6. **Test realistic scenarios**: Use production-like data patterns

## Additional Resources

- [Artillery Documentation](https://www.artillery.io/docs)
- [AWS Lambda Performance](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
