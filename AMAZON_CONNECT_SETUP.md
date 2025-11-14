# Amazon Connect Setup Guide - Testing Calls with RAG & Knowledge Base

## Overview

This guide will help you set up Amazon Connect to test phone calls with AI-powered transcription, summarization, and knowledge base integration.

## Architecture

```
Phone Call → Amazon Connect → Lambda (Driver Lookup)
                ↓
        Call Recording → S3
                ↓
        Amazon Transcribe → Transcript
                ↓
        Amazon Comprehend → PII Redaction
                ↓
        Amazon Bedrock (Claude) → AI Summary
                ↓
        Amazon Q in Connect → Agent Assist
                ↓
        Amazon Kendra → Knowledge Base Search
```

## Prerequisites

- AWS Account with admin access
- AWS CLI configured
- Phone number for testing
- Credit card for AWS charges (minimal for testing)

## Step 1: Create Amazon Connect Instance

### Via AWS Console

1. **Go to Amazon Connect Console**
   ```
   https://console.aws.amazon.com/connect/
   ```

2. **Create Instance**
   - Click "Create instance"
   - Access URL: `roadcall-contact-center` (or your choice)
   - Identity management: "Store users in Amazon Connect"
   - Administrator: Create new admin user
   - Telephony: Enable inbound and outbound calls
   - Data storage: Use default S3 buckets (or specify custom)
   - Click "Create instance"

3. **Claim Phone Number**
   - After instance creation, click "Claim a phone number"
   - Choose country: United States
   - Type: DID (Direct Inward Dialing) or Toll-Free
   - Select a number
   - Click "Save"

### Via CDK (Automated)

```typescript
// infrastructure/lib/telephony-stack.ts
import * as connect from 'aws-cdk-lib/aws-connect';

const connectInstance = new connect.CfnInstance(this, 'RoadCallConnect', {
  identityManagementType: 'CONNECT_MANAGED',
  instanceAlias: 'roadcall-contact-center',
  attributes: {
    inboundCalls: true,
    outboundCalls: true,
    contactflowLogs: true,
    autoResolveBestVoices: true,
  },
});
```

## Step 2: Set Up Contact Flow (IVR)

### Basic Contact Flow

1. **Go to Contact Flows**
   - In Amazon Connect dashboard
   - Routing → Contact flows
   - Click "Create contact flow"

2. **Design Flow**
   ```
   Entry Point
      ↓
   Play Prompt: "Welcome to RoadCall. Please hold while we look up your information."
      ↓
   Invoke Lambda: driver-lookup (by phone number)
      ↓
   Check Contact Attributes
      ↓
   [If Driver Found]
      Play Prompt: "Hello [DriverName], how can we help you today?"
      ↓
      Get Customer Input: "Press 1 for tire issue, 2 for engine, 3 for towing"
      ↓
      Invoke Lambda: create-incident
      ↓
      Play Prompt: "We're dispatching help now. You'll receive a text shortly."
      ↓
      End
   
   [If Driver Not Found]
      Play Prompt: "We couldn't find your account. Please call back or register online."
      ↓
      End
   ```

3. **Save and Publish**
   - Name: "RoadCall Main Flow"
   - Click "Save" then "Publish"

### Contact Flow JSON (Import)

Create a file `contact-flow.json`:

```json
{
  "Version": "2019-10-30",
  "StartAction": "12345678-1234-1234-1234-123456789012",
  "Actions": [
    {
      "Identifier": "12345678-1234-1234-1234-123456789012",
      "Type": "MessageParticipant",
      "Parameters": {
        "Text": "Welcome to RoadCall. Please hold while we look up your information."
      },
      "Transitions": {
        "NextAction": "23456789-1234-1234-1234-123456789012"
      }
    },
    {
      "Identifier": "23456789-1234-1234-1234-123456789012",
      "Type": "InvokeExternalResource",
      "Parameters": {
        "FunctionArn": "arn:aws:lambda:us-east-1:ACCOUNT_ID:function:roadcall-driver-lookup"
      },
      "Transitions": {
        "NextAction": "34567890-1234-1234-1234-123456789012"
      }
    }
  ]
}
```

## Step 3: Configure Call Recording

1. **Enable Call Recording**
   - In Contact Flow, add "Set recording behavior" block
   - Enable: Agent and Customer
   - Storage: S3 bucket (auto-created by Connect)

