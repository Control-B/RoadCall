# AI Roadcall Assistant - System Testing Guide

## Overview

This document provides comprehensive guidance for executing system-level integration tests for the AI Roadcall Assistant platform. These tests validate the complete system functionality, including end-to-end workflows, event flows, disaster recovery, security controls, performance, and compliance.

## Test Coverage

### 1. Complete Incident Flow Test (`complete-incident-flow.test.ts`)
**Purpose**: Validates the entire incident lifecycle from creation to payment closure.

**Test Scenarios**:
- Incident creation via API
- EventBridge event publishing (IncidentCreated)
- Vendor matching and offer distribution
- Offer acceptance by vendor
- Real-time location tracking
- Vendor arrival detection via geofencing
- Work completion and documentation
- Payment approval workflow
- Incident closure

**Requirements Covered**: All requirements (1-25)

**Expected Duration**: ~60 seconds per test

### 2. EventBridge Event Flows Test (`eventbridge-flows.test.ts`)
**Purpose**: Verifies all EventBridge event flows and subscriptions work correctly.

**Test Scenarios**:
- Event publishing for all domain events
- Event routing rules configuration
- Event delivery to SQS queues
- Dead-letter queue configuration
- Retry policies
- Event schema validation

**Requirements Covered**: 2.3, 7.2, 22.1, 22.2, 22.3

**Expected Duration**: ~30 seconds per test

### 3. Disaster Recovery Test (`disaster-recovery.test.ts`)
**Purpose**: Tests failover scenarios and disaster recovery procedures.

**Test Scenarios**:
- Multi-AZ deployment verification
- DynamoDB Global Tables replication
- Aurora cross-region read replicas
- S3 cross-region replication
- Route 53 health checks
- Automated failover within RTO
- Backup and recovery procedures
- Data consistency across regions

**Requirements Covered**: 15.1, 15.2, 15.3, 15.4, 15.5

**Expected Duration**: ~45 seconds per test

### 4. Security Validation Test (`security-validation.test.ts`)
**Purpose**: Validates authentication, authorization, and encryption controls.

**Test Scenarios**:
- OTP validation and expiry
- Rate limiting enforcement
- JWT token validation
- Role-based access control (RBAC)
- Resource-level authorization
- KMS encryption verification
- Secrets Manager integration
- Input validation and sanitization
- API rate limiting
- IAM least-privilege policies

**Requirements Covered**: 1.1-1.5, 12.1-12.5, 13.1-13.5, 14.1-14.5, 18.1-18.5

**Expected Duration**: ~40 seconds per test

### 5. Performance and SLA Test (`performance-sla.test.ts`)
**Purpose**: Validates system performance under load and SLA targets.

**Test Scenarios**:
- API P95 latency < 300ms
- API P99 latency < 500ms
- Vendor matching within 10 seconds
- 100 concurrent incident creations
- 1000 concurrent incidents without degradation
- 10,000 location updates per minute
- Location update propagation < 2 seconds
- Database query throughput
- Caching effectiveness

**Requirements Covered**: 25.1, 25.2, 25.3, 25.4, 25.5

**Expected Duration**: ~2 minutes per test (includes load testing)

### 6. Audit and Compliance Test (`audit-compliance.test.ts`)
**Purpose**: Validates audit logging and compliance features.

**Test Scenarios**:
- CloudWatch structured logging
- CloudTrail audit trail
- PII access logging
- Data retention policies
- GDPR compliance (data export, deletion, consent)
- Payment audit trail
- State transition logging
- Configuration change audit

**Requirements Covered**: 11.1, 11.2, 11.3, 11.4, 11.5, 20.1-20.5

**Expected Duration**: ~35 seconds per test

## Prerequisites

### Required Tools
- Node.js 20.x or higher
- pnpm 8.x or higher
- AWS CLI configured with appropriate credentials
- Access to test AWS environment

### Environment Variables

Create a `.env.test` file with the following variables:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# API Configuration
API_URL=https://api-test.roadcall.example.com

# DynamoDB Tables
INCIDENTS_TABLE=Incidents-test
VENDORS_TABLE=Vendors-test
OFFERS_TABLE=Offers-test
TRACKING_SESSIONS_TABLE=TrackingSessions-test

# EventBridge
EVENT_BUS_NAME=roadcall-events-test

# Aurora
AURORA_CLUSTER_ID=roadcall-aurora-test

# S3 Buckets
CALL_RECORDINGS_BUCKET=roadcall-call-recordings-test
KB_DOCUMENTS_BUCKET=roadcall-kb-documents-test
INCIDENT_MEDIA_BUCKET=roadcall-incident-media-test
LOG_BUCKET_NAME=roadcall-logs-test

# KMS Keys
DYNAMODB_KMS_KEY_ID=alias/roadcall-dynamodb-test
S3_KMS_KEY_ID=alias/roadcall-s3-test

# Secrets Manager
DB_SECRET_NAME=roadcall-aurora-credentials-test

# Disaster Recovery
PRIMARY_REGION=us-east-1
DR_REGION=us-west-2

# Testing
TEST_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/test-queue
```

## Running Tests

### Run All Tests

```bash
./tests/run-system-tests.sh dev
```

### Run Specific Test Suite

```bash
# Complete incident flow
pnpm jest tests/integration/complete-incident-flow.test.ts --config tests/jest.config.integration.js

