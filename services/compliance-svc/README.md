# Compliance Service

The Compliance Service handles data retention, GDPR compliance, and user privacy features for the AI Roadcall Assistant platform.

## Features

### 1. Automated PII Deletion
- **Trigger**: Daily at 2 AM UTC (EventBridge scheduled rule)
- **Retention**: 3 years of inactivity
- **Scope**: 
  - User profiles (phone, email, name)
  - Driver profiles (license numbers, truck numbers)
  - Vendor profiles (contact information)
  - Call records (phone numbers, transcripts)
  - Payment audit logs (notes containing PII)

### 2. Data Export (GDPR Article 15)
- **Endpoint**: `GET /compliance/export?userId={userId}`
- **Format**: JSON
- **Delivery**: Presigned S3 URL (valid for 1 hour)
- **Scope**:
  - User profile
  - Driver/Vendor profile
  - All incidents
  - Call records
  - Payment history

### 3. Right to Be Forgotten (GDPR Article 17)
- **Endpoint**: `POST /compliance/forget`
- **Process**:
  1. Anonymize user profiles
  2. Anonymize driver/vendor profiles
  3. Remove PII from incidents (keep for analytics)
  4. Delete call recordings from S3
  5. Anonymize call records
  6. Delete GPS tracking data
  7. Delete incident media
  8. Anonymize payment records
  9. Create audit log entry
  10. Publish UserDataDeleted event

### 4. Consent Management (GDPR Article 7)
- **Endpoints**:
  - `POST /compliance/consent` - Record consent during registration
  - `GET /compliance/consent?userId={userId}` - Get consent status
  - `PUT /compliance/consent` - Update consent (grant/revoke)
- **Consent Types**:
  - `data_processing` - Required for service
  - `marketing_communications` - Optional
  - `location_tracking` - Required for tracking features
  - `call_recording` - Required for telephony features
  - `data_sharing` - Optional for analytics

### 5. Temporary Data Cleanup
- **Trigger**: Daily (EventBridge scheduled rule)
- **Retention**: 90 days
- **Scope**:
  - GPS tracking paths (vendorPath, route)
  - Call recordings (S3)
  - Incident media (S3)

### 6. S3 Lifecycle Policies
- **Call Recordings**:
  - Transition to Glacier: 30 days
  - Delete: 90 days
- **Incident Media**:
  - Transition to Glacier: 30 days
  - Delete: 90 days
- **Knowledge Base Documents**:
  - Transition to Glacier: 90 days
  - Retention: Indefinite
- **Audit Logs**:
  - Transition to Glacier: 90 days
  - Transition to Deep Archive: 1 year
  - Retention: 7 years

### 7. Audit Logging
- **Table**: `compliance_audit_log` (Aurora Postgres)
- **Retention**: 7 years
- **Partitioning**: Annual partitions for efficient archival
- **Actions Logged**:
  - RIGHT_TO_BE_FORGOTTEN
  - DATA_EXPORT
  - PII_DELETION
  - CONSENT_UPDATED

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    EventBridge Rules                         │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Daily 2 AM UTC   │         │ Daily (flexible) │         │
│  └────────┬─────────┘         └────────┬─────────┘         │
└───────────┼──────────────────────────────┼──────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐      ┌─────────────────────────┐
│ PII Deletion Lambda │      │ Temp Data Cleanup Lambda│
└──────────┬──────────┘      └───────────┬─────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Stores                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │DynamoDB  │  │ Aurora   │  │   S3     │  │EventBridge│   │
│  │ Tables   │  │ Postgres │  │ Buckets  │  │ Event Bus │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
           ▲                              ▲
           │                              │
┌──────────┴──────────┐      ┌───────────┴─────────────┐
│ Data Export Lambda  │      │ Right-to-Be-Forgotten   │
│                     │      │ Lambda                  │
└──────────┬──────────┘      └───────────┬─────────────┘
           │                              │
           ▼                              ▼
    ┌──────────┐                  ┌──────────┐
    │ API GW   │                  │ API GW   │
    └──────────┘                  └──────────┘
