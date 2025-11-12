# Fraud Detection Implementation

## Overview

The fraud detection system for the AI Roadcall Assistant platform uses **Amazon Fraud Detector** to score vendor payments for fraud risk. Payments with high fraud scores (≥0.7) are automatically flagged for manual review, while lower-risk payments proceed through the normal approval workflow.

## Architecture

```
┌─────────────────┐
│  Work Completed │
│     Event       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Create Payment  │
│    Handler      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────────┐
│ PaymentCreated  │─────▶│  Score Fraud     │
│     Event       │      │    Handler       │
└─────────────────┘      └────────┬─────────┘
                                  │
                                  ▼
                         ┌────────────────────┐
                         │ Amazon Fraud       │
                         │   Detector         │
                         │ - Score payment    │
                         │ - Evaluate rules   │
                         │ - Return risk level│
                         └────────┬───────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
         ┌──────────────────┐        ┌──────────────────┐
         │ Fraud Score < 0.7│        │ Fraud Score ≥ 0.7│
         │  (Low/Med Risk)  │        │   (Flagged)      │
         └────────┬─────────┘        └────────┬─────────┘
                  │                           │
                  ▼                           ▼
         ┌──────────────────┐        ┌──────────────────┐
         │ Normal Approval  │        │ Manual Review    │
         │     Queue        │        │     Queue        │
         │  (Priority: Low) │        │ (Priority: High) │
         └──────────────────┘        └──────────────────┘
                  │                           │
                  └───────────┬───────────────┘
                              ▼
                     ┌──────────────────┐
                     │ Back Office      │
                     │ Approval         │
                     └──────────────────┘
```

## Components

### 1. Fraud Service (`fraud-service.ts`)

**Purpose**: Core fraud detection logic using Amazon Fraud Detector

**Key Functions**:

- `scoreFraudRisk(input)`: Main function that scores a payment for fraud risk
- `getVendorMetrics(vendorId)`: Retrieves vendor historical data for scoring
- `getIncidentDuration(incidentId)`: Calculates incident duration
- `shouldFlagForManualReview(result)`: Determines if payment needs manual review
- `determineFraudStatus(score)`: Maps fraud score to status (low/medium/high/flagged)

**Fraud Detection Variables**:

| Variable | Type | Description |
|----------|------|-------------|
| `payment_amount` | FLOAT | Payment amount in dollars |
| `vendor_account_age_days` | INTEGER | Days since vendor account created |
| `vendor_total_payments` | INTEGER | Total payments received by vendor |
| `vendor_payment_velocity_24h` | INTEGER | Payments in last 24 hours |
| `vendor_avg_payment_amount` | FLOAT | Average payment amount |
| `vendor_completion_rate` | FLOAT | Job completion rate (0-1) |
| `incident_duration_minutes` | INTEGER | Time from incident creation to completion |

**Fraud Score Thresholds**:

- **< 0.3**: Low risk (auto-approve eligible)
- **0.3 - 0.5**: Medium risk (standard approval)
- **0.5 - 0.7**: High risk (careful review)
- **≥ 0.7**: Flagged (mandatory manual review)

**Performance SLA**: Fraud detection must complete within **5 seconds**

### 2. Score Fraud Handler (`handlers/score-fraud.ts`)

**Purpose**: Lambda function triggered by PaymentCreated events

**Trigger**: EventBridge event with detail type `PaymentCreated`

**Workflow**:

1. Receive PaymentCreated event
2. Call `scoreFraudRisk()` with payment details
3. Update payment record with fraud score and status
4. If flagged (score ≥ 0.7):
   - Publish `FraudDetected` event
   - Send to manual review queue (high priority)
5. If not flagged:
   - Send to normal approval queue

**Error Handling**: Does not retry on failure to prevent duplicate fraud checks. Payment remains in `pending_approval` status for manual intervention.

### 3. Get Flagged Payments Handler (`handlers/get-flagged-payments.ts`)

**Purpose**: API endpoint to retrieve payments flagged for fraud

**Endpoint**: `GET /payments/flagged`

