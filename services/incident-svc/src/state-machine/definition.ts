/**
 * Step Functions State Machine Definition for Incident Lifecycle
 * 
 * This state machine orchestrates the complete incident lifecycle:
 * 1. Created -> Wait for vendor response (2 min timeout)
 * 2. Vendor Assigned -> Wait for arrival (30 min timeout)
 * 3. Vendor Arrived -> Work In Progress -> Work Completed
 * 4. Payment Pending -> Closed
 * 
 * Handles:
 * - Vendor response timeout with radius expansion (max 3 attempts)
 * - Vendor arrival timeout with reassignment
 * - Escalation to dispatcher after max attempts
 * - Automatic status updates on vendor actions
 */

export const incidentLifecycleStateMachine = {
  Comment: 'Incident Lifecycle State Machine with timeout handling and escalation',
  StartAt: 'InitializeIncident',
  States: {
    // Initialize incident and trigger vendor matching
    InitializeIncident: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'driverId.$': '$.driverId',
        'type.$': '$.type',
        'location.$': '$.location',
        'attempt': 1,
        'radiusMiles': 50,
        'createdAt.$': '$.createdAt',
      },
      Next: 'TriggerVendorMatching',
    },

    // Trigger vendor matching
    TriggerVendorMatching: {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        'FunctionName': '${TriggerVendorMatchingFunctionArn}',
        'Payload': {
          'incidentId.$': '$.incidentId',
          'attempt.$': '$.attempt',
          'radiusMiles.$': '$.radiusMiles',
        },
      },
      ResultPath: '$.matchResult',
      Next: 'WaitForVendorResponse',
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed', 'States.Timeout'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 2,
        },
      ],
      Catch: [
        {
          ErrorEquals: ['States.ALL'],
          ResultPath: '$.error',
          Next: 'HandleMatchingError',
        },
      ],
    },

    // Wait 2 minutes for vendor to accept offer
    WaitForVendorResponse: {
      Type: 'Wait',
      Seconds: 120, // 2 minutes
      Next: 'CheckVendorResponse',
    },

    // Check if vendor has responded
    CheckVendorResponse: {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        'FunctionName': '${CheckVendorResponseFunctionArn}',
        'Payload': {
          'incidentId.$': '$.incidentId',
          'attempt.$': '$.attempt',
          'radiusMiles.$': '$.radiusMiles',
        },
      },
      ResultPath: '$.responseCheck',
      Next: 'HasVendorResponded',
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed'],
          IntervalSeconds: 1,
          MaxAttempts: 2,
          BackoffRate: 2,
        },
      ],
    },

    // Decision: Has vendor responded?
    HasVendorResponded: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.responseCheck.Payload.hasVendor',
          BooleanEquals: true,
          Next: 'VendorAssigned',
        },
        {
          Variable: '$.responseCheck.Payload.shouldEscalate',
          BooleanEquals: true,
          Next: 'EscalateToDispatcher',
        },
      ],
      Default: 'UpdateSearchParameters',
    },

    // Update search parameters for retry
    UpdateSearchParameters: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'driverId.$': '$.driverId',
        'type.$': '$.type',
        'location.$': '$.location',
        'attempt.$': '$.responseCheck.Payload.attempt',
        'radiusMiles.$': '$.responseCheck.Payload.radiusMiles',
        'createdAt.$': '$.createdAt',
      },
      Next: 'TriggerVendorMatching',
    },

    // Vendor assigned - wait for arrival
    VendorAssigned: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'vendorId.$': '$.responseCheck.Payload.vendorId',
        'assignedAt.$': '$$.State.EnteredTime',
        'status': 'vendor_assigned',
      },
      Next: 'WaitForVendorArrival',
    },

    // Wait for vendor to arrive (check every 5 minutes, max 30 minutes)
    WaitForVendorArrival: {
      Type: 'Wait',
      Seconds: 300, // 5 minutes
      Next: 'CheckVendorArrival',
    },

    // Check if vendor has arrived
    CheckVendorArrival: {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        'FunctionName': '${CheckVendorArrivalFunctionArn}',
        'Payload': {
          'incidentId.$': '$.incidentId',
          'vendorId.$': '$.vendorId',
          'assignedAt.$': '$.assignedAt',
        },
      },
      ResultPath: '$.arrivalCheck',
      Next: 'HasVendorArrived',
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed'],
          IntervalSeconds: 1,
          MaxAttempts: 2,
          BackoffRate: 2,
        },
      ],
    },

    // Decision: Has vendor arrived?
    HasVendorArrived: {
      Type: 'Choice',
      Choices: [
        {
          Variable: '$.arrivalCheck.Payload.hasArrived',
          BooleanEquals: true,
          Next: 'VendorArrived',
        },
        {
          Variable: '$.arrivalCheck.Payload.isTimeout',
          BooleanEquals: true,
          Next: 'HandleVendorTimeout',
        },
      ],
      Default: 'WaitForVendorArrival',
    },

    // Handle vendor arrival timeout
    HandleVendorTimeout: {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        'FunctionName': '${HandleVendorTimeoutFunctionArn}',
        'Payload': {
          'incidentId.$': '$.incidentId',
          'vendorId.$': '$.vendorId',
          'elapsedMinutes.$': '$.arrivalCheck.Payload.elapsedMinutes',
        },
      },
      ResultPath: '$.timeoutResult',
      Next: 'InitializeIncident', // Restart matching process
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed'],
          IntervalSeconds: 2,
          MaxAttempts: 2,
          BackoffRate: 2,
        },
      ],
    },

    // Vendor arrived - wait for work completion
    VendorArrived: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'vendorId.$': '$.vendorId',
        'status': 'vendor_arrived',
      },
      Next: 'WaitForWorkCompletion',
    },

    // Wait for work to be completed (passive wait - triggered by external event)
    WaitForWorkCompletion: {
      Type: 'Task',
      Resource: 'arn:aws:states:::events:putEvents.waitForTaskToken',
      Parameters: {
        Entries: [
          {
            Detail: {
              'incidentId.$': '$.incidentId',
              'taskToken.$': '$$.Task.Token',
            },
            DetailType: 'WorkCompletionWait',
            Source: 'incident.lifecycle',
          },
        ],
      },
      ResultPath: '$.workResult',
      Next: 'WorkCompleted',
      TimeoutSeconds: 86400, // 24 hours max
      Catch: [
        {
          ErrorEquals: ['States.Timeout'],
          ResultPath: '$.error',
          Next: 'EscalateToDispatcher',
        },
      ],
    },

    // Work completed - move to payment
    WorkCompleted: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'vendorId.$': '$.vendorId',
        'status': 'work_completed',
      },
      Next: 'WaitForPaymentApproval',
    },

    // Wait for payment approval (passive wait - triggered by external event)
    WaitForPaymentApproval: {
      Type: 'Task',
      Resource: 'arn:aws:states:::events:putEvents.waitForTaskToken',
      Parameters: {
        Entries: [
          {
            Detail: {
              'incidentId.$': '$.incidentId',
              'taskToken.$': '$$.Task.Token',
            },
            DetailType: 'PaymentApprovalWait',
            Source: 'incident.lifecycle',
          },
        ],
      },
      ResultPath: '$.paymentResult',
      Next: 'IncidentClosed',
      TimeoutSeconds: 604800, // 7 days max
      Catch: [
        {
          ErrorEquals: ['States.Timeout'],
          ResultPath: '$.error',
          Next: 'EscalateToDispatcher',
        },
      ],
    },

    // Incident closed successfully
    IncidentClosed: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'status': 'closed',
        'completedAt.$': '$$.State.EnteredTime',
      },
      End: true,
    },

    // Escalate to dispatcher
    EscalateToDispatcher: {
      Type: 'Task',
      Resource: 'arn:aws:states:::lambda:invoke',
      Parameters: {
        'FunctionName': '${EscalateIncidentFunctionArn}',
        'Payload': {
          'incidentId.$': '$.incidentId',
          'attempt.$': '$.attempt',
          'reason': 'No vendor found after maximum attempts',
        },
      },
      ResultPath: '$.escalationResult',
      Next: 'EscalationComplete',
      Retry: [
        {
          ErrorEquals: ['States.TaskFailed'],
          IntervalSeconds: 2,
          MaxAttempts: 3,
          BackoffRate: 2,
        },
      ],
    },

    // Escalation complete
    EscalationComplete: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'status': 'escalated',
        'escalatedAt.$': '$$.State.EnteredTime',
      },
      End: true,
    },

    // Handle matching errors
    HandleMatchingError: {
      Type: 'Pass',
      Parameters: {
        'incidentId.$': '$.incidentId',
        'error.$': '$.error',
        'status': 'error',
      },
      Next: 'EscalateToDispatcher',
    },
  },
};

export default incidentLifecycleStateMachine;