2. **Set Up S3 Event Trigger**
   ```typescript
   // Lambda trigger on S3 upload
   const callRecordingBucket = s3.Bucket.fromBucketName(
     this,
     'CallRecordings',
     'amazon-connect-INSTANCE_ID'
   );

   callRecordingBucket.addEventNotification(
     s3.EventType.OBJECT_CREATED,
     new s3n.LambdaDestination(postCallProcessor)
   );
   ```

## Step 4: Set Up Amazon Transcribe

### Enable Transcription in Contact Flow

1. **Add "Set recording and analytics behavior" block**
   - Enable call recording
   - Enable analytics: Post-call transcription
   - Language: English (US)
   - Redaction: Enable PII redaction

### Lambda for Transcription Processing

```typescript
// services/telephony-svc/src/handlers/post-call-processor.ts
import { TranscribeClient, StartTranscriptionJobCommand } from '@aws-sdk/client-transcribe';

export const handler = async (event: S3Event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  
  const transcribe = new TranscribeClient({ region: 'us-east-1' });
  
  await transcribe.send(new StartTranscriptionJobCommand({
    TranscriptionJobName: `transcribe-${Date.now()}`,
    LanguageCode: 'en-US',
    MediaFormat: 'wav',
    Media: {
      MediaFileUri: `s3://${bucket}/${key}`
    },
    OutputBucketName: 'roadcall-transcripts',
    Settings: {
      ShowSpeakerLabels: true,
      MaxSpeakerLabels: 2
    },
    ContentRedaction: {
      RedactionType: 'PII',
      RedactionOutput: 'redacted'
    }
  }));
};
```

## Step 5: Set Up Amazon Bedrock for AI Summarization

### Enable Bedrock Models

1. **Request Model Access**
   ```bash
   aws bedrock list-foundation-models --region us-east-1
   
   # Request access to Claude
   aws bedrock put-model-invocation-logging-configuration \
     --region us-east-1
   ```

2. **Create Summary Generator Lambda**

```typescript
// services/telephony-svc/src/handlers/generate-summary.ts
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export const handler = async (event: { transcriptId: string }) => {
  const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
  
  // Get transcript from DynamoDB
  const transcript = await getTranscript(event.transcriptId);
  
  const prompt = `Analyze this roadside assistance call transcript and provide:
1. Incident type (tire/engine/tow/electrical)
2. Urgency level (low/medium/high/critical)
3. Key action items
4. Driver sentiment
5. Location mentioned

Transcript:
${transcript.text}

Provide response in JSON format.`;

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  }));
  
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text;
};
```

## Step 6: Set Up Amazon Kendra for Knowledge Base

### Create Kendra Index

```bash
aws kendra create-index \
  --name "roadcall-knowledge-base" \
  --role-arn "arn:aws:iam::ACCOUNT_ID:role/KendraRole" \
  --edition "DEVELOPER_EDITION" \
  --region us-east-1
```

### Add Documents

```typescript
// Upload SOPs and vendor info to Kendra
import { KendraClient, BatchPutDocumentCommand } from '@aws-sdk/client-kendra';

const kendra = new KendraClient({ region: 'us-east-1' });

await kendra.send(new BatchPutDocumentCommand({
  IndexId: 'INDEX_ID',
  Documents: [
    {
      Id: 'sop-tire-replacement',
      Title: 'Tire Replacement SOP',
      ContentType: 'PLAIN_TEXT',
      Blob: Buffer.from('Standard procedure for tire replacement...'),
      Attributes: [
        { Key: '_category', Value: { StringValue: 'sop' } },
        { Key: 'incidentType', Value: { StringValue: 'tire' } }
      ]
    }
  ]
}));
```

## Step 7: Set Up Amazon Q in Connect

### Enable Q in Connect

1. **Go to Amazon Connect Console**
   - Navigate to your instance
   - Click "Amazon Q" in left menu
   - Click "Enable Amazon Q in Connect"

2. **Configure Knowledge Base**
   - Select Kendra index created above
   - Enable real-time agent assist
   - Configure response generation

### Test Agent Assist

```typescript
// services/telephony-svc/src/handlers/agent-assist.ts
import { QConnectClient, QueryAssistantCommand } from '@aws-sdk/client-qconnect';

