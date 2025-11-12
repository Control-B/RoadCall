# Step Functions State Machine Implementation

## Overview

This document describes the implementation of the AWS Step Functions state machine for managing the incident lifecycle in the AI Roadcall Assistant platform.

## Architecture

The state machine orchestrates the complete incident lifecycle with the following key features:

### 1. Vendor Matching with Timeout
- **Initial Radius**: 50 miles
- **Timeout**: 2 minutes for vendor to accept offer
- **Retry Logic**: Expands radius by 25% on timeout
- **Max Attempts**: 3 attempts before escalation

### 2. Vendor Arrival Monitoring
- **Check Interval**: Every 5 minutes
- **Timeout**: 30 minutes for vendor to arrive
- **Action on Timeout**: Reassign incident to new vendor

### 3. Escalation
- **Trigger**: No vendor found after 3 attempts
- **Action**: Notify dispatcher via EventBridge event
- **Status**: Incident marked for manual intervention

## Components

### Lambda Functions

#### 1. check-vendor-response
**Purpose**: Check if a vendor has accepted the incident offer

**Logic**:
- Query incident from DynamoDB
- Check if `assignedVendorId` is set or status is `vendor_assigned`
- If yes: Return vendor info
- If no and attempt < 3: Expand radius by 25%
- If no and attempt >= 3: Flag for escalation

**Input**:
```typescript
{
  incidentId: string;
  attempt: number;
  radiusMiles: number;
}
```

**Output**:
```typescript
{
  hasVendor: boolean;
  shouldEscalate?: boolean;
  vendorId?: string;
  attempt?: number;
  radiusMiles?: number;
}
```

#### 2. check-vendor-arrival
**Purpose**: Check if vendor has arrived at incident location

**Logic**:
- Query incident from DynamoDB
- Check status (vendor_arrived, work_in_progress, work_completed)
- Calculate elapsed time since assignment
- If elapsed > 30 minutes: Flag as timeout

**Input**:
```typescript
{
  incidentId: string;
  vendorId: string;
  assignedAt: string;
}
```

**Output**:
```typescript
{
  hasArrived: boolean;
  isTimeout?: boolean;
  elapsedMinutes?: number;
}
```

#### 3. trigger-vendor-matching
**Purpose**: Publish MatchRequested event to trigger match service

**Logic**:
- Query incident details
- Publish EventBridge event with incident info and search parameters
- Match service subscribes to this event and performs vendor matching

**Event Published**:
```typescript
{
  source: 'roadcall.incident-service',
  detailType: 'MatchRequested',
  detail: {
    incidentId: string;
    driverId: string;
    type: IncidentType;
    location: Location;
    radiusMiles: number;
    attempt: number;
  }
}
```

#### 4. handle-vendor-timeout
**Purpose**: Handle vendor arrival timeout and trigger reassignment

**Logic**:
- Reset incident status to 'created'
- Clear vendor assignment
- Publish VendorTimeout event
- Publish IncidentCreated event to trigger new matching

**Events Published**:
- `VendorTimeout`: Notifies about timeout
- `IncidentCreated`: Triggers new vendor matching

#### 5. escalate-incident
**Purpose**: Escalate incident to dispatcher when no vendor found

**Logic**:
- Update incident with escalation reason
- Publish IncidentEscalated event
- Dispatcher receives notification for manual intervention

**Event Published**:
```typescript
{
  source: 'roadcall.incident-service',
  detailType: 'IncidentEscalated',
  detail: {
    incidentId: string;
    reason: string;
    attempts: number;
    requiresManualIntervention: true;
  }
}
```

#### 6. send-task-token
**Purpose**: Handle EventBridge events to resume state machine execution

**Note**: Currently simplified - task token functionality will be added when implementing work completion and payment approval flows.

### State Machine Definition

The state machine is defined in `definition.ts` and deployed via CDK in `incident-state-machine-stack.ts`.

#### Key States

