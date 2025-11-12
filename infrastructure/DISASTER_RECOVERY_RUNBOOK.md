# Disaster Recovery Runbook

## Overview

This runbook provides step-by-step procedures for disaster recovery (DR) operations for the AI Roadcall Assistant platform. The platform uses a multi-region architecture with primary operations in `us-east-1` and disaster recovery in `us-west-2`.

## Architecture Summary

### Primary Region: us-east-1
- All active services and databases
- DynamoDB Global Tables (primary)
- Aurora Postgres cluster (primary)
- S3 buckets with cross-region replication
- API Gateway and Lambda functions

### DR Region: us-west-2
- DynamoDB Global Tables (replica)
- Aurora read replica
- S3 replica buckets
- Standby infrastructure (can be activated)

## Recovery Objectives

- **RTO (Recovery Time Objective)**: 1 hour
- **RPO (Recovery Point Objective)**: 15 minutes

## Pre-Disaster Preparation

### 1. Verify Replication Status

#### DynamoDB Global Tables
```bash
# Check replication status for all tables
for table in users incidents vendors tracking-sessions call-records; do
  echo "Checking roadcall-$table-prod..."
  aws dynamodb describe-table \
    --table-name "roadcall-$table-prod" \
    --region us-east-1 \
    --query 'Table.Replicas[].{Region:RegionName,Status:ReplicaStatus}'
done
```

Expected output: All replicas should show `ACTIVE` status.

#### Aurora Replication
```bash
# Check Aurora replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=roadcall-aurora-prod-replica \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-west-2
```

Expected: Replication lag should be < 1 second under normal conditions.

#### S3 Replication
```bash
# Check S3 replication metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/S3 \
  --metric-name ReplicationLatency \
  --dimensions Name=SourceBucket,Value=roadcall-call-recordings-prod-ACCOUNT_ID \
               Name=DestinationBucket,Value=roadcall-call-recordings-prod-us-west-2-ACCOUNT_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Maximum \
  --region us-east-1
```

### 2. Verify Backup Status

```bash
# List recent backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name roadcall-backup-vault-prod \
  --region us-east-1 \
  --query 'RecoveryPoints[?CreationDate>=`'$(date -u -d '24 hours ago' +%Y-%m-%d)'`]'
```

### 3. Test Health Checks

```bash
# Check Route 53 health check status
aws route53 get-health-check-status \
  --health-check-id HEALTH_CHECK_ID \
  --query 'HealthCheckObservations[*].{Region:Region,Status:StatusReport.Status}'
```

## Disaster Scenarios

### Scenario 1: Primary Region Complete Outage

#### Detection
- Route 53 health checks fail
- CloudWatch alarms trigger
- API Gateway returns 503 errors
- Unable to connect to primary region services

#### Response Procedure

**Step 1: Assess the Situation (5 minutes)**
```bash
# Check AWS Service Health Dashboard
open https://health.aws.amazon.com/health/status

# Check primary region services
aws ec2 describe-regions --region us-east-1 2>&1 || echo "Primary region unreachable"

# Verify DR region is healthy
aws ec2 describe-regions --region us-west-2
```

**Step 2: Activate Incident Response Team (5 minutes)**
- Notify on-call engineer
- Notify platform owner
- Notify customer support team
- Create incident ticket

**Step 3: Promote Aurora Read Replica (10 minutes)**
```bash
# Promote Aurora replica to standalone cluster
aws rds promote-read-replica-db-cluster \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2

# Wait for promotion to complete
aws rds wait db-cluster-available \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2

# Verify cluster is writable
aws rds describe-db-clusters \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2 \
  --query 'DBClusters[0].Status'
```

**Step 4: Update DNS for Failover (5 minutes)**
```bash
# Update Route 53 to point to DR region
# This assumes you have a failover routing policy configured

# Manually update if needed:
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch file://failover-dns-change.json

# failover-dns-change.json:
# {
#   "Changes": [{
#     "Action": "UPSERT",
#     "ResourceRecordSet": {
#       "Name": "api.roadcall.example.com",
#       "Type": "A",
#       "SetIdentifier": "DR-Region",
#       "Failover": "SECONDARY",
#       "AliasTarget": {
#         "HostedZoneId": "API_GATEWAY_HOSTED_ZONE_ID",
#         "DNSName": "api-us-west-2.execute-api.us-west-2.amazonaws.com",
#         "EvaluateTargetHealth": true
#       }
#     }
#   }]
# }
```

