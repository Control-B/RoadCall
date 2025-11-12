# Incident Lifecycle State Machine

This directory contains the AWS Step Functions state machine implementation for managing the complete incident lifecycle with timeout handling and escalation logic.

## Overview

The state machine orchestrates the incident lifecycle from creation to closure, handling:

- **Vendor Matching**: Triggers vendor matching with configurable search radius
- **Response Timeout**: 2-minute timeout for vendor to accept offer
- **Radius Expansion**: Automatically expands search radius by 25% on timeout (max 3 attempts)
- **Arrival Timeout**: 30-minute timeout for vendor to arrive at incident location
- **Vendor Reassignment**: Automatically reassigns incident if vendor fails to arrive
- **Escalation**: Escalates to dispatcher after max matching attempts
- **Error Handling**: Comprehensive retry logic and error handling

## State Machine Flow

```
InitializeIncident
    ↓
TriggerVendorMatching
    ↓
WaitForVendorResponse (2 min)
    ↓
CheckVendorResponse
    ↓
HasVendorResponded? ──No──→ UpdateSearchParameters ──→ (retry with expanded radius)
    ↓ Yes                         ↓
    |                      (after 3 attempts)
    |                             ↓
    |                    EscalateToDispatcher
    ↓
VendorAssigned
    ↓
WaitForVendorArrival (check every 5 min)
    ↓
CheckVendorArrival
    ↓
HasVendorArrived? ──No (timeout)──→ HandleVendorTimeout ──→ (restart matching)
    ↓ Yes
VendorArrived
    ↓
IncidentComplete
```

## Lambda Handlers

### check-vendor-response.ts
Checks if a vendor has accepted the incident offer.

**Input:**
```json
{
  "incidentId": "string",
  "attempt": 1,
  "radiusMiles": 50
}
```

**Output:**
```json
{
  "hasVendor": true,
  "vendorId": "string",
  "status": "vendor_assigned"
}
```
or
```json
{
  "hasVendor": false,
  "shouldEscalate": false,
  "attempt": 2,
  "radiusMiles": 62.5
}
```

### check-vendor-arrival.ts
Checks if the assigned vendor has arrived at the incident location.

**Input:**
```json
{
  "incidentId": "string",
  "vendorId": "string",
  "assignedAt": "2024-01-01T00:00:00Z"
}
```

**Output:**
```json
{
  "hasArrived": true,
  "status": "vendor_arrived"
}
```
or
```json
{
  "hasArrived": false,
  "isTimeout": true,
  "elapsedMinutes": 35
}
```

### trigger-vendor-matching.ts
Publishes a MatchRequested event to EventBridge to trigger the match service.

**Input:**
```json
{
  "incidentId": "string",
  "attempt": 1,
  "radiusMiles": 50
}
```

**Output:**
```json
{
  "matchRequested": true,
  "attempt": 1,
  "radiusMiles": 50
}
```

### handle-vendor-timeout.ts
Handles vendor arrival timeout by resetting the incident and triggering new matching.

**Input:**
```json
{
  "incidentId": "string",
  "vendorId": "string",
  "elapsedMinutes": 35
}
```

**Output:**
```json
{
  "timeoutHandled": true,
  "previousVendorId": "string",
  "retriggeredMatching": true
}
```

### escalate-incident.ts
Escalates the incident to a dispatcher when no vendor is found after max attempts.

**Input:**
```json
{
  "incidentId": "string",
  "attempt": 3,
  "reason": "No vendor found after maximum attempts"
}
```

**Output:**
```json
{
  "escalated": true,
  "reason": "string",
  "attempts": 3
}
```

### send-task-token.ts
Handles EventBridge events to resume state machine execution using task tokens.

**Supported Events:**
- `OfferAccepted`: Vendor accepts offer
- `WorkCompleted`: Vendor completes work
- `PaymentApproved`: Payment is approved

## Configuration

### Timeouts
- **Vendor Response**: 2 minutes
- **Vendor Arrival Check**: Every 5 minutes
- **Vendor Arrival Max**: 30 minutes
- **Work Completion**: 24 hours
- **Payment Approval**: 7 days

### Retry Logic
- **Lambda Failures**: 2-3 retries with exponential backoff
- **Vendor Matching**: 3 attempts with 25% radius expansion
- **State Transitions**: Automatic retry on transient failures

