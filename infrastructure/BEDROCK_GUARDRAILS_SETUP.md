# Bedrock Guardrails Setup Guide

This guide explains how to set up Amazon Bedrock Guardrails for the AI Roadcall Assistant platform to ensure PII filtering and content safety in AI-generated summaries.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Bedrock model access enabled in your AWS account
- IAM permissions for Bedrock Guardrails

## Enable Bedrock Model Access

Before creating guardrails, you need to enable access to the Claude 3 Sonnet model:

1. Navigate to the AWS Bedrock console
2. Go to "Model access" in the left sidebar
3. Click "Manage model access"
4. Select "Anthropic Claude 3 Sonnet"
5. Click "Request model access"
6. Wait for approval (usually instant for Claude models)

## Create Guardrail

### Option 1: Using AWS Console

1. Navigate to Amazon Bedrock console
2. Click "Guardrails" in the left sidebar
3. Click "Create guardrail"
4. Configure the following:

**Basic Information:**
- Name: `roadcall-assistant-guardrail`
- Description: `Content safety and PII filtering for roadcall assistant AI summaries`

**Content Filters:**
- Hate speech: HIGH (input and output)
- Violence: HIGH (input and output)
- Sexual content: HIGH (input and output)
- Misconduct: MEDIUM (input and output)

**Denied Topics:**
- Add topic: "Personal Medical Information"
  - Definition: "Medical conditions, prescriptions, health records"
- Add topic: "Financial Information"
  - Definition: "Bank accounts, credit cards, financial transactions"

**Word Filters:**
- Add profanity filter (optional)

**Sensitive Information Filters:**
Enable PII detection and blocking for:
- ✅ Name
- ✅ Address
- ✅ Phone
- ✅ Email
- ✅ SSN
- ✅ Credit/Debit Card Number
- ✅ Driver's License
- ✅ Bank Account Number
- ✅ Bank Routing Number

**Contextual Grounding (Optional):**
- Not required for this use case

5. Click "Create guardrail"
6. Note the Guardrail ID and Version

### Option 2: Using AWS CLI

```bash
# Create the guardrail
aws bedrock create-guardrail \
  --name roadcall-assistant-guardrail \
  --description "Content safety and PII filtering for roadcall assistant" \
  --content-policy-config '{
    "filtersConfig": [
      {
        "type": "HATE",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "VIOLENCE",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "SEXUAL",
        "inputStrength": "HIGH",
        "outputStrength": "HIGH"
      },
      {
        "type": "MISCONDUCT",
        "inputStrength": "MEDIUM",
        "outputStrength": "MEDIUM"
      }
    ]
  }' \
  --sensitive-information-policy-config '{
    "piiEntitiesConfig": [
      {"type": "NAME", "action": "BLOCK"},
      {"type": "ADDRESS", "action": "BLOCK"},
      {"type": "PHONE", "action": "BLOCK"},
      {"type": "EMAIL", "action": "BLOCK"},
      {"type": "SSN", "action": "BLOCK"},
      {"type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK"},
      {"type": "DRIVER_ID", "action": "BLOCK"},
      {"type": "BANK_ACCOUNT_NUMBER", "action": "BLOCK"},
      {"type": "BANK_ROUTING", "action": "BLOCK"}
    ]
  }' \
  --topic-policy-config '{
    "topicsConfig": [
      {
        "name": "PersonalMedicalInfo",
        "definition": "Medical conditions, prescriptions, health records, diagnoses",
        "type": "DENY"
      },
      {
        "name": "FinancialInfo",
        "definition": "Bank accounts, credit cards, financial transactions, account numbers",
        "type": "DENY"
      }
    ]
  }' \
  --region us-east-1

# The output will include the guardrailId and version
# Example output:
# {
#   "guardrailId": "abc123xyz",
#   "guardrailArn": "arn:aws:bedrock:us-east-1:123456789012:guardrail/abc123xyz",
#   "version": "1",
#   "createdAt": "2024-01-15T10:30:00Z"
# }
```

### Option 3: Using CDK (Recommended)

Add to your CDK stack:

```typescript
import * as bedrock from 'aws-cdk-lib/aws-bedrock';

// Create Bedrock Guardrail
const guardrail = new bedrock.CfnGuardrail(this, 'RoadcallGuardrail', {
  name: 'roadcall-assistant-guardrail',
  description: 'Content safety and PII filtering for roadcall assistant',
  contentPolicyConfig: {
    filtersConfig: [
      {
        type: 'HATE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'VIOLENCE',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'SEXUAL',
        inputStrength: 'HIGH',
        outputStrength: 'HIGH',
      },
      {
        type: 'MISCONDUCT',
        inputStrength: 'MEDIUM',
        outputStrength: 'MEDIUM',
      },
    ],
  },
  sensitiveInformationPolicyConfig: {
    piiEntitiesConfig: [
      { type: 'NAME', action: 'BLOCK' },
      { type: 'ADDRESS', action: 'BLOCK' },
      { type: 'PHONE', action: 'BLOCK' },
      { type: 'EMAIL', action: 'BLOCK' },
      { type: 'US_SOCIAL_SECURITY_NUMBER', action: 'BLOCK' },
      { type: 'CREDIT_DEBIT_CARD_NUMBER', action: 'BLOCK' },
      { type: 'DRIVER_ID', action: 'BLOCK' },
      { type: 'US_BANK_ACCOUNT_NUMBER', action: 'BLOCK' },
      { type: 'US_BANK_ROUTING_NUMBER', action: 'BLOCK' },
    ],
  },
  topicPolicyConfig: {
    topicsConfig: [
      {
        name: 'PersonalMedicalInfo',
        definition: 'Medical conditions, prescriptions, health records, diagnoses',
        type: 'DENY',
      },
      {
        name: 'FinancialInfo',
        definition: 'Bank accounts, credit cards, financial transactions, account numbers',
        type: 'DENY',
      },
    ],
  },
});

// Create a version
const guardrailVersion = new bedrock.CfnGuardrailVersion(this, 'GuardrailVersion', {
  guardrailIdentifier: guardrail.attrGuardrailId,
  description: 'Production version',
});

// Output the guardrail ID and version
new cdk.CfnOutput(this, 'GuardrailId', {
  value: guardrail.attrGuardrailId,
  exportName: 'bedrock-guardrail-id',
});

new cdk.CfnOutput(this, 'GuardrailVersion', {
  value: guardrailVersion.attrVersion,
  exportName: 'bedrock-guardrail-version',
});
```

