# Payment Service

The Payment Service manages vendor payment processing, approval workflows, and payment records for the AI Roadcall Assistant platform.

## Overview

This service handles:
- Payment record creation when work is completed
- Back-office approval workflow
- Payment status tracking
- Audit logging of all payment actions
- Integration with Stripe for payment processing (future)
- Fraud detection integration (future)

## Architecture

### Database

The service uses **Aurora Postgres** for transactional payment data with the following tables:

- `payments` - Main payment records
- `payment_line_items` - Itemized charges
- `payment_audit_log` - Complete audit trail

### Connection Pooling

The service implements connection pooling using `pg` with:
- Maximum 10 connections per Lambda instance
- 30-second idle timeout
- Automatic credential rotation via Secrets Manager
- 1-hour credential cache TTL

### Transaction Management

All payment operations use database transactions to ensure:
- Atomicity of payment + line items + audit log
- Consistency during concurrent operations
- Isolation for approval workflows

## API Endpoints

### POST /payments
Create a new payment record.

**Request:**
```json
{
  "incidentId": "uuid",
  "vendorId": "uuid",
  "payerType": "back_office" | "driver_ic",
  "payerId": "uuid",
  "amountCents": 15000,
  "currency": "USD",
  "lineItems": [
    {
      "description": "Tire Replacement - Base Service",
      "quantity": 1,
      "unitPriceCents": 12000
    },
    {
      "description": "Mileage Charge",
      "quantity": 1,
      "unitPriceCents": 3000
    }
  ],
  "metadata": {
    "serviceType": "tire_replacement",
    "duration": 45
  }
}
```

**Response:** `201 Created`
```json
{
  "paymentId": "uuid",
  "incidentId": "uuid",
  "vendorId": "uuid",
  "status": "pending_approval",
  "amountCents": 15000,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### GET /payments/:id
Get payment details with line items.

**Response:** `200 OK`
```json
{
  "payment": {
    "paymentId": "uuid",
    "status": "pending_approval",
    "amountCents": 15000,
    ...
  },
  "lineItems": [
    {
      "lineItemId": "uuid",
      "description": "Tire Replacement",
      "totalCents": 12000
    }
  ]
}
```

### POST /payments/:id/approve
Approve a payment (dispatcher/admin only).

**Response:** `200 OK`
```json
{
  "paymentId": "uuid",
  "status": "approved",
  "approvedBy": "uuid",
  "approvedAt": "2024-01-01T00:00:00Z"
}
```

### GET /payments/pending
Get pending payment approvals (dispatcher/admin only).

**Query Parameters:**
- `limit` - Number of records (default: 50)
- `offset` - Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "payments": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 10
  }
}
```

## Event Handlers

### WorkCompleted Event
Automatically creates payment record when vendor completes work.

**Event Source:** EventBridge
**Detail Type:** `WorkCompleted`

**Processing:**
1. Extract pricing from event
2. Create payment with line items
3. Set status to `pending_approval`
4. Send to SQS approval queue
5. Publish `PaymentCreated` event

## Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  payment_id UUID PRIMARY KEY,
  incident_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  payer_type VARCHAR(20) NOT NULL,
  amount_cents INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  fraud_score DECIMAL(3,2),
  approved_by UUID,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes
- `idx_payments_status` - Query by status
- `idx_payments_incident` - Query by incident
- `idx_payments_vendor` - Query by vendor
- `idx_payments_fraud_status` - Query flagged payments

## Environment Variables

- `AURORA_SECRET_ARN` - Secrets Manager ARN for database credentials
- `AURORA_ENDPOINT` - Aurora cluster endpoint
- `DATABASE_NAME` - Database name (default: roadcall)
- `APPROVAL_QUEUE_URL` - SQS queue URL for approval workflow
- `EVENT_BUS_NAME` - EventBridge bus name

## Payment Status Flow

```
pending_approval → approved → processing → completed
                ↓
            cancelled
                ↓
              failed
```

## Security

### Authentication
- All API endpoints require JWT authentication via Cognito
- Approval endpoints require `dispatcher` or `admin` role

### Authorization
- Vendors can view their own payments
- Dispatchers can approve payments for their company
- Admins have full access

### Data Protection
- Database encrypted at rest with KMS
- Credentials stored in Secrets Manager
- TLS for all connections
- Audit log for all actions

## Monitoring

### CloudWatch Metrics
- Payment creation rate
- Approval queue depth
- Average approval time
- Failed payment rate

### Alarms
- High fraud score rate
- Approval queue backlog
- Database connection errors

## Future Enhancements

1. **Stripe Integration** (Task 19)
   - Payment processing
   - Vendor payouts via Stripe Connect
   - Webhook handling

2. **Fraud Detection** (Task 20)
   - Amazon Fraud Detector integration
   - Automatic flagging
   - Manual review queue

3. **Reporting** (Task 22)
   - Payment analytics
   - Vendor payout reports
   - Cost per incident analysis