export const handler = async (event: { query: string; contactId: string }) => {
  const qconnect = new QConnectClient({ region: 'us-east-1' });
  
  const response = await qconnect.send(new QueryAssistantCommand({
    AssistantId: 'ASSISTANT_ID',
    QueryText: event.query,
    SessionId: event.contactId
  }));
  
  return {
    answer: response.Results[0].Document.Content.Text,
    sources: response.Results.map(r => ({
      title: r.Document.Title,
      excerpt: r.Document.Excerpt
    }))
  };
};
```

## Step 8: Testing the Complete Flow

### Test Call Script

1. **Call the Connect Number**
   ```
   Dial: +1-XXX-XXX-XXXX (your claimed number)
   ```

2. **Expected Flow**
   ```
   IVR: "Welcome to RoadCall..."
   You: [Wait for prompt]
   IVR: "Press 1 for tire, 2 for engine, 3 for towing"
   You: Press 1
   IVR: "We're dispatching help now..."
   ```

3. **Check Results**
   - S3: Call recording uploaded
   - DynamoDB: Call record created
   - Transcribe: Transcript generated
   - Bedrock: Summary created
   - Kendra: Knowledge base queried

### Test Commands

```bash
# Check call records
aws dynamodb scan \
  --table-name CallRecords \
  --region us-east-1

# Check transcripts
aws s3 ls s3://roadcall-transcripts/

# Test Bedrock summary
aws lambda invoke \
  --function-name roadcall-generate-summary \
  --payload '{"transcriptId":"test-123"}' \
  response.json

# Test Kendra search
aws kendra query \
  --index-id INDEX_ID \
  --query-text "tire replacement procedure" \
  --region us-east-1

# Test Q in Connect
aws lambda invoke \
  --function-name roadcall-agent-assist \
  --payload '{"query":"What is the SLA for tire service?","contactId":"test"}' \
  response.json
```

## Step 9: Monitor and Debug

### CloudWatch Logs

```bash
# View Connect logs
aws logs tail /aws/connect/roadcall-contact-center --follow

# View Lambda logs
aws logs tail /aws/lambda/roadcall-post-call-processor --follow
aws logs tail /aws/lambda/roadcall-generate-summary --follow
```

### X-Ray Tracing

Enable X-Ray in Lambda functions to trace the complete flow:
```typescript
import { captureAWSv3Client } from 'aws-xray-sdk-core';
const client = captureAWSv3Client(new BedrockRuntimeClient({}));
```

## Cost Estimate (Testing)

- **Amazon Connect**: $0.018/min = ~$1.08/hour of calls
- **Transcribe**: $0.024/min = ~$1.44/hour
- **Bedrock Claude**: $0.003/1K tokens = ~$0.30 per 100 summaries
- **Kendra Developer**: $810/month (or $1.40/hour for testing)
- **Q in Connect**: Included with Connect

**Total for 1 hour of testing**: ~$5-10

## Quick Start Script

```bash
#!/bin/bash
# quick-setup-connect.sh

# 1. Create Connect instance
aws connect create-instance \
  --identity-management-type CONNECT_MANAGED \
  --instance-alias roadcall-test \
  --inbound-calls-enabled \
  --outbound-calls-enabled

# 2. Get instance ID
INSTANCE_ID=$(aws connect list-instances --query 'InstanceSummaryList[0].Id' --output text)

# 3. Claim phone number
aws connect search-available-phone-numbers \
  --target-arn arn:aws:connect:us-east-1:ACCOUNT_ID:instance/$INSTANCE_ID \
  --phone-number-country-code US \
  --phone-number-type DID

# 4. Deploy Lambda functions
cd infrastructure
pnpm run deploy

echo "Setup complete! Instance ID: $INSTANCE_ID"
echo "Next: Configure contact flow in AWS Console"
```

## Troubleshooting

### Call doesn't connect
- Check phone number is claimed
- Verify contact flow is published
- Check Lambda permissions

### Transcription fails
- Verify S3 bucket permissions
- Check Transcribe service limits
- Ensure audio format is supported

### Bedrock errors
- Request model access in Bedrock console
- Check IAM permissions for bedrock:InvokeModel
- Verify region supports Claude

### Kendra not returning results
- Check documents are indexed
- Verify query syntax
- Wait for indexing to complete (can take 15 min)

## Next Steps

1. ✅ Set up Amazon Connect instance
2. ✅ Configure contact flow
3. ✅ Enable call recording and transcription
4. ✅ Deploy Lambda functions
5. ✅ Set up Bedrock for summaries
6. ✅ Create Kendra index
7. ✅ Enable Q in Connect
8. ✅ Make test call
9. ⬜ Review transcript and summary
10. ⬜ Test agent assist queries

---

**Ready to test!** Start with Step 1 and work through each section. The complete flow is already implemented in your codebase (Tasks 14-17).