# EventBridge flows
pnpm jest tests/integration/eventbridge-flows.test.ts --config tests/jest.config.integration.js

# Disaster recovery
pnpm jest tests/integration/disaster-recovery.test.ts --config tests/jest.config.integration.js

# Security validation
pnpm jest tests/integration/security-validation.test.ts --config tests/jest.config.integration.js

# Performance and SLA
pnpm jest tests/load/performance-sla.test.ts --config tests/jest.config.integration.js

# Audit and compliance
pnpm jest tests/integration/audit-compliance.test.ts --config tests/jest.config.integration.js
```

### Skip Load Tests

```bash
SKIP_LOAD_TESTS=true ./tests/run-system-tests.sh dev
```

### Skip Security Tests

```bash
SKIP_SECURITY_TESTS=true ./tests/run-system-tests.sh dev
```

### Run with Debug Output

```bash
DEBUG=true ./tests/run-system-tests.sh dev
```

## Test Environments

### Development (dev)
- Used for active development and testing
- May have unstable data
- Faster feedback loop

### Staging (staging)
- Pre-production environment
- Mirrors production configuration
- Used for final validation before deployment

### Production (prod)
- **DO NOT run destructive tests in production**
- Only run read-only validation tests
- Use with extreme caution

## Interpreting Results

### Success Criteria

All tests should pass with the following metrics:

1. **Complete Incident Flow**: All 17 steps complete successfully
2. **EventBridge Flows**: All events published and routed correctly
3. **Disaster Recovery**: RTO < 1 hour, RPO < 15 minutes
4. **Security**: All authentication, authorization, and encryption checks pass
5. **Performance**: 
   - P95 latency < 300ms
   - P99 latency < 500ms
   - 95%+ success rate under load
6. **Audit & Compliance**: All logging and retention policies verified

### Common Failures

#### Timeout Errors
- **Cause**: Services not responding within expected time
- **Solution**: Check service health, increase timeout, or investigate performance issues

#### Authentication Errors
- **Cause**: Invalid or expired credentials
- **Solution**: Refresh AWS credentials, verify IAM permissions

#### Resource Not Found
- **Cause**: Missing infrastructure resources
- **Solution**: Deploy infrastructure using CDK, verify resource names

#### Rate Limiting
- **Cause**: Too many requests in short time
- **Solution**: Implement exponential backoff, reduce test concurrency

## Coverage Reports

After running tests, coverage reports are generated in `tests/coverage/`:

```bash
# View coverage report
open tests/coverage/index.html
```

Target coverage: 80% for all services

## Continuous Integration

### GitHub Actions Integration

The test suite is integrated with GitHub Actions for automated testing on:
- Pull requests
- Merges to main branch
- Release branches

See `.github/workflows/test.yml` for configuration.

### Pre-deployment Validation

Before deploying to production:

1. Run full test suite in staging environment
2. Verify all tests pass
3. Review coverage reports
4. Check performance metrics
5. Validate security controls
6. Approve deployment

## Troubleshooting

### Test Failures

1. **Check AWS credentials**: `aws sts get-caller-identity`
2. **Verify infrastructure**: `aws cloudformation list-stacks`
3. **Check service health**: `aws lambda list-functions`
4. **Review logs**: `aws logs tail /aws/lambda/incident-handler --follow`

### Performance Issues

1. Check CloudWatch metrics
2. Review X-Ray traces
3. Analyze DynamoDB throttling
4. Check Lambda cold starts
5. Verify caching effectiveness

### Security Test Failures

1. Verify IAM policies
2. Check KMS key permissions
3. Validate Secrets Manager access
4. Review security group rules
5. Check WAF configuration

## Best Practices

1. **Run tests in isolated environment**: Use dedicated test AWS account
2. **Clean up test data**: Implement teardown procedures
3. **Use realistic test data**: Mirror production data patterns
4. **Monitor test execution**: Track test duration and failure rates
5. **Keep tests updated**: Update tests when requirements change
6. **Document failures**: Create issues for persistent failures
7. **Review regularly**: Conduct weekly test review sessions

## Support

For questions or issues with testing:

- Create an issue in the repository
- Contact the DevOps team
- Review test logs in CloudWatch
- Check the troubleshooting guide above

## Appendix

### Test Data Cleanup

```bash
# Clean up test incidents
aws dynamodb scan --table-name Incidents-test \
  --filter-expression "begins_with(incidentId, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"test-"}}' \
  | jq -r '.Items[].incidentId.S' \
  | xargs -I {} aws dynamodb delete-item --table-name Incidents-test --key '{"incidentId":{"S":"{}"}}'
```

### Performance Benchmarks

| Metric | Target | Acceptable | Critical |
|--------|--------|------------|----------|
| API P95 Latency | < 200ms | < 300ms | > 500ms |
| API P99 Latency | < 300ms | < 500ms | > 1000ms |
| Incident Creation | < 3s | < 5s | > 10s |
| Vendor Matching | < 5s | < 10s | > 20s |
| Location Update | < 1s | < 2s | > 5s |

### Security Checklist

- [ ] All API endpoints require authentication
- [ ] JWT tokens expire within 15 minutes
- [ ] Rate limiting enforced on all endpoints
- [ ] PII encrypted at rest with KMS
- [ ] TLS 1.3 enforced for all connections
- [ ] Secrets stored in Secrets Manager
- [ ] IAM policies follow least-privilege
- [ ] Input validation on all user inputs
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
