# Telephony Service

Amazon Connect integration for phone-based incident reporting and call processing.

## Overview

The telephony service provides phone-based access to the Roadcall Assistance platform through Amazon Connect. It handles:

- **IVR Contact Flows**: Interactive voice response for incident type selection
- **Driver Identification**: ANI (Automatic Number Identification) lookup
- **Incident Creation**: Create incidents from phone calls with location collection
- **Call Recording**: Encrypted storage of all calls in S3
- **Transcription**: Automatic call-to-text conversion using Amazon Transcribe
- **PII Redaction**: Detect and redact personally identifiable information using Amazon Comprehend
- **Post-Call Processing**: Automated pipeline for transcription and analysis

## Architecture

```
┌─────────────┐
│   Driver    │
│   Calls     │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Amazon Connect     │
│  Contact Flow       │
└──────┬──────────────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│ Driver       │      │ Create       │
│ Lookup       │      │ Incident     │
│ Lambda       │      │ Lambda       │
└──────┬───────┘      └──────┬───────┘
       │                     │
       ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Users Table  │      │ Incidents    │
│ (DynamoDB)   │      │ Table        │
└──────────────┘      └──────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ EventBridge  │
                      │ (Incident    │
                      │  Created)    │
                      └──────────────┘

┌─────────────────────┐
│  Call Recording     │
│  (S3 Upload)        │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ Post-Call           │
│ Processor Lambda    │
└──────┬──────────────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌──────────────┐      ┌──────────────┐
│ Amazon       │      │ Amazon       │
│ Transcribe   │      │ Comprehend   │
└──────┬───────┘      └──────┬───────┘
       │                     │
       └──────────┬──────────┘
                  ▼
          ┌──────────────┐
          │ Transcripts  │
          │ Table        │
          └──────────────┘
```

## Components

### Lambda Functions

#### 1. Driver Lookup (`driver-lookup.ts`)

**Purpose**: Identify driver by phone number (ANI) during call

**Trigger**: Invoked by Amazon Connect contact flow

**Input**:
```json
{
  "Details": {
    "ContactData": {
      "ContactId": "contact-123",
      "CustomerEndpoint": {
        "Address": "+15551234567"
      }
    }
  }
}
```

**Output**:
```json
{
  "found": true,
  "driverId": "driver-123",
  "name": "John Doe",
  "companyName": "ABC Trucking",
  "truckNumber": "TRK-001",
  "isRegistered": true
}
```

**Logic**:
1. Extract phone number from contact data
2. Normalize to E.164 format
3. Query Users table using phone-index GSI
4. Return driver information if found

#### 2. Create Incident from Call (`create-incident-from-call.ts`)

**Purpose**: Create incident record during phone call

**Trigger**: Invoked by Amazon Connect contact flow after collecting incident details

**Input**:
```json
{
  "Details": {
    "ContactData": {
      "ContactId": "contact-123"
    },
    "Parameters": {
      "driverId": "driver-123",
      "incidentType": "tire",
      "latitude": "40.7128",
      "longitude": "-74.0060",
      "description": "Flat tire on I-95"
    }
  }
}
```

**Output**:
```json
{
  "success": true,
  "incidentId": "incident-456"
}
```

**Logic**:
1. Validate parameters (driverId, incidentType)
2. Parse and validate GPS coordinates
3. Create incident record in DynamoDB
4. Publish IncidentCreated event to EventBridge
5. Return incident ID for confirmation message

#### 3. Post-Call Processor (`post-call-processor.ts`)

**Purpose**: Process call recording after call ends

**Trigger**: S3 event when recording is uploaded

**Input**: S3 Event
```json
{
  "Records": [{
    "s3": {
      "bucket": { "name": "recordings-bucket" },
      "object": { "key": "recordings/contact-123.wav" }
    }
  }]
}
```

**Logic**:
1. Extract contact ID from S3 key
2. Start Amazon Transcribe job
3. Poll for transcription completion (or use EventBridge)
4. Fetch transcript from S3
5. Detect PII using Amazon Comprehend
6. Redact PII entities from transcript
7. Store both raw and redacted transcripts in DynamoDB
8. Update call record with transcript ID

**PII Detection**:
- Detects: NAME, ADDRESS, SSN, CREDIT_CARD, PHONE, EMAIL, etc.
- Redacts with masks: `[NAME]`, `[ADDRESS]`, `[SSN]`, etc.
- Stores PII mapping for authorized access

### Contact Flow

The main inbound contact flow (`contact-flow-definition.ts`) implements:

1. **Entry Point**
   - Welcome message
   - Invoke driver-lookup Lambda

2. **Driver Identification**
   - If found: "Welcome back, {name}"
   - If not found: New user registration flow

3. **Main Menu (IVR)**
   - Press 1: Tire Issue
   - Press 2: Engine Problem
   - Press 3: Towing Needed
   - Press 0: Operator

4. **Location Collection**
   - Collect GPS coordinates (from mobile integration)
   - Fallback to verbal description

5. **Incident Creation**
   - Invoke create-incident Lambda
   - Confirm incident created
   - Provide incident ID

6. **Confirmation**
   - "We're finding the nearest service provider"
   - "You'll receive a text when vendor is assigned"
   - Thank you message

### DynamoDB Tables

