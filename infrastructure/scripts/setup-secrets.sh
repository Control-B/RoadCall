#!/bin/bash

# Setup Secrets Script
# This script helps initialize secrets in AWS Secrets Manager for the Roadcall platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Get stage from argument or default to dev
STAGE=${1:-dev}
print_info "Setting up secrets for stage: $STAGE"

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

REGION=${AWS_REGION:-us-east-1}
print_info "Using AWS region: $REGION"

# Function to create or update a secret
update_secret() {
    local secret_name=$1
    local secret_value=$2
    local description=$3

    print_info "Updating secret: $secret_name"

    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$secret_name" --region "$REGION" &> /dev/null; then
        # Update existing secret
        aws secretsmanager update-secret \
            --secret-id "$secret_name" \
            --secret-string "$secret_value" \
            --region "$REGION" > /dev/null
        print_info "✓ Secret updated: $secret_name"
    else
        # Create new secret
        aws secretsmanager create-secret \
            --name "$secret_name" \
            --description "$description" \
            --secret-string "$secret_value" \
            --region "$REGION" > /dev/null
        print_info "✓ Secret created: $secret_name"
    fi
}

# Function to prompt for secret value
prompt_secret() {
    local prompt_text=$1
    local secret_var

    echo -n "$prompt_text: "
    read -s secret_var
    echo
    echo "$secret_var"
}

# Setup Stripe API Keys
print_info ""
print_info "=== Stripe API Keys Setup ==="
print_info "You can find your Stripe API keys at: https://dashboard.stripe.com/apikeys"
print_info ""

STRIPE_API_KEY=$(prompt_secret "Enter Stripe Secret Key (sk_...)")
STRIPE_PUBLISHABLE_KEY=$(prompt_secret "Enter Stripe Publishable Key (pk_...)")

if [ -z "$STRIPE_API_KEY" ] || [ -z "$STRIPE_PUBLISHABLE_KEY" ]; then
    print_warn "Skipping Stripe secret setup (empty values provided)"
else
    STRIPE_SECRET_JSON=$(cat <<EOF
{
  "apiKey": "$STRIPE_API_KEY",
  "publishableKey": "$STRIPE_PUBLISHABLE_KEY"
}
EOF
)
    update_secret \
        "roadcall/stripe/api-key-$STAGE" \
        "$STRIPE_SECRET_JSON" \
        "Stripe API keys for payment processing ($STAGE environment)"
fi

# Setup Weather API Key
print_info ""
print_info "=== Weather API Key Setup ==="
print_info "You can get a free API key at: https://www.weatherapi.com/signup.aspx"
print_info ""

WEATHER_API_KEY=$(prompt_secret "Enter Weather API Key")

if [ -z "$WEATHER_API_KEY" ]; then
    print_warn "Skipping Weather API secret setup (empty value provided)"
else
    WEATHER_SECRET_JSON=$(cat <<EOF
{
  "apiKey": "$WEATHER_API_KEY",
  "endpoint": "https://api.weatherapi.com/v1"
}
EOF
)
    update_secret \
        "roadcall/weather/api-key-$STAGE" \
        "$WEATHER_SECRET_JSON" \
        "Weather API key for incident context enrichment ($STAGE environment)"
fi

# Summary
print_info ""
print_info "=== Setup Complete ==="
print_info "Secrets have been configured for stage: $STAGE"
print_info ""
print_info "To verify secrets:"
print_info "  aws secretsmanager list-secrets --region $REGION"
print_info ""
print_info "To view a secret value:"
print_info "  aws secretsmanager get-secret-value --secret-id roadcall/stripe/api-key-$STAGE --region $REGION"
print_info ""
print_info "Next steps:"
print_info "  1. Deploy the infrastructure: cd infrastructure && pnpm cdk deploy --all"
print_info "  2. Verify Lambda functions can access secrets"
print_info "  3. Monitor CloudWatch logs for any secret access errors"
print_info ""