### Escalation
- **Max Attempts**: 3 vendor matching attempts
- **Radius Expansion**: 25% per attempt (50mi → 62.5mi → 78.125mi)
- **Escalation Target**: Dispatcher notification via EventBridge

## EventBridge Integration

### Published Events

**IncidentEscalated**
```json
{
  "source": "roadcall.incident-service",
  "detail-type": "IncidentEscalated",
  "detail": {
    "incidentId": "string",
    "reason": "string",
    "attempts": 3,
    "escalatedAt": "2024-01-01T00:00:00Z",
    "requiresManualIntervention": true
  }
}
```

**VendorTimeout**
```json
{
  "source": "roadcall.incident-service",
  "detail-type": "VendorTimeout",
  "detail": {
    "incidentId": "string",
    "vendorId": "string",
    "timeoutType": "arrival",
    "elapsedMinutes": 35,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

**MatchRequested**
```json
{
  "source": "roadcall.incident-service",
  "detail-type": "MatchRequested",
  "detail": {
    "incidentId": "string",
    "driverId": "string",
    "type": "tire",
    "location": { "lat": 40.7128, "lon": -74.0060 },
    "radiusMiles": 50,
    "attempt": 1,
    "requestedAt": "2024-01-01T00:00:00Z"
  }
}
```

### Consumed Events

**IncidentCreated** - Triggers state machine execution
**OfferAccepted** - Updates state machine on vendor acceptance
**WorkCompleted** - Resumes state machine after work completion
**PaymentApproved** - Resumes state machine after payment approval

## Monitoring

### CloudWatch Metrics
- `ExecutionsFailed`: Number of failed executions
- `ExecutionsTimedOut`: Number of timed out executions
- `ExecutionTime`: Duration of executions
- `ExecutionsSucceeded`: Number of successful executions

### CloudWatch Alarms
- **StateMachineFailureAlarm**: Triggers when 5+ executions fail in 5 minutes
- **StateMachineTimeoutAlarm**: Triggers when 3+ executions timeout in 5 minutes

### X-Ray Tracing
All Lambda functions and state machine executions are traced with AWS X-Ray for distributed tracing and performance analysis.

## Error Handling

### Retry Strategy
- **Lambda Invocation Errors**: 2-3 retries with exponential backoff (2s, 4s, 8s)
- **Transient Failures**: Automatic retry with jitter
- **Permanent Failures**: Caught and escalated to dispatcher

### Fallback Mechanisms
- **Vendor Matching Failure**: Expand radius and retry
- **Max Attempts Reached**: Escalate to dispatcher
- **Vendor Timeout**: Reassign to new vendor
- **Critical Errors**: Escalate with error details

## Deployment

The state machine is deployed via CDK in `infrastructure/lib/incident-state-machine-stack.ts`.

### Prerequisites
- DynamoDB Incidents table
- EventBridge event bus
- KMS encryption key
- IAM roles with appropriate permissions

### CDK Deployment
```bash
cd infrastructure
cdk deploy IncidentStateMachineStack
```

## Testing

### Unit Tests
Test individual Lambda handlers with mocked AWS SDK calls.

### Integration Tests
Test state machine execution with LocalStack or AWS test environment.

### Example Test Scenarios
1. **Happy Path**: Incident created → Vendor accepts → Vendor arrives → Complete
2. **Timeout & Retry**: No vendor response → Expand radius → Retry → Success
3. **Escalation**: 3 failed attempts → Escalate to dispatcher
4. **Vendor Timeout**: Vendor assigned → Fails to arrive → Reassign → Success

## Requirements Mapping

This implementation satisfies the following requirements:

- **Requirement 7.4**: Incident lifecycle state machine with timeout handling
- **Requirement 7.5**: Escalation logic for no vendor found after 3 radius expansions
- **Requirement 4.5**: 2-minute vendor response timeout
- **Requirement 6.5**: 30-minute vendor arrival timeout with automatic status update

## Future Enhancements

- [ ] Dynamic timeout configuration based on incident type
- [ ] Machine learning-based radius expansion
- [ ] Priority-based vendor matching
- [ ] Real-time state machine monitoring dashboard
- [ ] Automated rollback on critical failures