#### CallRecords Table
- **PK**: `callId` (Amazon Connect ContactId)
- **Attributes**: phone, driverId, incidentId, duration, recordingUrl, transcriptId, startTime, endTime
- **GSI1**: `incidentId` + `startTime` (incident's calls)
- **GSI2**: `driverId` + `startTime` (driver's call history)

#### Transcripts Table
- **PK**: `transcriptId`
- **Attributes**: callId, incidentId, rawText, redactedText, piiEntities, confidence, createdAt
- **GSI1**: `callId` (call's transcript)

### S3 Buckets

#### Recordings Bucket
- **Purpose**: Store encrypted call recordings
- **Encryption**: KMS with customer-managed key
- **Lifecycle**: 
  - Transition to Glacier after 30 days
  - Delete after 90 days
- **Path**: `recordings/{contactId}.wav`

#### Transcriptions Bucket
- **Purpose**: Store Amazon Transcribe output
- **Encryption**: KMS with customer-managed key
- **Lifecycle**: Delete after 90 days
- **Path**: `transcriptions/{jobName}.json`

## Deployment

### Prerequisites

1. Amazon Connect instance provisioned
2. Phone number claimed in Amazon Connect
3. Users table with phone-index GSI
4. Incidents table
5. EventBridge event bus

### Deploy Infrastructure

```bash
cd infrastructure
pnpm cdk deploy TelephonyStack
```

### Configure Amazon Connect

1. **Associate Lambda Functions**:
   - Go to Amazon Connect Console
   - Contact flows → AWS Lambda
   - Add driver-lookup and create-incident functions

2. **Import Contact Flow**:
   - Contact flows → Create contact flow
   - Import flow from `contact-flow-definition.ts`
   - Update Lambda ARNs in flow
   - Publish flow

3. **Configure Phone Number**:
   - Phone numbers → Claim number
   - Associate with contact flow

4. **Enable Call Recording**:
   - Data storage → Call recordings
   - Select recordings S3 bucket
   - Enable encryption

5. **Configure Contact Lens** (Optional):
   - Rules → Create rule
   - Enable real-time analytics
   - Set up alerts for keywords

## Testing

### Test Driver Lookup

```bash
aws lambda invoke \
  --function-name roadcall-driver-lookup \
  --payload '{"Details":{"ContactData":{"ContactId":"test-123","CustomerEndpoint":{"Address":"+15551234567"}}}}' \
  response.json
```

### Test Incident Creation

```bash
aws lambda invoke \
  --function-name roadcall-create-incident-from-call \
  --payload '{"Details":{"ContactData":{"ContactId":"test-123"},"Parameters":{"driverId":"driver-123","incidentType":"tire","latitude":"40.7128","longitude":"-74.0060"}}}' \
  response.json
```

### Test Call Flow

1. Call the Amazon Connect phone number
2. Follow IVR prompts
3. Verify incident created in DynamoDB
4. Check EventBridge for IncidentCreated event
5. Verify call recording in S3
6. Check transcript after processing

## Security

### Encryption
- **At Rest**: All data encrypted with KMS customer-managed keys
- **In Transit**: TLS 1.3 for all communications
- **Call Recordings**: Encrypted in S3 with KMS
- **Transcripts**: Encrypted in DynamoDB with KMS

### Access Control
- **Lambda Functions**: IAM roles with least-privilege policies
- **Amazon Connect**: Service principal with source account/ARN conditions
- **S3 Buckets**: Block public access, resource policies for Connect
- **DynamoDB**: Fine-grained access control per function

### PII Protection
- **Detection**: Amazon Comprehend DetectPiiEntities
- **Redaction**: Automatic masking in transcripts
- **Storage**: Separate raw and redacted transcripts
- **Access Logging**: All PII access logged with user ID and purpose

### Compliance
- **Call Recording Consent**: Announced in IVR
- **Data Retention**: 90-day lifecycle policies
- **Audit Trail**: CloudTrail for all API calls
- **PCI DSS**: No credit card data stored (use Stripe)

## Monitoring

### CloudWatch Metrics
- Lambda invocations, errors, duration
- Transcribe job success/failure rates
- S3 bucket size and object count
- DynamoDB read/write capacity

### CloudWatch Logs
- Lambda function logs with structured JSON
- Amazon Connect contact flow logs
- Transcribe job logs

### Alarms
- Lambda error rate > 5%
- Transcription job failure rate > 10%
- Post-call processing duration > 2 minutes
- S3 bucket size approaching quota

### X-Ray Tracing
- End-to-end tracing enabled for all Lambda functions
- Trace contact flow → Lambda → DynamoDB → EventBridge

## Future Enhancements

### Amazon Q in Connect Integration
- Real-time agent assist during calls
- Knowledge base queries for SOPs
- Post-call summarization with structured output
- Action item extraction
- Sentiment analysis

### Advanced Features
- Multi-language support (Spanish, French)
- Voice biometrics for driver authentication
- Real-time translation
- Proactive outbound calls for status updates
- SMS fallback for failed calls

### Analytics
- Call volume trends
- Average handle time
- First call resolution rate
- Customer satisfaction scores
- Common incident types by region

## Troubleshooting

### Driver Not Found
- Verify phone number format (E.164)
- Check Users table has phone-index GSI
- Verify user role is 'driver'

### Incident Creation Failed
- Check Lambda logs for validation errors
- Verify Incidents table permissions
- Check EventBridge event bus name

### Transcription Not Processing
- Verify S3 event notification configured
- Check Lambda has Transcribe permissions
- Verify recording file format (WAV, MP3)
- Check Transcribe service quotas

### PII Not Redacted
- Verify Comprehend permissions
- Check language code (must be 'en')
- Review PII entity types detected
- Verify redaction logic in code

## References

- [Amazon Connect Documentation](https://docs.aws.amazon.com/connect/)
- [Amazon Transcribe Documentation](https://docs.aws.amazon.com/transcribe/)
- [Amazon Comprehend PII Detection](https://docs.aws.amazon.com/comprehend/latest/dg/how-pii.html)
- [Contact Flow Language Reference](https://docs.aws.amazon.com/connect/latest/adminguide/contact-flow-language.html)
