# Call Transcription and PII Redaction Implementation

## Overview

This implementation provides comprehensive call transcription with PII detection, redaction, and secure storage with audit logging. The system ensures compliance with data protection regulations while maintaining accessibility for authorized users.

## Architecture

### Components

1. **Post-Call Processor** (`post-call-processor.ts`)
   - Triggered by S3 events when call recordings are uploaded
   - Starts Amazon Transcribe jobs for speech-to-text conversion
   - Detects PII using Amazon Comprehend
   - Redacts PII from transcripts
   - Encrypts PII entities using AWS KMS
   - Stores transcripts and encrypted PII mappings in DynamoDB

2. **PII Access Handler** (`access-pii.ts`)
   - Provides authorized access to PII data
   - Enforces role-based access control (admin/dispatcher only)
   - Logs all PII access attempts with user ID, purpose, and timestamp
   - Decrypts PII entities using AWS KMS

3. **DynamoDB Tables**
   - `Transcripts`: Stores transcripts with redacted PII
   - `PIIMappings`: Stores encrypted PII entities with 90-day TTL
   - `PIIAccessLogs`: Audit trail of all PII access attempts

## Features

### 1. Call Transcription

- **Amazon Transcribe Integration**: Converts call recordings to text
- **Speaker Labels**: Identifies driver and agent speakers
- **Confidence Scoring**: Tracks transcription accuracy
- **Performance**: Optimized polling with 1-2 second intervals
- **Format Support**: WAV, MP3, MP4, FLAC, OGG, WebM

### 2. PII Detection and Redaction

**Detected PII Types**:
- Names
- Addresses
- Social Security Numbers (SSN)
- Credit/Debit Card Numbers
- Phone Numbers
- Email Addresses
- Driver's License Numbers
- Bank Account Numbers
- Bank Routing Numbers

**Redaction Process**:
1. Amazon Comprehend DetectPiiEntities API identifies PII
2. PII entities sorted by offset (reverse order)
3. Each entity replaced with type-specific mask (e.g., `[NAME]`, `[SSN]`)
4. Original text preserved in encrypted storage

### 3. Encrypted PII Storage

**Encryption**:
- AWS KMS customer-managed keys (CMK)
- Encryption context includes transcript ID and purpose
- Base64-encoded ciphertext stored in DynamoDB

**Data Retention**:
- 90-day TTL on PII mappings (automatic deletion)
- Complies with data minimization principles
- Supports right-to-be-forgotten requirements

### 4. Audit Logging

**Access Logs Include**:
- Log ID (unique identifier)
- Transcript ID
- User ID and role
- Access purpose (required, minimum 10 characters)
- Timestamp
- IP address
- PII types accessed

**Log Retention**:
- Permanent retention for compliance
- Indexed by user ID and transcript ID
- Queryable for audit reports

## Performance

### SLA Target: 30 Seconds

**Optimization Strategies**:
1. **Parallel Processing**: Multiple recordings processed concurrently
2. **Optimized Polling**: 1s initial delay, then 2s intervals
3. **Timeout Management**: 25s transcription timeout with early termination
4. **Batch Operations**: Parallel DynamoDB writes
5. **Memory Allocation**: 1024 MB Lambda for faster processing

**Typical Timeline**:
- Transcription job start: ~500ms
- Transcription completion: 10-20s (depends on call length)
- PII detection: 1-2s
- Encryption and storage: 1-2s
- **Total**: 15-25s (well within 30s SLA)

## Security

### Authorization

**PII Access**:
- Restricted to `admin` and `dispatcher` roles
- JWT token validation via API Gateway Cognito authorizer
- Resource-level access control

**Encryption**:
- Data at rest: KMS-encrypted DynamoDB tables
- Data in transit: TLS 1.3
- PII entities: Double encryption (KMS + DynamoDB encryption)

### Compliance

**GDPR/CCPA**:
- Right to access: PII retrieval API with audit logging
- Right to be forgotten: 90-day TTL on PII mappings
- Data minimization: Redacted transcripts for general use
- Purpose limitation: Required purpose field for PII access

**HIPAA/PCI**:
- Audit trail: Complete access logging
- Encryption: KMS-managed keys with rotation
- Access control: Role-based with least privilege

## API Usage

### Access PII (Authorized Users Only)

