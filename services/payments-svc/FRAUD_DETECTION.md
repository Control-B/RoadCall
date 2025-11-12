# Fraud Detection Implementation

## Overview

The payment service integrates Amazon Fraud Detector to automatically score vendor payments for fraud risk. Payments with high fraud scores (≥0.7) are flagged for manual review before processing.

## Architecture

```
Payment Created
    ↓
EventBridge (PaymentCreated event)
    ↓
Fraud Scoring Lambda
    ↓
Amazon Fraud Detector
    ↓
Update Payment with Fraud Score
    ↓
Route to Queue (Manual Review or Standard Approval)
```

## Components

### 1. Fraud Service (`fraud-service.ts`)

Core fraud detection logic:
- **`scoreFraudRisk()`**: Main function that calls Amazon Fraud Detector
- **`getVendorMetrics()`**: Gathers vendor historical data for scoring
- **`getIncidentDuration()`**: Calculates incident duration
- **`determineFraudStatus()`**: Maps fraud score to status (low/medium/high/flagged)

### 2. Fraud Scoring Handler (`handlers/score-fraud.ts`)

EventBridge-triggered Lambda that:
- Listens for `PaymentCreated` events
- Calls fraud detection service
- Updates payment record with fraud score
- Routes to appropriate queue (manual review or standard approval)
- Publishes `FraudDetected` event for flagged payments

### 3. Flagged Payments Handler (`handlers/get-flagged-payments.ts`)

API endpoint for back-office users to retrieve payments flagged for manual review.

## Fraud Detection Variables

The following variables are sent to Amazon Fraud Detector for scoring:

| Variable | Type | Description |
|----------|------|-------------|
| `payment_amount` | Float | Payment amount in dollars |
| `vendor_account_age_days` | Integer | Days since vendor account creation |
| `vendor_total_payments` | Integer | Total payments received by vendor |
| `vendor_payment_velocity_24h` | Integer | Payments in last 24 hours |
| `vendor_avg_payment_amount` | Float | Average payment amount |
| `vendor_completion_rate` | Float | Job completion rate (0-1) |
| `incident_duration_minutes` | Integer | Time from incident creation to completion |

## Fraud Status Levels

| Status | Score Range | Action |
|--------|-------------|--------|
| `low_risk` | 0.0 - 0.29 | Standard approval queue |
| `medium_risk` | 0.3 - 0.49 | Standard approval queue |
| `high_risk` | 0.5 - 0.69 | Standard approval queue |
| `flagged` | ≥ 0.7 | Manual review queue (high priority) |

## Configuration

Environment variables:

```bash
FRAUD_DETECTOR_NAME=vendor_payment_detector_dev
FRAUD_EVENT_TYPE=vendor_payment
FRAUD_THRESHOLD=0.7
```

## Database Schema

Fraud detection data is stored in the `payments` table:

```sql
ALTER TABLE payments ADD COLUMN fraud_score DECIMAL(3,2);
ALTER TABLE payments ADD COLUMN fraud_status VARCHAR(20);
```

Fraud detection metadata is stored in the `metadata` JSONB column:

```json
{
  "fraudDetection": {
    "riskLevel": "high_risk",
    "reasons": ["high_velocity", "new_vendor"],
    "modelScores": {
      "fraud_score": 0.75
    },
    "ruleResults": [
      {
        "ruleName": "high_velocity_rule",
        "outcome": "review"
      }
    ],
    "scoredAt": "2025-11-10T12:00:00Z"
  }
}
```

## API Endpoints

### Get Flagged Payments

```http
GET /payments/flagged?limit=50&offset=0
Authorization: Bearer <token>
```

Response:
```json
{
  "payments": [
    {
      "paymentId": "uuid",
      "incidentId": "uuid",
      "vendorId": "uuid",
      "amountCents": 50000,
      "fraudScore": 0.85,
      "fraudStatus": "flagged",
      "metadata": {
        "fraudDetection": {
          "reasons": ["high_velocity", "unusual_amount"]
        }
      }
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

## EventBridge Events

### FraudDetected Event

Published when a payment is flagged for manual review:

```json
{
  "source": "roadcall.payment-service",
  "detailType": "FraudDetected",
  "detail": {
    "paymentId": "uuid",
    "incidentId": "uuid",
    "vendorId": "uuid",
    "fraudScore": 0.85,
    "fraudStatus": "flagged",
    "reasons": ["high_velocity", "unusual_amount"],
    "flaggedAt": "2025-11-10T12:00:00Z"
  }
}
```

## SQS Queue Messages

### Manual Review Queue Message

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
  "flaggedAt": "2025-11-10T12:00:00Z"
}
```

