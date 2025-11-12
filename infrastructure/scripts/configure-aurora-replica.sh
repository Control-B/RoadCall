#!/bin/bash

# Script to configure Aurora cross-region read replica for disaster recovery

set -e

STAGE=${1:-prod}
PRIMARY_REGION=${2:-us-east-1}
DR_REGION=${3:-us-west-2}

CLUSTER_IDENTIFIER="roadcall-aurora-$STAGE"
REPLICA_IDENTIFIER="roadcall-aurora-$STAGE-replica"

echo "Configuring Aurora cross-region read replica"
echo "Primary cluster: $CLUSTER_IDENTIFIER in $PRIMARY_REGION"
echo "Replica cluster: $REPLICA_IDENTIFIER in $DR_REGION"

# Function to get cluster ARN
get_cluster_arn() {
  local cluster_id=$1
  local region=$2
  
  aws rds describe-db-clusters \
    --db-cluster-identifier "$cluster_id" \
    --region "$region" \
    --query 'DBClusters[0].DBClusterArn' \
    --output text
}

# Function to check if replica exists
replica_exists() {
  aws rds describe-db-clusters \
    --db-cluster-identifier "$REPLICA_IDENTIFIER" \
    --region "$DR_REGION" \
    --output json > /dev/null 2>&1
}

# Main execution
if [ "$STAGE" != "prod" ]; then
  echo "Aurora cross-region replicas are only configured for production stage"
  exit 0
fi

# Check if primary cluster exists
if ! aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_IDENTIFIER" \
  --region "$PRIMARY_REGION" \
  --output json > /dev/null 2>&1; then
  echo "Error: Primary cluster $CLUSTER_IDENTIFIER not found in $PRIMARY_REGION"
  exit 1
fi

# Get primary cluster ARN
PRIMARY_CLUSTER_ARN=$(get_cluster_arn "$CLUSTER_IDENTIFIER" "$PRIMARY_REGION")
echo "Primary cluster ARN: $PRIMARY_CLUSTER_ARN"

# Check if replica already exists
if replica_exists; then
  echo "Replica cluster $REPLICA_IDENTIFIER already exists in $DR_REGION"
  
  # Check replication status
  REPLICATION_SOURCE=$(aws rds describe-db-clusters \
    --db-cluster-identifier "$REPLICA_IDENTIFIER" \
    --region "$DR_REGION" \
    --query 'DBClusters[0].ReplicationSourceIdentifier' \
    --output text)
  
  if [ "$REPLICATION_SOURCE" == "$PRIMARY_CLUSTER_ARN" ]; then
    echo "Replication is correctly configured"
  else
    echo "Warning: Replica exists but replication source doesn't match"
    echo "Expected: $PRIMARY_CLUSTER_ARN"
    echo "Actual: $REPLICATION_SOURCE"
  fi
  
  exit 0
fi

# Get VPC and security group information from primary cluster
echo "Getting VPC configuration from primary cluster..."
PRIMARY_VPC_SG=$(aws rds describe-db-clusters \
  --db-cluster-identifier "$CLUSTER_IDENTIFIER" \
  --region "$PRIMARY_REGION" \
  --query 'DBClusters[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
  --output text)

echo "Primary VPC Security Group: $PRIMARY_VPC_SG"

# Note: You need to have a VPC and security group in the DR region
# This script assumes they exist with similar naming
DR_VPC_SG="roadcall-aurora-sg-$STAGE"

echo ""
echo "Creating Aurora read replica in $DR_REGION..."
echo "This operation may take 10-15 minutes..."
echo ""

# Create read replica
aws rds create-db-cluster \
  --db-cluster-identifier "$REPLICA_IDENTIFIER" \
  --engine aurora-postgresql \
  --replication-source-identifier "$PRIMARY_CLUSTER_ARN" \
  --region "$DR_REGION" \
  --storage-encrypted \
  --enable-cloudwatch-logs-exports postgresql \
  --tags "Key=Name,Value=$REPLICA_IDENTIFIER" \
         "Key=Environment,Value=$STAGE" \
         "Key=Purpose,Value=DisasterRecovery" \
  --no-cli-pager

echo "Replica cluster creation initiated"
echo ""
echo "Waiting for replica cluster to be available..."

# Wait for cluster to be available
aws rds wait db-cluster-available \
  --db-cluster-identifier "$REPLICA_IDENTIFIER" \
  --region "$DR_REGION"

echo "Replica cluster is now available"
echo ""

# Add reader instance to the replica cluster
echo "Adding reader instance to replica cluster..."

aws rds create-db-instance \
  --db-instance-identifier "$REPLICA_IDENTIFIER-reader" \
  --db-instance-class db.r6g.large \
  --engine aurora-postgresql \
  --db-cluster-identifier "$REPLICA_IDENTIFIER" \
  --region "$DR_REGION" \
  --no-publicly-accessible \
  --auto-minor-version-upgrade \
  --tags "Key=Name,Value=$REPLICA_IDENTIFIER-reader" \
         "Key=Environment,Value=$STAGE" \
  --no-cli-pager

echo "Reader instance creation initiated"
echo ""
echo "Waiting for reader instance to be available..."

# Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier "$REPLICA_IDENTIFIER-reader" \
  --region "$DR_REGION"

echo ""
echo "Aurora cross-region read replica configuration complete!"
echo ""
echo "Replica cluster endpoint:"
aws rds describe-db-clusters \
  --db-cluster-identifier "$REPLICA_IDENTIFIER" \
  --region "$DR_REGION" \
  --query 'DBClusters[0].Endpoint' \
  --output text
echo ""
echo "Reader endpoint:"
aws rds describe-db-clusters \
  --db-cluster-identifier "$REPLICA_IDENTIFIER" \
  --region "$DR_REGION" \
  --query 'DBClusters[0].ReaderEndpoint' \
  --output text
echo ""
echo "To monitor replication lag, check CloudWatch metrics:"
echo "- AuroraGlobalDBReplicationLag"
echo "- AuroraGlobalDBReplicatedWriteIO"
echo ""
echo "To promote replica to standalone cluster (failover):"
echo "aws rds promote-read-replica-db-cluster --db-cluster-identifier $REPLICA_IDENTIFIER --region $DR_REGION"