1. **InitializeIncident**: Set initial parameters (attempt=1, radius=50mi)
2. **TriggerVendorMatching**: Invoke Lambda to publish match request
3. **WaitForVendorResponse**: Wait 2 minutes
4. **CheckVendorResponse**: Check if vendor accepted
5. **HasVendorResponded**: Decision point
   - Yes → VendorAssigned
   - No (not max attempts) → UpdateSearchParameters → retry
   - No (max attempts) → EscalateToDispatcher
6. **VendorAssigned**: Vendor accepted, start arrival monitoring
7. **WaitForVendorArrival**: Wait 5 minutes
8. **CheckVendorArrival**: Check if vendor arrived
9. **HasVendorArrived**: Decision point
   - Yes → VendorArrived → Complete
   - No (timeout) → HandleVendorTimeout → restart
   - No (not timeout) → WaitForVendorArrival (loop)

#### Error Handling

**Retry Configuration**:
```typescript
{
  ErrorEquals: ['States.TaskFailed', 'States.Timeout'],
  IntervalSeconds: 2,
  MaxAttempts: 3,
  BackoffRate: 2
}
```

**Catch Configuration**:
```typescript
{
  ErrorEquals: ['States.ALL'],
  ResultPath: '$.error',
  Next: 'HandleMatchingError'
}
```

All errors eventually lead to escalation to ensure no incident is lost.

## CDK Infrastructure

### Stack: IncidentStateMachineStack

**Resources Created**:
- 6 Lambda functions (state machine handlers)
- Step Functions state machine
- CloudWatch Log Group (encrypted with KMS)
- EventBridge rules for triggering state machine
- IAM roles and permissions
- CloudWatch alarms for monitoring

**Inputs Required**:
- `incidentsTable`: DynamoDB table reference
- `eventBus`: EventBridge event bus reference
- `kmsKey`: KMS key for encryption

**Outputs**:
- `StateMachineArn`: ARN of the state machine
- `StateMachineName`: Name of the state machine

### EventBridge Integration

**Trigger Rule**: IncidentCreated
```typescript
{
  source: ['incident.service'],
  detailType: ['IncidentCreated']
}
```

**Action**: Start state machine execution with incident details

### Monitoring

**CloudWatch Alarms**:
1. **StateMachineFailureAlarm**: Triggers when 5+ executions fail in 5 minutes
2. **StateMachineTimeoutAlarm**: Triggers when 3+ executions timeout in 5 minutes

**Metrics Tracked**:
- ExecutionsFailed
- ExecutionsTimedOut
- ExecutionTime
- ExecutionsSucceeded

**X-Ray Tracing**: Enabled for all Lambda functions and state machine

## Event Flow

### Happy Path
```
1. Incident created → IncidentCreated event published
2. State machine starts
3. MatchRequested event published
4. Match service finds vendors and creates offers
5. Vendor accepts offer → OfferAccepted event
6. State machine detects vendor assignment
7. Vendor navigates to location
8. Vendor arrives → Status updated to vendor_arrived
9. State machine detects arrival
10. Execution completes
```

### Timeout & Retry Path
```
1. Incident created → IncidentCreated event published
2. State machine starts
3. MatchRequested event published (radius: 50mi)
4. Wait 2 minutes
5. No vendor accepted
6. Expand radius to 62.5mi
7. MatchRequested event published (radius: 62.5mi)
8. Wait 2 minutes
9. Vendor accepts
10. Continue to arrival monitoring
```

### Escalation Path
```
1. Incident created → IncidentCreated event published
2. State machine starts
3. Attempt 1: No vendor (radius: 50mi)
4. Attempt 2: No vendor (radius: 62.5mi)
5. Attempt 3: No vendor (radius: 78.125mi)
6. Max attempts reached
7. IncidentEscalated event published
8. Dispatcher notified
9. Execution completes (escalated state)
```

