# Disaster Recovery Quick Reference

## Emergency Contacts

- **On-Call Engineer**: [PagerDuty]
- **Platform Owner**: [Contact]
- **AWS TAM**: [Contact]
- **Emergency Hotline**: [Number]

## Quick Status Checks

### Check All Replication Status
```bash
# DynamoDB
aws dynamodb describe-table --table-name roadcall-incidents-prod --region us-east-1 --query 'Table.Replicas[].{Region:RegionName,Status:ReplicaStatus}'

# Aurora
aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name AuroraGlobalDBReplicationLag --dimensions Name=DBClusterIdentifier,Value=roadcall-aurora-prod-replica --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) --end-time $(date -u +%Y-%m-%dT%H:%M:%S) --period 60 --statistics Average --region us-west-2

# S3
aws s3api get-bucket-replication --bucket roadcall-call-recordings-prod-ACCOUNT_ID --region us-east-1
```

### Check Health Status
```bash
# Route 53 Health Check
aws route53 get-health-check-status --health-check-id HEALTH_CHECK_ID

# API Health
curl -X GET https://api.roadcall.example.com/health
curl -X GET https://api-us-west-2.roadcall.example.com/health
```

### Check Recent Backups
```bash
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name roadcall-backup-vault-prod \
  --region us-east-1 \
  --query 'RecoveryPoints[?CreationDate>=`'$(date -u -d '24 hours ago' +%Y-%m-%d)'`]'
```

## Emergency Failover (5-Step Process)

### 1. Promote Aurora (10 min)
```bash
aws rds promote-read-replica-db-cluster \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2

aws rds wait db-cluster-available \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2
```

### 2. Update DNS (5 min)
```bash
# Update Route 53 to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id HOSTED_ZONE_ID \
  --change-batch file://failover-dns-change.json
```

### 3. Deploy Services (20 min)
```bash
cd infrastructure
export AWS_REGION=us-west-2
pnpm cdk deploy --all --require-approval never --context stage=prod --context drMode=true
```

### 4. Verify (10 min)
```bash
# Test API
curl -X GET https://api-us-west-2.roadcall.example.com/health

# Check metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=roadcall-api-prod \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum \
  --region us-west-2
```

### 5. Communicate
- Update status page
- Notify customers
- Update incident ticket

## Common Issues

### Issue: High Replication Lag

**Symptoms**: Replication lag > 5 seconds

**Quick Fix**:
```bash
# Check for throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --start-time $(date -u -d '15 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum \
  --region us-east-1

# Increase capacity if needed
aws dynamodb update-table \
  --table-name roadcall-incidents-prod \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=1000,WriteCapacityUnits=500 \
  --region us-east-1
```

### Issue: Backup Failure

**Symptoms**: No backups in last 24 hours

**Quick Fix**:
```bash
# Check backup job status
aws backup list-backup-jobs \
  --by-backup-vault-name roadcall-backup-vault-prod \
  --by-created-after $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-east-1

# Manually trigger backup
aws backup start-backup-job \
  --backup-vault-name roadcall-backup-vault-prod \
  --resource-arn arn:aws:rds:us-east-1:ACCOUNT:cluster:roadcall-aurora-prod \
  --iam-role-arn arn:aws:iam::ACCOUNT:role/service-role/AWSBackupDefaultServiceRole \
  --region us-east-1
```

### Issue: Health Check Failing

**Symptoms**: Route 53 health check shows unhealthy

**Quick Fix**:
```bash
# Check API Gateway
aws apigateway get-rest-apis --region us-east-1

# Check Lambda functions
aws lambda list-functions --region us-east-1 --query 'Functions[?starts_with(FunctionName, `roadcall`)].FunctionName'

# Check recent errors
aws logs tail /aws/lambda/roadcall-incident-svc-prod --since 10m --region us-east-1
```

## Monitoring Dashboards

- **CloudWatch**: https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=roadcall-prod
- **X-Ray**: https://console.aws.amazon.com/xray/home?region=us-east-1
- **Route 53**: https://console.aws.amazon.com/route53/healthchecks/home
- **Backup**: https://console.aws.amazon.com/backup/home?region=us-east-1

## Key Metrics

| Metric | Target | Alarm Threshold |
|--------|--------|-----------------|
| RTO | 1 hour | N/A |
| RPO | 15 minutes | N/A |
| DynamoDB Replication Lag | < 1 second | > 5 seconds |
| Aurora Replication Lag | < 1 second | > 5 seconds |
| S3 Replication Latency | < 15 minutes | > 15 minutes |
| API P95 Latency | < 300ms | > 300ms |
| Error Rate | < 1% | > 5% |
| Backup Success Rate | 100% | < 100% |

## Scripts Location

All DR scripts are in `infrastructure/scripts/`:
- `configure-s3-replication.sh`
- `configure-dynamodb-global-tables.sh`
- `configure-aurora-replica.sh`

## Documentation

- **Full Runbook**: `DISASTER_RECOVERY_RUNBOOK.md`
- **Implementation Details**: `DISASTER_RECOVERY_IMPLEMENTATION.md`
- **Architecture Diagrams**: `design.md`

## Testing Schedule

- **Monthly**: Replication status check
- **Quarterly**: DR drill
- **Annually**: Full DR exercise

## Post-Incident Checklist

- [ ] Document timeline
- [ ] Identify root cause
- [ ] Measure actual RTO/RPO
- [ ] Update runbook
- [ ] Conduct team review
- [ ] Implement improvements

---

**Last Updated**: [Date]
**Next Review**: [Date]
**Owner**: [Name]