Message attributes:
- `Priority`: "high"
- `Reason`: "fraud_flagged"
- `FraudScore`: "0.85"

## Performance

- **Target**: Fraud detection completes within 5 seconds
- **Monitoring**: CloudWatch logs include `durationMs` metric
- **Warning**: Logged if detection exceeds 5-second SLA

## Setup Instructions

### 1. Deploy Infrastructure

```bash
cd infrastructure
npm run build
cdk deploy PaymentsStack
```

This creates:
- Fraud Detector event type and variables
- Lambda functions for fraud scoring
- EventBridge rules
- API Gateway endpoints

### 2. Configure Fraud Detector (Manual Steps)

⚠️ **Important**: Amazon Fraud Detector requires manual configuration in the AWS Console:

1. **Go to AWS Fraud Detector Console**
   - Navigate to: https://console.aws.amazon.com/frauddetector

2. **Create a Model**
   - Event type: `vendor_payment`
   - Model type: Online Fraud Insights
   - Training data: Upload historical payment data with labels (fraud/legit)
   - Train the model (takes 1-2 hours)

3. **Create Detector**
   - Name: `vendor_payment_detector_dev` (or your stage)
   - Add the trained model
   - Create rules:
     ```
     Rule: high_fraud_score
     Expression: $fraud_score >= 0.7
     Outcome: review
     
     Rule: medium_fraud_score
     Expression: $fraud_score >= 0.5 and $fraud_score < 0.7
     Outcome: review
     
     Rule: low_fraud_score
     Expression: $fraud_score < 0.5
     Outcome: approve
     ```

4. **Activate Detector Version**
   - Review detector configuration
   - Activate the detector version

### 3. Test Fraud Detection

```bash
# Create a test payment
curl -X POST https://api.example.com/payments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "incidentId": "test-incident",
    "vendorId": "test-vendor",
    "payerType": "back_office",
    "amountCents": 50000,
    "lineItems": [
      {
        "description": "Tire repair",
        "quantity": 1,
        "unitPriceCents": 50000
      }
    ]
  }'

# Check fraud score in response or CloudWatch logs
```

## Monitoring

### CloudWatch Metrics

- `FraudDetectionDuration`: Time taken for fraud scoring
- `FraudDetectionErrors`: Failed fraud detection attempts
- `PaymentsFlagged`: Count of payments flagged for review

### CloudWatch Logs

Search for:
```
fields @timestamp, paymentId, fraudScore, fraudStatus, durationMs
| filter @message like /Fraud detection completed/
| sort @timestamp desc
```

### Alarms

- Alert when fraud detection duration > 5 seconds
- Alert when fraud detection error rate > 5%
- Alert when flagged payments queue depth > 50

## Error Handling

If fraud detection fails:
1. Error is logged to CloudWatch
2. Payment is assigned fraud score of 1.0 (maximum risk)
3. Payment is flagged for manual review
4. Payment status remains `pending_approval`

This fail-safe approach ensures suspicious payments are reviewed even if fraud detection fails.

## Cost Optimization

- Fraud Detector charges per prediction (~$7.50 per 1000 predictions)
- Consider caching vendor metrics to reduce database queries
- Use DynamoDB for vendor data if Aurora queries are slow
- Monitor prediction volume and adjust threshold if needed

## Security

- Fraud Detector IAM permissions are scoped to Lambda execution role
- Fraud scores and reasons are stored encrypted in Aurora
- Access to flagged payments requires dispatcher/admin role
- All fraud detection events are logged for audit

## Future Enhancements

1. **Model Retraining**: Automate model retraining with new fraud data
2. **Custom Rules**: Add business-specific fraud rules
3. **Real-time Alerts**: Notify security team of high-risk payments
4. **Vendor Blocklist**: Automatically block vendors with repeated fraud
5. **Machine Learning**: Use historical data to improve fraud detection accuracy