```

## Environment Variables

### PII Deletion Function
- `USERS_TABLE` - Users DynamoDB table name
- `DRIVERS_TABLE` - Drivers DynamoDB table name
- `VENDORS_TABLE` - Vendors DynamoDB table name
- `CALL_RECORDS_TABLE` - Call records DynamoDB table name
- `AURORA_CLUSTER_ARN` - Aurora cluster ARN
- `AURORA_SECRET_ARN` - Aurora secret ARN
- `DATABASE_NAME` - Database name

### Data Export Function
- `USERS_TABLE` - Users DynamoDB table name
- `DRIVERS_TABLE` - Drivers DynamoDB table name
- `VENDORS_TABLE` - Vendors DynamoDB table name
- `INCIDENTS_TABLE` - Incidents DynamoDB table name
- `CALL_RECORDS_TABLE` - Call records DynamoDB table name
- `AURORA_CLUSTER_ARN` - Aurora cluster ARN
- `AURORA_SECRET_ARN` - Aurora secret ARN
- `DATABASE_NAME` - Database name
- `EXPORT_BUCKET` - S3 bucket for exports

### Right-to-Be-Forgotten Function
- All tables from Data Export
- `TRACKING_SESSIONS_TABLE` - Tracking sessions table
- `CALL_RECORDINGS_BUCKET` - Call recordings S3 bucket
- `INCIDENT_MEDIA_BUCKET` - Incident media S3 bucket
- `EVENT_BUS_NAME` - EventBridge event bus name

### Consent Management Function
- `CONSENT_TABLE` - Consent records DynamoDB table name

### Temporary Data Cleanup Function
- `TRACKING_SESSIONS_TABLE` - Tracking sessions table
- `CALL_RECORDINGS_BUCKET` - Call recordings S3 bucket
- `INCIDENT_MEDIA_BUCKET` - Incident media S3 bucket

## API Examples

### Record Consent (During Registration)
```bash
POST /compliance/consent
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "userId": "user-123",
  "consents": [
    {
      "type": "data_processing",
      "granted": true,
      "version": "1.0"
    },
    {
      "type": "marketing_communications",
      "granted": false,
      "version": "1.0"
    },
    {
      "type": "location_tracking",
      "granted": true,
      "version": "1.0"
    },
    {
      "type": "call_recording",
      "granted": true,
      "version": "1.0"
    }
  ]
}
```

### Export User Data
```bash
GET /compliance/export?userId=user-123
Authorization: Bearer {jwt_token}

Response:
{
  "message": "Data export completed",
  "downloadUrl": "https://s3.amazonaws.com/...",
  "expiresIn": 3600
}
```

### Request Data Deletion
```bash
POST /compliance/forget
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "userId": "user-123",
  "reason": "User requested account deletion"
}

Response:
{
  "message": "User data has been anonymized and deleted",
  "userId": "user-123",
  "completedAt": "2025-11-11T10:30:00Z"
}
```

### Update Consent
```bash
PUT /compliance/consent
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "userId": "user-123",
  "consentType": "marketing_communications",
  "granted": true
}

Response:
{
  "message": "Consent updated successfully",
  "userId": "user-123",
  "consentType": "marketing_communications",
  "granted": true,
  "updatedAt": "2025-11-11T10:30:00Z"
}
```

## Compliance Requirements

### GDPR Compliance
- ✅ Article 7: Consent management
- ✅ Article 15: Right to access (data export)
- ✅ Article 17: Right to erasure (right to be forgotten)
- ✅ Article 25: Data protection by design (data minimization)
- ✅ Article 30: Records of processing activities (audit logs)

### Data Retention
- ✅ PII deletion after 3 years of inactivity
- ✅ Temporary data deletion after 90 days
- ✅ Audit logs retained for 7 years
- ✅ S3 lifecycle policies for cost optimization

### Security
- ✅ Encryption at rest (KMS)
- ✅ Encryption in transit (TLS)
- ✅ Access control (IAM roles)
- ✅ Audit logging (CloudWatch + Aurora)
- ✅ Data anonymization (not deletion for analytics)

## Monitoring

### CloudWatch Metrics
- `InactiveUsersFound` - Count of users identified for PII deletion
- `PIIRecordsDeleted` - Count of PII records deleted
- `PIIDeletionErrors` - Count of errors during PII deletion
- `PIIDeletionJobFailures` - Count of job failures
- `RightToBeForgottenRequests` - Count of RTBF requests
- `RightToBeForgottenErrors` - Count of RTBF errors
- `TrackingSessionsDeleted` - Count of tracking sessions cleaned
- `CallRecordingsDeleted` - Count of call recordings deleted
- `IncidentMediaDeleted` - Count of incident media deleted
- `CleanupJobFailures` - Count of cleanup job failures

### CloudWatch Alarms
- PII deletion job failures
- Right-to-be-forgotten errors
- Cleanup job failures
- High error rates

## Testing

```bash
# Build the service
pnpm build

# Run type checking
pnpm typecheck

# Deploy to dev environment
cd ../../infrastructure
pnpm cdk deploy ComplianceStack --profile dev
```

## Future Enhancements

1. **Automated Consent Renewal**: Prompt users to renew consent annually
2. **Data Portability**: Export data in machine-readable formats (CSV, XML)
3. **Consent Versioning**: Track consent version changes over time
4. **Privacy Dashboard**: User-facing dashboard for managing privacy settings
5. **Data Breach Notification**: Automated notification system for data breaches
6. **Cookie Consent**: Web-based cookie consent management
7. **Third-Party Data Sharing**: Track and manage data shared with third parties