**Step 5: Deploy Services to DR Region (20 minutes)**
```bash
# Deploy CDK stacks to DR region
cd infrastructure

# Set environment variables
export AWS_REGION=us-west-2
export STAGE=prod

# Deploy core stacks
pnpm cdk deploy \
  --all \
  --require-approval never \
  --region us-west-2 \
  --context stage=prod \
  --context drMode=true
```

**Step 6: Verify Services (10 minutes)**
```bash
# Test API endpoints
curl -X GET https://api-us-west-2.roadcall.example.com/health

# Check Lambda functions
aws lambda list-functions \
  --region us-west-2 \
  --query 'Functions[?starts_with(FunctionName, `roadcall`)].FunctionName'

# Verify DynamoDB access
aws dynamodb scan \
  --table-name roadcall-users-prod \
  --region us-west-2 \
  --limit 1

# Test database connection
psql -h <aurora-replica-endpoint> -U postgres -d roadcall -c "SELECT 1;"
```

**Step 7: Monitor and Validate (10 minutes)**
```bash
# Check CloudWatch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=roadcall-api-prod \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region us-west-2

# Check error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name 5XXError \
  --dimensions Name=ApiName,Value=roadcall-api-prod \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region us-west-2
```

**Step 8: Communicate Status**
- Update status page
- Notify customers via email/SMS
- Post updates to social media
- Update incident ticket

### Scenario 2: Partial Service Degradation

#### Detection
- Increased error rates in CloudWatch
- Elevated API latency
- Some services responding, others failing

#### Response Procedure

**Step 1: Identify Affected Services (5 minutes)**
```bash
# Check service health
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# Check DynamoDB throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1
```

**Step 2: Implement Circuit Breakers**
- Circuit breakers should automatically activate
- Verify fallback mechanisms are working
- Check degraded mode functionality

**Step 3: Scale Resources if Needed**
```bash
# Increase Lambda concurrency
aws lambda put-function-concurrency \
  --function-name roadcall-incident-svc-prod \
  --reserved-concurrent-executions 500 \
  --region us-east-1

# Switch DynamoDB to provisioned capacity if needed
aws dynamodb update-table \
  --table-name roadcall-incidents-prod \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=1000,WriteCapacityUnits=500 \
  --region us-east-1
```

**Step 4: Monitor Recovery**
- Watch CloudWatch metrics
- Check error rates decrease
- Verify latency returns to normal

### Scenario 3: Data Corruption or Loss

#### Detection
- Reports of incorrect data
- Database integrity check failures
- Unexpected data patterns

#### Response Procedure

**Step 1: Stop Writes (Immediate)**
```bash
# Disable write operations by updating API Gateway
# This prevents further corruption

# Option 1: Throttle API Gateway
aws apigateway update-stage \
  --rest-api-id API_ID \
  --stage-name prod \
  --patch-operations op=replace,path=/throttle/rateLimit,value=0 \
  --region us-east-1

# Option 2: Update Lambda environment to read-only mode
aws lambda update-function-configuration \
  --function-name roadcall-incident-svc-prod \
  --environment Variables={READ_ONLY_MODE=true} \
  --region us-east-1
```

**Step 2: Assess Damage (15 minutes)**
```bash
# Identify affected data
# Run data integrity checks
# Determine scope of corruption

# Check DynamoDB point-in-time recovery
aws dynamodb describe-continuous-backups \
  --table-name roadcall-incidents-prod \
  --region us-east-1
```

**Step 3: Restore from Backup (30 minutes)**
```bash
# For DynamoDB: Point-in-time recovery
aws dynamodb restore-table-to-point-in-time \
  --source-table-name roadcall-incidents-prod \
  --target-table-name roadcall-incidents-prod-restored \
  --restore-date-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-east-1

# For Aurora: Restore from snapshot
aws rds restore-db-cluster-to-point-in-time \
  --db-cluster-identifier roadcall-aurora-prod-restored \
  --source-db-cluster-identifier roadcall-aurora-prod \
  --restore-to-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-east-1
```

**Step 4: Validate Restored Data**
- Run data integrity checks
- Compare with known good state
- Verify critical records

**Step 5: Cutover to Restored Resources**
```bash
# Update application configuration to use restored tables
# Update connection strings
# Restart services
```

## Recovery Validation Checklist

After any disaster recovery procedure, validate the following:

### Functional Tests
- [ ] User authentication works
- [ ] Incident creation succeeds
- [ ] Vendor matching operates correctly
- [ ] Real-time tracking functions
- [ ] Notifications are delivered
- [ ] Payments can be processed
- [ ] API endpoints respond correctly

### Data Integrity
- [ ] Recent incidents are present
- [ ] User accounts are accessible
- [ ] Vendor profiles are correct
- [ ] No data loss beyond RPO
- [ ] Relationships between entities are intact

### Performance
- [ ] API latency is within SLA (P95 < 300ms)
- [ ] Database queries perform normally
- [ ] No throttling or capacity issues
- [ ] Real-time updates work correctly

### Monitoring
- [ ] CloudWatch metrics are being collected
- [ ] Alarms are configured and active
- [ ] Logs are being written
- [ ] X-Ray traces are visible

## Failback Procedure

When the primary region is restored:

**Step 1: Verify Primary Region Health (15 minutes)**
```bash
# Check all services are operational
# Verify data replication is working
# Confirm no ongoing issues
```

**Step 2: Sync Data from DR to Primary (30 minutes)**
```bash
# For DynamoDB Global Tables, replication is automatic
# Verify replication lag is minimal

# For Aurora, you may need to:
# 1. Take a snapshot of the promoted DR cluster
# 2. Restore to primary region
# 3. Re-establish replication
```

**Step 3: Update DNS to Primary Region (5 minutes)**
```bash
# Update Route 53 to point back to primary region
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch file://failback-dns-change.json
```

**Step 4: Monitor Failback (15 minutes)**
- Watch for errors
- Verify traffic is flowing to primary
- Check replication is re-established

**Step 5: Decommission DR Active Resources**
```bash
# Scale down or terminate DR resources that were activated
# Keep replication running
```

## Testing and Drills

### Monthly DR Test
- Verify replication status
- Test backup restoration
- Review runbook updates
- Update contact information

### Quarterly DR Drill
- Simulate primary region failure
- Execute failover procedure
- Measure RTO/RPO
- Document lessons learned
- Update runbook

### Annual Full DR Exercise
- Complete failover to DR region
- Run production traffic through DR
- Validate all services
- Execute failback
- Comprehensive review

## Contact Information

### Incident Response Team
- On-Call Engineer: [PagerDuty rotation]
- Platform Owner: [Email/Phone]
- DevOps Lead: [Email/Phone]
- CTO: [Email/Phone]

### AWS Support
- Support Plan: Enterprise
- TAM: [Name/Email/Phone]
- Support Case Portal: https://console.aws.amazon.com/support/

### Vendor Contacts
- Stripe Support: [Contact info]
- Twilio Support: [Contact info]

## Post-Incident Review

After any DR event, conduct a post-incident review:

1. **Timeline**: Document what happened and when
2. **Root Cause**: Identify the cause of the incident
3. **Response**: Evaluate the effectiveness of the response
4. **Impact**: Quantify the impact on customers and business
5. **Lessons Learned**: What went well, what didn't
6. **Action Items**: Improvements to prevent recurrence
7. **Runbook Updates**: Update this document based on learnings

## Appendix

### Useful Commands

#### Check Service Status
```bash
# API Gateway
aws apigateway get-rest-apis --region REGION

# Lambda Functions
aws lambda list-functions --region REGION

# DynamoDB Tables
aws dynamodb list-tables --region REGION

# RDS Clusters
aws rds describe-db-clusters --region REGION
```

#### Emergency Contacts
```bash
# Send SNS alert
aws sns publish \
  --topic-arn arn:aws:sns:REGION:ACCOUNT:roadcall-prod-alarms \
  --subject "DR Event: [DESCRIPTION]" \
  --message "Disaster recovery event in progress. Details: [DETAILS]"
```

### Automation Scripts

All DR automation scripts are located in `infrastructure/scripts/`:
- `configure-s3-replication.sh` - Set up S3 cross-region replication
- `configure-dynamodb-global-tables.sh` - Enable DynamoDB Global Tables
- `configure-aurora-replica.sh` - Create Aurora read replica

### Monitoring Dashboards

- CloudWatch Dashboard: `roadcall-prod`
- X-Ray Service Map: https://console.aws.amazon.com/xray/
- Route 53 Health Checks: https://console.aws.amazon.com/route53/healthchecks/

### Documentation Links

- AWS Disaster Recovery: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/
- DynamoDB Global Tables: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html
- Aurora Global Database: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html
- S3 Replication: https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html