**Query Parameters**:
- `limit` (default: 50): Number of results per page
- `offset` (default: 0): Pagination offset
- `fraudStatus` (optional): Filter by specific fraud status

**Authorization**: Requires `dispatcher` or `admin` role

**Response**:
```json
{
  "payments": [
    {
      "paymentId": "uuid",
      "incidentId": "uuid",
      "vendorId": "uuid",
      "amountCents": 25000,
      "fraudScore": 0.85,
      "fraudStatus": "flagged",
      "metadata": {
        "fraudDetection": {
          "riskLevel": "high",
          "reasons": ["high_velocity", "unusual_amount"],
          "modelScores": { "fraud_score": 0.85 },
          "scoredAt": "2025-11-11T10:30:00Z"
        }
      },
      "lineItems": [...]
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

### 4. Manual Review Queue

**Queue Type**: Amazon SQS

**Message Format**:
```json
{
  "paymentId": "uuid",
  "priority": "high",
  "reason": "fraud_flagged",
  "fraudScore": 0.85,
  "fraudStatus": "flagged",
  "fraudReasons": ["high_velocity", "unusual_amount"],
  "payment": { /* full payment object */ },
  "lineItems": [ /* line items */ ],
  "flaggedAt": "2025-11-11T10:30:00Z"
}
```

**Message Attributes**:
- `Priority`: "high" for flagged payments, "normal" for standard
- `Reason`: "fraud_flagged" or "standard_approval"
- `FraudScore`: Numeric fraud score

**Processing**: Back-office dispatchers poll this queue via API to review and approve/reject payments

## Infrastructure Setup

### Amazon Fraud Detector Configuration

The fraud detector is configured via CDK custom resource in `infrastructure/lib/fraud-detector-setup.ts`.

**Automated Setup**:
1. ✅ Entity Type: `vendor`
2. ✅ Event Type: `vendor_payment`
3. ✅ Variables: All 7 fraud detection variables
4. ✅ Outcomes: `approve`, `review`, `block`

**Manual Steps Required** (one-time setup):

1. **Go to AWS Fraud Detector Console**
   - Navigate to: https://console.aws.amazon.com/frauddetector

2. **Create Model**
   - Event type: `vendor_payment`
   - Model type: Online Fraud Insights
   - Training data: Upload historical payment data (CSV format)
   - Required columns: `EVENT_TIMESTAMP`, `EVENT_LABEL` (fraud/legit), all variables

3. **Train Model**
   - Review training metrics (AUC, precision, recall)
   - Adjust model if needed
   - Deploy model version

4. **Create Detector**
   - Name: `vendor_payment_detector_{stage}`
   - Add model to detector
   - Create rules:
     ```
     Rule: high_fraud_score
     Condition: $fraud_score >= 0.7
     Outcome: review
     
     Rule: medium_fraud_score
     Condition: $fraud_score >= 0.5 AND $fraud_score < 0.7
     Outcome: review
     
     Rule: low_fraud_score
     Condition: $fraud_score < 0.5
     Outcome: approve
     ```

5. **Activate Detector Version**
   - Review detector configuration
   - Activate for production use

### Environment Variables

Required environment variables for Lambda functions:

```bash
FRAUD_DETECTOR_NAME=vendor_payment_detector_prod
FRAUD_EVENT_TYPE=vendor_payment
FRAUD_THRESHOLD=0.7
APPROVAL_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/...
```

### IAM Permissions

Lambda functions require:

```json
{
  "Effect": "Allow",
  "Action": [
    "frauddetector:GetEventPrediction",
    "frauddetector:GetDetectors",
    "frauddetector:GetEventTypes"
  ],
  "Resource": "*"
}
```

Note: Fraud Detector doesn't support resource-level permissions.

## Database Schema

### Payments Table

Fraud-related columns:

```sql
CREATE TABLE payments (
  -- ... other columns ...
  fraud_score DECIMAL(3,2),           -- 0.00 to 1.00
  fraud_status VARCHAR(20),           -- low_risk, medium_risk, high_risk, flagged
  metadata JSONB,                     -- Contains fraudDetection object
  -- ... other columns ...
);

