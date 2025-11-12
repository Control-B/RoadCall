#!/bin/bash

# Setup Custom Domain for API Gateway
# This script helps configure a custom domain with ACM certificate

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN_NAME=${1:-"api.roadcall.com"}
REGION=${AWS_REGION:-"us-east-1"}
STAGE=${STAGE:-"dev"}

echo -e "${GREEN}Setting up custom domain for API Gateway${NC}"
echo "Domain: $DOMAIN_NAME"
echo "Region: $REGION"
echo "Stage: $STAGE"
echo ""

# Step 1: Check if domain exists in Route53
echo -e "${YELLOW}Step 1: Checking Route53 hosted zone...${NC}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${DOMAIN_NAME#*.}" \
  --query "HostedZones[0].Id" \
  --output text 2>/dev/null || echo "")

if [ -z "$HOSTED_ZONE_ID" ] || [ "$HOSTED_ZONE_ID" == "None" ]; then
  echo -e "${RED}Error: No hosted zone found for domain ${DOMAIN_NAME#*.}${NC}"
  echo "Please create a Route53 hosted zone first:"
  echo "  aws route53 create-hosted-zone --name ${DOMAIN_NAME#*.} --caller-reference $(date +%s)"
  exit 1
fi

echo -e "${GREEN}✓ Found hosted zone: $HOSTED_ZONE_ID${NC}"
echo ""

# Step 2: Request ACM certificate
echo -e "${YELLOW}Step 2: Requesting ACM certificate...${NC}"

# Check if certificate already exists
CERT_ARN=$(aws acm list-certificates \
  --region $REGION \
  --query "CertificateSummaryList[?DomainName=='$DOMAIN_NAME'].CertificateArn" \
  --output text 2>/dev/null || echo "")

if [ -z "$CERT_ARN" ]; then
  echo "Requesting new certificate for $DOMAIN_NAME..."
  CERT_ARN=$(aws acm request-certificate \
    --domain-name "$DOMAIN_NAME" \
    --validation-method DNS \
    --region $REGION \
    --query "CertificateArn" \
    --output text)
  
  echo -e "${GREEN}✓ Certificate requested: $CERT_ARN${NC}"
  echo ""
  
  # Step 3: Get validation records
  echo -e "${YELLOW}Step 3: Getting DNS validation records...${NC}"
  sleep 5 # Wait for AWS to generate validation records
  
  VALIDATION_RECORD=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region $REGION \
    --query "Certificate.DomainValidationOptions[0].ResourceRecord" \
    --output json)
  
  VALIDATION_NAME=$(echo $VALIDATION_RECORD | jq -r '.Name')
  VALIDATION_VALUE=$(echo $VALIDATION_RECORD | jq -r '.Value')
  
  echo "Add the following DNS record to validate the certificate:"
  echo ""
  echo "  Name:  $VALIDATION_NAME"
  echo "  Type:  CNAME"
  echo "  Value: $VALIDATION_VALUE"
  echo ""
  
  # Optionally create the validation record automatically
  read -p "Create validation record automatically? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    aws route53 change-resource-record-sets \
      --hosted-zone-id "$HOSTED_ZONE_ID" \
      --change-batch "{
        \"Changes\": [{
          \"Action\": \"UPSERT\",
          \"ResourceRecordSet\": {
            \"Name\": \"$VALIDATION_NAME\",
            \"Type\": \"CNAME\",
            \"TTL\": 300,
            \"ResourceRecords\": [{\"Value\": \"$VALIDATION_VALUE\"}]
          }
        }]
      }"
    
    echo -e "${GREEN}✓ Validation record created${NC}"
    echo ""
    
    # Wait for validation
    echo -e "${YELLOW}Waiting for certificate validation (this may take a few minutes)...${NC}"
    aws acm wait certificate-validated \
      --certificate-arn "$CERT_ARN" \
      --region $REGION
    
    echo -e "${GREEN}✓ Certificate validated!${NC}"
  else
    echo -e "${YELLOW}Please create the validation record manually and wait for validation.${NC}"
    echo "You can check validation status with:"
    echo "  aws acm describe-certificate --certificate-arn $CERT_ARN --region $REGION"
    exit 0
  fi
else
  echo -e "${GREEN}✓ Using existing certificate: $CERT_ARN${NC}"
fi

echo ""

# Step 4: Deploy API Gateway with custom domain
echo -e "${YELLOW}Step 4: Deploying API Gateway with custom domain...${NC}"

cd "$(dirname "$0")/.."

# Export variables for CDK
export DOMAIN_NAME
export CERTIFICATE_ARN=$CERT_ARN
export HOSTED_ZONE_ID

# Deploy
pnpm cdk deploy ApiGatewayStack \
  --context domainName="$DOMAIN_NAME" \
  --context certificateArn="$CERT_ARN" \
  --context hostedZoneId="$HOSTED_ZONE_ID" \
  --context stage="$STAGE" \
  --require-approval never

echo ""
echo -e "${GREEN}✓ API Gateway deployed with custom domain!${NC}"
echo ""
echo "Your API is now available at:"
echo "  https://$DOMAIN_NAME/$STAGE"
echo ""
echo "Test with:"
echo "  curl https://$DOMAIN_NAME/$STAGE/auth/me -H \"Authorization: Bearer <token>\""
echo ""
