#!/bin/bash

# Script to configure S3 cross-region replication for disaster recovery
# This script must be run after the buckets are created

set -e

STAGE=${1:-prod}
PRIMARY_REGION=${2:-us-east-1}
DR_REGION=${3:-us-west-2}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "Configuring S3 cross-region replication for stage: $STAGE"
echo "Primary region: $PRIMARY_REGION"
echo "DR region: $DR_REGION"
echo "AWS Account: $AWS_ACCOUNT_ID"

# Function to enable versioning on a bucket
enable_versioning() {
  local bucket_name=$1
  echo "Enabling versioning on $bucket_name..."
  aws s3api put-bucket-versioning \
    --bucket "$bucket_name" \
    --versioning-configuration Status=Enabled \
    --region "$PRIMARY_REGION"
}

# Function to create replication role
create_replication_role() {
  local role_name="roadcall-s3-replication-role-$STAGE"
  
  echo "Creating IAM role for S3 replication: $role_name"
  
  # Create trust policy
  cat > /tmp/trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "s3.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

  # Create role
  aws iam create-role \
    --role-name "$role_name" \
    --assume-role-policy-document file:///tmp/trust-policy.json \
    --description "Role for S3 cross-region replication" \
    2>/dev/null || echo "Role already exists"

  # Create policy
  cat > /tmp/replication-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetReplicationConfiguration",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::roadcall-*-$STAGE-$AWS_ACCOUNT_ID"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObjectVersionForReplication",
        "s3:GetObjectVersionAcl",
        "s3:GetObjectVersionTagging"
      ],
      "Resource": [
        "arn:aws:s3:::roadcall-*-$STAGE-$AWS_ACCOUNT_ID/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:ReplicateObject",
        "s3:ReplicateDelete",
        "s3:ReplicateTags"
      ],
      "Resource": [
        "arn:aws:s3:::roadcall-*-$STAGE-$DR_REGION-$AWS_ACCOUNT_ID/*"
      ]
    }
  ]
}
EOF

  # Attach policy
  aws iam put-role-policy \
    --role-name "$role_name" \
    --policy-name "S3ReplicationPolicy" \
    --policy-document file:///tmp/replication-policy.json

  echo "arn:aws:iam::$AWS_ACCOUNT_ID:role/$role_name"
}

# Function to configure replication for a bucket
configure_replication() {
  local source_bucket=$1
  local destination_bucket=$2
  local role_arn=$3
  
  echo "Configuring replication from $source_bucket to $destination_bucket..."
  
  cat > /tmp/replication-config.json <<EOF
{
  "Role": "$role_arn",
  "Rules": [
    {
      "Status": "Enabled",
      "Priority": 1,
      "DeleteMarkerReplication": {
        "Status": "Enabled"
      },
      "Filter": {},
      "Destination": {
        "Bucket": "arn:aws:s3:::$destination_bucket",
        "ReplicationTime": {
          "Status": "Enabled",
          "Time": {
            "Minutes": 15
          }
        },
        "Metrics": {
          "Status": "Enabled",
          "EventThreshold": {
            "Minutes": 15
          }
        }
      }
    }
  ]
}
EOF

  aws s3api put-bucket-replication \
    --bucket "$source_bucket" \
    --replication-configuration file:///tmp/replication-config.json \
    --region "$PRIMARY_REGION"
  
  echo "Replication configured successfully"
}

# Main execution
if [ "$STAGE" != "prod" ]; then
  echo "S3 replication is only configured for production stage"
  exit 0
fi

# Create replication role
REPLICATION_ROLE_ARN=$(create_replication_role)
echo "Replication role ARN: $REPLICATION_ROLE_ARN"

# Wait for role to propagate
echo "Waiting for IAM role to propagate..."
sleep 10

# Configure replication for call recordings bucket
SOURCE_BUCKET="roadcall-call-recordings-$STAGE-$AWS_ACCOUNT_ID"
DEST_BUCKET="roadcall-call-recordings-$STAGE-$DR_REGION-$AWS_ACCOUNT_ID"

if aws s3api head-bucket --bucket "$SOURCE_BUCKET" --region "$PRIMARY_REGION" 2>/dev/null; then
  enable_versioning "$SOURCE_BUCKET"
  configure_replication "$SOURCE_BUCKET" "$DEST_BUCKET" "$REPLICATION_ROLE_ARN"
else
  echo "Source bucket $SOURCE_BUCKET not found, skipping"
fi

# Configure replication for KB documents bucket
SOURCE_BUCKET="roadcall-kb-documents-$STAGE-$AWS_ACCOUNT_ID"
DEST_BUCKET="roadcall-kb-documents-$STAGE-$DR_REGION-$AWS_ACCOUNT_ID"

if aws s3api head-bucket --bucket "$SOURCE_BUCKET" --region "$PRIMARY_REGION" 2>/dev/null; then
  enable_versioning "$SOURCE_BUCKET"
  configure_replication "$SOURCE_BUCKET" "$DEST_BUCKET" "$REPLICATION_ROLE_ARN"
else
  echo "Source bucket $SOURCE_BUCKET not found, skipping"
fi

# Configure replication for incident media bucket
SOURCE_BUCKET="roadcall-incident-media-$STAGE-$AWS_ACCOUNT_ID"
DEST_BUCKET="roadcall-incident-media-$STAGE-$DR_REGION-$AWS_ACCOUNT_ID"

if aws s3api head-bucket --bucket "$SOURCE_BUCKET" --region "$PRIMARY_REGION" 2>/dev/null; then
  enable_versioning "$SOURCE_BUCKET"
  configure_replication "$SOURCE_BUCKET" "$DEST_BUCKET" "$REPLICATION_ROLE_ARN"
else
  echo "Source bucket $SOURCE_BUCKET not found, skipping"
fi

# Clean up temp files
rm -f /tmp/trust-policy.json /tmp/replication-policy.json /tmp/replication-config.json

echo ""
echo "S3 cross-region replication configuration complete!"
echo ""
echo "To verify replication status, run:"
echo "aws s3api get-bucket-replication --bucket <bucket-name> --region $PRIMARY_REGION"