### Vendor Timeout Path
```
1. Vendor assigned
2. State machine monitors arrival
3. Check every 5 minutes
4. 30 minutes elapsed, vendor not arrived
5. VendorTimeout event published
6. Incident reset to 'created'
7. Vendor assignment cleared
8. IncidentCreated event published
9. New matching cycle starts
```

## Testing

### Unit Tests
Located in `__tests__/state-machine-handlers.test.ts`

**Test Coverage**:
- Vendor response detection
- Radius expansion logic
- Escalation trigger
- Arrival timeout detection
- Event publishing

### Integration Testing

**Recommended Approach**:
1. Use LocalStack for local testing
2. Deploy state machine to test environment
3. Trigger with test incidents
4. Verify state transitions
5. Check EventBridge events published

**Test Scenarios**:
1. Happy path: Vendor accepts and arrives
2. Timeout & retry: No vendor, expand radius, success
3. Escalation: 3 failed attempts
4. Vendor timeout: Vendor doesn't arrive, reassign
5. Error handling: Lambda failures, retry logic

## Deployment

### Prerequisites
```bash
# Install dependencies
npm install

# Build packages
npm run build

# Build infrastructure
cd infrastructure
npm install
```

### Deploy
```bash
cd infrastructure
cdk deploy IncidentStateMachineStack \
  --context incidentsTableName=Incidents-dev \
  --context eventBusName=roadcall-events-dev
```

### Verify Deployment
```bash
# Check state machine
aws stepfunctions list-state-machines

# Check Lambda functions
aws lambda list-functions --query 'Functions[?contains(FunctionName, `incident`)]'

# Check EventBridge rules
aws events list-rules --event-bus-name roadcall-events-dev
```

## Monitoring & Operations

### CloudWatch Logs
- State machine executions: `/aws/vendedlogs/states/incident-lifecycle-*`
- Lambda functions: `/aws/lambda/CheckVendorResponse*`, etc.

### Metrics to Monitor
1. **Execution Success Rate**: Should be > 95%
2. **Average Execution Time**: Should be < 5 minutes for happy path
3. **Escalation Rate**: Should be < 5% of incidents
4. **Vendor Timeout Rate**: Should be < 2% of assignments

### Troubleshooting

**Issue**: State machine execution fails
- Check CloudWatch Logs for Lambda errors
- Verify DynamoDB table permissions
- Check EventBridge event bus permissions

**Issue**: Vendor matching not triggered
- Verify MatchRequested event is published
- Check match service is subscribed to event
- Verify EventBridge rule is active

**Issue**: Escalation not working
- Check IncidentEscalated event is published
- Verify notification service is subscribed
- Check dispatcher notification preferences

## Requirements Satisfied

This implementation satisfies the following requirements from the design document:

- ✅ **Requirement 7.4**: Incident lifecycle state machine with timeout handling
- ✅ **Requirement 7.5**: Escalation logic for no vendor found after 3 radius expansions
- ✅ **Requirement 4.5**: 2-minute vendor response timeout
- ✅ **Requirement 6.5**: 30-minute vendor arrival timeout
- ✅ **Requirement 7.2**: EventBridge event publishing for state transitions
- ✅ **Requirement 22.1**: Asynchronous event-driven communication
- ✅ **Requirement 22.3**: Dead-letter queues and retry logic

## Future Enhancements

1. **Dynamic Timeouts**: Configure timeouts based on incident type or priority
2. **ML-Based Radius**: Use machine learning to predict optimal search radius
3. **Priority Queue**: Prioritize high-urgency incidents
4. **Real-Time Dashboard**: Monitor active state machine executions
5. **Automated Testing**: CI/CD integration with state machine testing
6. **Cost Optimization**: Analyze execution patterns and optimize wait times
7. **Task Token Integration**: Implement waitForTaskToken for work completion and payment flows

## References

- [AWS Step Functions Documentation](https://docs.aws.amazon.com/step-functions/)
- [EventBridge Event Patterns](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html)
- [CDK Step Functions Construct](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions-readme.html)
