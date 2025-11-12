# Disaster Recovery Setup Guide

## Overview

This guide walks you through setting up disaster recovery for the AI Roadcall Assistant platform. The DR implementation provides:

- **RTO**: 1 hour (Recovery Time Objective)
- **RPO**: 15 minutes (Recovery Point Objective)
- **Multi-region**: Primary in us-east-1, DR in us-west-2
- **Multi-AZ**: High availability within each region
- **Automated backups**: Daily, weekly, and monthly with verification
- **Continuous replication**: DynamoDB, Aurora, and S3

## Prerequisites

- AWS CLI configured with appropriate credentials
- CDK deployed to primary region (us-east-1)
- Production stage (`stage=prod`)
- Appropriate IAM permissions for:
  - DynamoDB Global Tables
  - RDS cross-region replication
  - S3 replication
  - Route 53 health checks
  - AWS Backup

## Quick Start

### 1. Deploy Primary Infrastructure

```bash
cd infrastructure

# Deploy all stacks to primary region
pnpm cdk deploy --all \
  --context stage=prod \
  --region us-east-1 \
  --require-approval never
```

### 2. Configure DynamoDB Global Tables

```bash
# Enable cross-region replication for critical tables
./scripts/configure-dynamodb-global-tables.sh prod us-east-1 us-west-2
```

This will:
- Enable streams on all tables (required for global tables)
- Create replicas in us-west-2
- Configure bidirectional replication

**Expected time**: 5-10 minutes per table

### 3. Create Aurora Read Replica

```bash
# Create cross-region read replica
./scripts/configure-aurora-replica.sh prod us-east-1 us-west-2
```

This will:
- Create a read replica cluster in us-west-2
- Add a reader instance to the replica
- Configure replication from primary

**Expected time**: 15-20 minutes

### 4. Configure S3 Replication

```bash
# Enable cross-region replication for S3 buckets
./scripts/configure-s3-replication.sh prod us-east-1 us-west-2
```

This will:
- Enable versioning on source buckets
- Create IAM role for replication
- Configure replication rules
- Enable Replication Time Control (15-minute SLA)

**Expected time**: 5 minutes

### 5. Verify Setup

```bash
# Check DynamoDB replication
aws dynamodb describe-table \
  --table-name roadcall-incidents-prod \
  --region us-east-1 \
  --query 'Table.Replicas'

# Check Aurora replica
aws rds describe-db-clusters \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2 \
  --query 'DBClusters[0].Status'

# Check S3 replication
aws s3api get-bucket-replication \
  --bucket roadcall-call-recordings-prod-$(aws sts get-caller-identity --query Account --output text) \
  --region us-east-1

# Check backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name roadcall-backup-vault-prod \
  --region us-east-1 \
  --max-results 5
```

## Configuration Details

### DynamoDB Global Tables

**Tables with replication**:
- roadcall-users-prod
- roadcall-incidents-prod
- roadcall-vendors-prod
- roadcall-tracking-sessions-prod
- roadcall-call-records-prod

**Features**:
- Automatic bidirectional replication
- Last-writer-wins conflict resolution
- Sub-second replication lag
- Point-in-time recovery (35 days)

**Monitoring**:
```bash
# Check replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ReplicationLatency \
  --dimensions Name=TableName,Value=roadcall-incidents-prod \
               Name=ReceivingRegion,Value=us-west-2 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-east-1
```

### Aurora Cross-Region Replica

**Configuration**:
- Primary: roadcall-aurora-prod (us-east-1)
- Replica: roadcall-aurora-prod-replica (us-west-2)
- Engine: Aurora PostgreSQL 15.4
- Instances: Serverless v2 (0.5-16 ACUs)

**Failover process**:
```bash
# Promote replica to standalone cluster
aws rds promote-read-replica-db-cluster \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2

# Wait for promotion
aws rds wait db-cluster-available \
  --db-cluster-identifier roadcall-aurora-prod-replica \
  --region us-west-2
```

**Monitoring**:
```bash
# Check replication lag
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

### S3 Cross-Region Replication

**Replicated buckets**:
- roadcall-call-recordings-prod → roadcall-call-recordings-prod-us-west-2
- roadcall-kb-documents-prod → roadcall-kb-documents-prod-us-west-2
- roadcall-incident-media-prod → roadcall-incident-media-prod-us-west-2

**Features**:
- Replication Time Control (15-minute SLA)
- Delete marker replication
- Encryption maintained
- Versioning enabled

**Monitoring**:
```bash
# Check replication metrics
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

### AWS Backup

**Backup schedule**:
- Daily: 2:00 AM UTC, 35-day retention
- Weekly: Sunday 3:00 AM UTC, 90-day retention
- Monthly: 1st of month 4:00 AM UTC, 1-year retention (copied to DR region)

**Resources backed up**:
- Aurora Postgres cluster

**Verification**:
```bash
# List recent backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name roadcall-backup-vault-prod \
  --region us-east-1 \
  --by-created-after $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)

# Check backup job status
aws backup list-backup-jobs \
  --by-backup-vault-name roadcall-backup-vault-prod \
  --by-created-after $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S) \
  --region us-east-1
```