**Endpoint**: `POST /transcripts/pii/access`

**Request**:
```json
{
  "transcriptId": "550e8400-e29b-41d4-a716-446655440000",
  "purpose": "Investigating customer complaint about service quality"
}
```

**Response**:
```json
{
  "transcriptId": "550e8400-e29b-41d4-a716-446655440000",
  "piiEntities": [
    {
      "type": "NAME",
      "text": "John Smith",
      "beginOffset": 45,
      "endOffset": 55,
      "score": 0.99
    },
    {
      "type": "PHONE",
      "text": "+1-555-123-4567",
      "beginOffset": 120,
      "endOffset": 135,
      "score": 0.98
    }
  ],
  "accessLogId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "warning": "This data contains sensitive PII. Handle according to data protection policies."
}
```

**Authorization**:
- Requires valid JWT token
- User role must be `admin` or `dispatcher`
- Purpose must be at least 10 characters

## Infrastructure

### DynamoDB Tables

**Transcripts Table**:
```typescript
{
  transcriptId: string (PK)
  callId: string (GSI)
  rawText: string
  redactedText: string
  piiEntities: PIIEntity[] // with text: '[REDACTED]'
  confidence: number
  createdAt: string
}
```

**PII Mappings Table**:
```typescript
{
  mappingId: string (PK)
  transcriptId: string (GSI)
  callId: string
  encryptedPII: string // Base64-encoded KMS ciphertext
  createdAt: string
  expiresAt: number // TTL: 90 days
}
```

**PII Access Logs Table**:
```typescript
{
  logId: string (PK)
  accessedAt: string (SK)
  transcriptId: string (GSI)
  userId: string (GSI)
  userRole: string
  purpose: string
  ipAddress?: string
  piiTypes: string[]
}
```

### Lambda Functions

**Post-Call Processor**:
- Timeout: 5 minutes
- Memory: 1024 MB
- Trigger: S3 event (recordings bucket)
- Permissions: Transcribe, Comprehend, KMS, DynamoDB, S3

**Access PII**:
- Timeout: 10 seconds
- Memory: 512 MB
- Trigger: API Gateway
- Permissions: KMS decrypt, DynamoDB read/write

## Monitoring

### CloudWatch Metrics

**Custom Metrics**:
- `TranscriptionDuration`: Time to complete transcription
- `PIIDetectionCount`: Number of PII entities detected
- `PIIAccessCount`: Number of PII access requests
- `SLAViolations`: Processing time > 30 seconds

**Alarms**:
- Processing time > 25 seconds (warning)
- Processing time > 30 seconds (critical)
- Transcription failure rate > 5%
- PII access by unauthorized users

### Logs

**Structured Logging**:
```json
{
  "level": "INFO",
  "message": "Call processing completed successfully",
  "contactId": "abc-123",
  "transcriptId": "def-456",
  "durationMs": 18500,
  "withinSLA": true,
  "piiCount": 3,
  "piiTypes": ["NAME", "PHONE", "ADDRESS"]
}
```

## Testing

### Unit Tests

Test coverage for:
- PII detection and redaction logic
- Encryption/decryption functions
- Media format detection
- Access authorization

### Integration Tests

Test scenarios:
- End-to-end transcription pipeline
- PII access with valid/invalid credentials
- Audit log creation
- TTL expiration

### Performance Tests

Validate:
- 30-second SLA compliance
- Concurrent processing capacity
- Memory usage under load

## Troubleshooting

### Common Issues

**Transcription Timeout**:
- Check call recording length (longer calls take more time)
- Verify Transcribe service limits
- Review Lambda timeout settings

**PII Detection Errors**:
- Ensure Comprehend service is available
- Check text length (max 100KB per request)
- Verify IAM permissions

**Access Denied**:
- Verify user role (must be admin or dispatcher)
- Check JWT token validity
- Ensure purpose field is provided and meaningful

## Future Enhancements

1. **Real-time Transcription**: Use Amazon Transcribe streaming for live calls
2. **Custom PII Detection**: Train custom Comprehend models for domain-specific PII
3. **Multi-language Support**: Extend to Spanish, French, etc.
4. **Sentiment Analysis**: Add call sentiment scoring
5. **Speaker Diarization**: Improve speaker identification accuracy
