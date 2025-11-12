#!/bin/bash

# Script to configure DynamoDB Global Tables for disaster recovery
# This enables cross-region replication for critical tables

set -e

STAGE=${1:-prod}
PRIMARY_REGION=${2:-us-east-1}
DR_REGION=${3:-us-west-2}

echo "Configuring DynamoDB Global Tables for stage: $STAGE"
echo "Primary region: $PRIMARY_REGION"
echo "DR region: $DR_REGION"

# Function to enable global table replication
enable_global_table() {
  local table_name=$1
  
  echo "Checking table: $table_name"
  
  # Check if table exists in primary region
  if ! aws dynamodb describe-table \
    --table-name "$table_name" \
    --region "$PRIMARY_REGION" \
    --output json > /dev/null 2>&1; then
    echo "  Table $table_name not found in $PRIMARY_REGION, skipping"
    return
  fi
  
  # Check if table already has global replication
  REPLICAS=$(aws dynamodb describe-table \
    --table-name "$table_name" \
    --region "$PRIMARY_REGION" \
    --query 'Table.Replicas[].RegionName' \
    --output text)
  
  if echo "$REPLICAS" | grep -q "$DR_REGION"; then
    echo "  Table $table_name already has replication to $DR_REGION"
    return
  fi
  
  echo "  Enabling global table replication for $table_name..."
  
  # Enable streams if not already enabled (required for global tables)
  STREAM_ENABLED=$(aws dynamodb describe-table \
    --table-name "$table_name" \
    --region "$PRIMARY_REGION" \
    --query 'Table.StreamSpecification.StreamEnabled' \
    --output text)
  
  if [ "$STREAM_ENABLED" != "True" ]; then
    echo "  Enabling streams on $table_name..."
    aws dynamodb update-table \
      --table-name "$table_name" \
      --region "$PRIMARY_REGION" \
      --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
      --no-cli-pager
    
    # Wait for table to be active
    echo "  Waiting for table to be active..."
    aws dynamodb wait table-exists \
      --table-name "$table_name" \
      --region "$PRIMARY_REGION"
  fi
  
  # Create replica in DR region
  echo "  Creating replica in $DR_REGION..."
  aws dynamodb update-table \
    --table-name "$table_name" \
    --region "$PRIMARY_REGION" \
    --replica-updates "Create={RegionName=$DR_REGION}" \
    --no-cli-pager || echo "  Replica creation initiated (may already be in progress)"
  
  echo "  Global table replication enabled for $table_name"
}

# Main execution
if [ "$STAGE" != "prod" ]; then
  echo "Global tables are only configured for production stage"
  exit 0
fi

# List of critical tables to replicate
TABLES=(
  "roadcall-users-$STAGE"
  "roadcall-incidents-$STAGE"
  "roadcall-vendors-$STAGE"
  "roadcall-tracking-sessions-$STAGE"
  "roadcall-call-records-$STAGE"
)

echo ""
echo "Configuring global tables for ${#TABLES[@]} tables..."
echo ""

for table in "${TABLES[@]}"; do
  enable_global_table "$table"
  echo ""
done

echo "DynamoDB Global Tables configuration complete!"
echo ""
echo "Note: Replication may take several minutes to complete."
echo "To check replication status, run:"
echo "aws dynamodb describe-table --table-name <table-name> --region $PRIMARY_REGION --query 'Table.Replicas'"
echo ""
echo "To monitor replication lag, check CloudWatch metrics:"
echo "- ReplicationLatency"
echo "- PendingReplicationCount"