CREATE INDEX idx_payments_fraud_status ON payments(fraud_status);
CREATE INDEX idx_payments_fraud_score ON payments(fraud_score DESC);
```

### Fraud Detection Metadata

Stored in `payments.metadata.fraudDetection`:

```json
{
  "fraudDetection": {
    "riskLevel": "high",
    "reasons": ["high_velocity", "unusual_amount"],
    "modelScores": {
      "fraud_score": 0.85
    },
    "ruleResults": [
      {
        "ruleName": "high_fraud_score",
        "outcome": "review"
      }
    ],
    "scoredAt": "2025-11-11T10:30:00Z"
  }
}
```

## Testing

### Unit Tests

Test fraud score calculation logic:

```typescript
describe('Fraud Detection', () => {
  it('should flag payment with high fraud score', async () => {
    const result = await scoreFraudRisk({
      paymentId: 'test-123',
      incidentId: 'incident-123',
      vendorId: 'vendor-123',
      amountCents: 50000,
      payerType: 'back_office'
    });
    
    expect(result.fraudScore).toBeGreaterThanOrEqual(0);
    expect(result.fraudScore).toBeLessThanOrEqual(1);
    expect(result.fraudStatus).toBeOneOf(['low_risk', 'medium_risk', 'high_risk', 'flagged']);
  });
  
  it('should flag for manual review when score >= 0.7', () => {
    const result = {
      fraudScore: 0.85,
      fraudStatus: 'flagged',
      riskLevel: 'high',
      reasons: ['high_velocity'],
      modelScores: {},
      ruleResults: []
    };
    
    expect(shouldFlagForManualReview(result)).toBe(true);
  });
});
```

### Integration Tests

Test end-to-end fraud detection flow:

```typescript
describe('Fraud Detection Integration', () => {
  it('should score payment and route to correct queue', async () => {
    // Create payment
    const payment = await createPayment({
      incidentId: 'incident-123',
      vendorId: 'vendor-123',
      payerType: 'back_office',
      amountCents: 25000,
      lineItems: [{ description: 'Tire repair', quantity: 1, unitPriceCents: 25000 }]
    }, 'system');
    
    // Trigger fraud detection
    await handler({
      detail: {
        paymentId: payment.paymentId,
        incidentId: payment.incidentId,
        vendorId: payment.vendorId,
        amountCents: payment.amountCents,
        payerType: payment.payerType,
        status: payment.status,
        createdAt: payment.createdAt
      }
    });
    
    // Verify payment updated with fraud score
    const updated = await getPaymentById(payment.paymentId);
    expect(updated.payment.fraudScore).toBeDefined();
    expect(updated.payment.fraudStatus).toBeDefined();
    
    // Verify message sent to appropriate queue
    const messages = await receiveMessages(APPROVAL_QUEUE_URL);
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain(payment.paymentId);
  });
});
```

## Monitoring and Alerts

### CloudWatch Metrics

Custom metrics published:

- `FraudDetection/ScoreLatency`: Time to score payment (target: <5s)
- `FraudDetection/FlaggedPayments`: Count of flagged payments
- `FraudDetection/FraudScoreDistribution`: Distribution of fraud scores
- `FraudDetection/Errors`: Fraud detection errors

### CloudWatch Alarms

Recommended alarms:

1. **High Fraud Detection Latency**
   - Metric: `FraudDetection/ScoreLatency` P95
   - Threshold: > 5000ms
   - Action: Alert DevOps team

2. **Fraud Detection Error Rate**
   - Metric: `FraudDetection/Errors`
   - Threshold: > 5% of requests
   - Action: Alert DevOps team

3. **Unusual Fraud Rate**
   - Metric: `FraudDetection/FlaggedPayments`
   - Threshold: > 20% of payments
   - Action: Alert fraud team

### Logging

All fraud detection events are logged with structured JSON:

```json
{
  "level": "INFO",
  "message": "Fraud detection completed",
  "paymentId": "uuid",
  "fraudScore": 0.35,
  "fraudStatus": "medium_risk",
  "riskLevel": "medium",
  "durationMs": 1250,
  "timestamp": "2025-11-11T10:30:00Z"
}
```

## Operational Procedures

### Reviewing Flagged Payments

1. **Access Flagged Payments**
   ```bash
   GET /payments/flagged?limit=50&offset=0
   ```

2. **Review Payment Details**
   - Check fraud score and reasons
   - Review incident details
   - Verify vendor history
   - Check for anomalies

3. **Approve or Reject**
   ```bash
   POST /payments/{paymentId}/approve
   # or
   POST /payments/{paymentId}/reject
   ```

### Adjusting Fraud Threshold

To change the fraud threshold (default: 0.7):

1. Update environment variable:
   ```bash
   FRAUD_THRESHOLD=0.8  # More strict
   # or
   FRAUD_THRESHOLD=0.6  # More lenient
   ```

2. Redeploy Lambda functions

3. Monitor impact on flagged payment rate

### Model Retraining

Retrain the fraud detection model periodically:

1. **Export Training Data**
   ```sql
   SELECT 
     payment_id as EVENT_ID,
     created_at as EVENT_TIMESTAMP,
     CASE WHEN fraud_status = 'flagged' THEN 'fraud' ELSE 'legit' END as EVENT_LABEL,
     amount_cents / 100.0 as payment_amount,
     -- ... other variables
   FROM payments
   WHERE created_at >= NOW() - INTERVAL '90 days'
   ```

2. **Upload to S3**
   ```bash
   aws s3 cp training_data.csv s3://fraud-detector-training/
   ```

3. **Create New Model Version**
   - AWS Console → Fraud Detector → Models
   - Create new version with updated data
   - Train and evaluate

4. **Update Detector**
   - Add new model version to detector
   - Test with sample data
   - Activate new detector version

## Compliance and Audit

### Audit Trail

All fraud detection decisions are logged in:

1. **Payment Audit Log Table**
   ```sql
   SELECT * FROM payment_audit_log 
   WHERE payment_id = 'uuid' 
   AND action LIKE '%fraud%'
   ORDER BY timestamp DESC;
   ```

2. **CloudWatch Logs**
   - Log group: `/aws/lambda/score-fraud-handler`
   - Retention: 90 days
   - Searchable by payment ID

3. **EventBridge Events**
   - Event type: `FraudDetected`
   - Archived for 90 days
   - Replayable for analysis

### Data Privacy

- Fraud detection uses only transaction metadata
- No PII is sent to Fraud Detector
- Vendor IDs are pseudonymized
- All data encrypted at rest and in transit

## Troubleshooting

### Common Issues

**Issue**: Fraud detection taking > 5 seconds

**Solution**:
- Check Fraud Detector model status
- Verify database query performance
- Review Lambda timeout settings
- Check for network issues

**Issue**: All payments being flagged

**Solution**:
- Review fraud threshold setting
- Check model training data quality
- Verify detector rules configuration
- Inspect recent model changes

**Issue**: Fraud detection errors

**Solution**:
- Check IAM permissions
- Verify Fraud Detector is activated
- Review CloudWatch logs for details
- Ensure all required variables are provided

## Future Enhancements

1. **Machine Learning Improvements**
   - Add more features (time of day, location patterns)
   - Implement ensemble models
   - Use real-time feature engineering

2. **Automated Actions**
   - Auto-block extremely high-risk payments
   - Implement velocity limits per vendor
   - Add geolocation-based rules

3. **Advanced Analytics**
   - Fraud pattern detection
   - Vendor risk scoring dashboard
   - Predictive fraud alerts

4. **Integration Enhancements**
   - Real-time fraud alerts to dispatchers
   - Automated vendor suspension for repeated fraud
   - Integration with external fraud databases

## References

- [Amazon Fraud Detector Documentation](https://docs.aws.amazon.com/frauddetector/)
- [Fraud Detector Best Practices](https://docs.aws.amazon.com/frauddetector/latest/ug/best-practices.html)
- [Requirements 19.2, 19.3](../../.kiro/specs/ai-roadcall-assistant/requirements.md)