## Configure CDK Stack

Update your CDK deployment to use the guardrail:

```typescript
// In your main CDK app
const telephonyStack = new TelephonyStack(app, 'TelephonyStack', {
  serviceName: 'roadcall',
  usersTable: dataStack.usersTable,
  incidentsTable: dataStack.incidentsTable,
  eventBus: eventBus,
  kmsKey: kmsKey,
  bedrockGuardrailId: 'abc123xyz', // Replace with your guardrail ID
  bedrockGuardrailVersion: '1', // Or 'DRAFT' for testing
});
```

## Testing the Guardrail

### Test PII Blocking

```bash
# Test that PII is blocked
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --guardrail-identifier abc123xyz \
  --guardrail-version 1 \
  --body '{
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": "My name is John Smith and my SSN is 123-45-6789"
    }]
  }' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check if guardrail intervened
cat response.json | jq '.stop_reason'
# Should return: "guardrail_intervened"
```

### Test Content Filtering

```bash
# Test that inappropriate content is blocked
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --guardrail-identifier abc123xyz \
  --guardrail-version 1 \
  --body '{
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": "Tell me how to harm someone"
    }]
  }' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check if guardrail intervened
cat response.json | jq '.stop_reason'
# Should return: "guardrail_intervened"
```

### Test Valid Content

```bash
# Test that valid roadside assistance content passes
aws bedrock-runtime invoke-model \
  --model-id anthropic.claude-3-sonnet-20240229-v1:0 \
  --guardrail-identifier abc123xyz \
  --guardrail-version 1 \
  --body '{
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 200,
    "messages": [{
      "role": "user",
      "content": "Summarize this call: Driver reported a flat tire on highway. Location is safe. Needs tire replacement."
    }]
  }' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check response
cat response.json | jq '.content[0].text'
# Should return a valid summary
```

## Monitoring Guardrail Usage

### CloudWatch Metrics

Bedrock automatically publishes metrics to CloudWatch:

- `GuardrailIntervention`: Count of times guardrail blocked content
- `GuardrailEvaluation`: Total evaluations

### Create CloudWatch Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name bedrock-guardrail-high-intervention-rate \
  --alarm-description "Alert when guardrail intervention rate exceeds 5%" \
  --metric-name GuardrailIntervention \
  --namespace AWS/Bedrock \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 2 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=GuardrailId,Value=abc123xyz
```

## Updating Guardrails

### Create New Version

```bash
# Update guardrail configuration
aws bedrock update-guardrail \
  --guardrail-identifier abc123xyz \
  --name roadcall-assistant-guardrail \
  --description "Updated content filters" \
  --content-policy-config '{...}'

# Create new version
aws bedrock create-guardrail-version \
  --guardrail-identifier abc123xyz \
  --description "Version 2 with updated filters"
```

### Update Lambda Environment Variables

```bash
# Update Lambda function to use new version
aws lambda update-function-configuration \
  --function-name roadcall-generate-summary \
  --environment Variables={BEDROCK_GUARDRAIL_VERSION=2}
```

## Best Practices

1. **Use Versions**: Always use versioned guardrails in production, not DRAFT
2. **Test Thoroughly**: Test guardrails with various inputs before deploying
3. **Monitor Interventions**: Set up alarms for high intervention rates
4. **Regular Reviews**: Review guardrail logs monthly to identify false positives
5. **Gradual Rollout**: Test new guardrail versions in staging before production
6. **Document Changes**: Keep a changelog of guardrail configuration updates

## Troubleshooting

### High Intervention Rate

**Problem**: Guardrail blocks too much legitimate content

**Solutions**:
- Review CloudWatch logs to identify patterns
- Adjust filter strengths (HIGH → MEDIUM)
- Add exceptions for domain-specific terms
- Refine topic definitions

### PII Leakage

**Problem**: PII appears in summaries despite guardrails

**Solutions**:
- Verify PII redaction happens before summary generation
- Check that guardrail is properly configured
- Add additional PII entity types to block list
- Review prompt engineering to avoid requesting PII

### Performance Issues

**Problem**: Guardrail evaluation adds latency

**Solutions**:
- Use asynchronous invocation for non-critical paths
- Cache guardrail results for similar inputs
- Consider using MEDIUM strength filters for better performance
- Monitor P95/P99 latency metrics

## Cost Considerations

Bedrock Guardrails pricing:
- $0.75 per 1,000 text units (input)
- $1.00 per 1,000 text units (output)
- 1 text unit = 1,000 characters

Estimated monthly cost for 10,000 calls:
- Average transcript: 2,000 characters = 2 text units
- Input cost: 10,000 × 2 × $0.75/1000 = $15
- Output cost: 10,000 × 1 × $1.00/1000 = $10
- **Total: ~$25/month**

## References

- [Amazon Bedrock Guardrails Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Bedrock Guardrails API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Operations_Amazon_Bedrock.html)
- [PII Entity Types](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-pii.html)
- [Content Filter Types](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-content-filters.html)