## Testing

### Monthly Verification

Run this checklist monthly:

```bash
# 1. Check DynamoDB replication status
for table in users incidents vendors tracking-sessions call-records; do
  echo "Checking roadcall-$table-prod..."
  aws dynamodb describe-table \
    --table-name "roadcall-$table-prod" \
    --region us-east-1 \
    --query 'Table.Replicas[].{Region:RegionName,Status:ReplicaStatus}'
done

# 2. Check Aurora replication lag
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name AuroraGlobalDBReplicationLag \
  --dimensions Name=DBClusterIdentifier,Value=roadcall-aurora-prod-replica \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average \
  --region us-west-2

# 3. Check S3 replication
aws s3api get-bucket-replication \
  --bucket roadcall-call-recordings-prod-$(aws sts get-caller-identity --query Account --output text) \
  --region us-east-1

# 4. Check recent backups
aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name roadcall-backup-vault-prod \
  --region us-east-1 \
  --by-created-after $(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)

# 5. Check health checks
aws route53 get-health-check-status \
  --health-check-id HEALTH_CHECK_ID
```

### Quarterly DR Drill

Follow the procedure in `DISASTER_RECOVERY_RUNBOOK.md`:

1. Schedule drill with team
2. Notify stakeholders (test environment)
3. Execute failover procedure
4. Measure RTO/RPO
5. Validate all services
6. Execute failback
7. Document lessons learned
8. Update runbooks

## Troubleshooting

### DynamoDB Replication Issues

**Problem**: High replication lag

**Solution**:
```bash
# Check for throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=roadcall-incidents-prod \
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

### Aurora Replication Issues

**Problem**: Replication lag increasing

**Solution**:
```bash
# Check for long-running queries
psql -h <primary-endpoint> -U postgres -d roadcall -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes'
  ORDER BY duration DESC;
"

# Check replication slot status
psql -h <primary-endpoint> -U postgres -d roadcall -c "
  SELECT slot_name, active, restart_lsn, confirmed_flush_lsn
  FROM pg_replication_slots;
"
```

### S3 Replication Issues

**Problem**: Objects not replicating

**Solution**:
```bash
# Check replication status for specific object
aws s3api head-object \
  --bucket roadcall-call-recordings-prod-ACCOUNT_ID \
  --key path/to/object \
  --region us-east-1 \
  --query 'ReplicationStatus'

# Check replication configuration
aws s3api get-bucket-replication \
  --bucket roadcall-call-recordings-prod-ACCOUNT_ID \
  --region us-east-1

# Verify IAM role permissions
aws iam get-role-policy \
  --role-name roadcall-s3-replication-role-prod \
  --policy-name S3ReplicationPolicy
```

## Cost Optimization

### Current Costs (Estimated)

- DynamoDB Global Tables: $500-1000/month
- Aurora Read Replica: $300-600/month
- S3 Replication: $200-400/month
- Backups: $100-200/month
- **Total**: $1,100-2,200/month

### Optimization Tips

1. **Use Serverless v2 for Aurora**: Pay only for actual usage
2. **Implement S3 lifecycle policies**: Move old data to Glacier
3. **Use on-demand capacity for DynamoDB**: Avoid over-provisioning
4. **Right-size DR resources**: DR can be smaller than primary
5. **Archive old backups**: Transition to Glacier after 90 days

## Maintenance

### Weekly Tasks
- [ ] Review CloudWatch alarms
- [ ] Check replication lag metrics
- [ ] Verify backup completion

### Monthly Tasks
- [ ] Run backup verification
- [ ] Review contact information
- [ ] Test health checks
- [ ] Review DR costs

### Quarterly Tasks
- [ ] Conduct DR drill
- [ ] Update runbook
- [ ] Review and optimize costs
- [ ] Audit access controls

### Annual Tasks
- [ ] Full DR exercise
- [ ] Comprehensive review
- [ ] Update disaster recovery plan
- [ ] Compliance audit

## Documentation

- **Quick Reference**: `DR_QUICK_REFERENCE.md`
- **Full Runbook**: `DISASTER_RECOVERY_RUNBOOK.md`
- **Implementation Details**: `DISASTER_RECOVERY_IMPLEMENTATION.md`
- **Architecture**: `.kiro/specs/ai-roadcall-assistant/design.md`

## Support

For issues or questions:
- On-call engineer: [PagerDuty]
- Platform owner: [Contact]
- AWS TAM: [Contact]
- Documentation: See files above

## Next Steps

After completing the setup:

1. ✅ Verify all replication is working
2. ✅ Test backup restoration
3. ✅ Configure monitoring alerts
4. ✅ Schedule first DR drill
5. ✅ Train team on procedures
6. ✅ Update contact information
7. ✅ Document any customizations

---

**Setup Date**: [Date]
**Last Verified**: [Date]
**Next Review**: [Date]
