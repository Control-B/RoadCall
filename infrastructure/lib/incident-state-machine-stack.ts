import * as cdk from 'aws-cdk-lib';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface IncidentStateMachineStackProps extends cdk.StackProps {
  incidentsTable: cdk.aws_dynamodb.ITable;
  eventBus: events.IEventBus;
  kmsKey: cdk.aws_kms.IKey;
}

export class IncidentStateMachineStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: IncidentStateMachineStackProps) {
    super(scope, id, props);

    const { incidentsTable, eventBus, kmsKey } = props;

    // Common Lambda environment variables
    const commonEnvironment = {
      INCIDENTS_TABLE: incidentsTable.tableName,
      EVENT_BUS_NAME: eventBus.eventBusName,
      POWERTOOLS_SERVICE_NAME: 'incident-state-machine',
      LOG_LEVEL: 'INFO',
    };

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      tracing: lambda.Tracing.ACTIVE,
      environment: commonEnvironment,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    };

    // Lambda: Check Vendor Response
    const checkVendorResponseFn = new nodejs.NodejsFunction(this, 'CheckVendorResponseFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/check-vendor-response.ts',
      handler: 'handler',
      description: 'Check if vendor has responded to incident',
    });

    incidentsTable.grantReadData(checkVendorResponseFn);

    // Lambda: Check Vendor Arrival
    const checkVendorArrivalFn = new nodejs.NodejsFunction(this, 'CheckVendorArrivalFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/check-vendor-arrival.ts',
      handler: 'handler',
      description: 'Check if vendor has arrived at incident location',
    });

    incidentsTable.grantReadData(checkVendorArrivalFn);

    // Lambda: Trigger Vendor Matching
    const triggerVendorMatchingFn = new nodejs.NodejsFunction(this, 'TriggerVendorMatchingFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/trigger-vendor-matching.ts',
      handler: 'handler',
      description: 'Trigger vendor matching by publishing event',
    });

    incidentsTable.grantReadData(triggerVendorMatchingFn);
    eventBus.grantPutEventsTo(triggerVendorMatchingFn);

    // Lambda: Handle Vendor Timeout
    const handleVendorTimeoutFn = new nodejs.NodejsFunction(this, 'HandleVendorTimeoutFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/handle-vendor-timeout.ts',
      handler: 'handler',
      description: 'Handle vendor arrival timeout and reassign',
    });

    incidentsTable.grantReadWriteData(handleVendorTimeoutFn);
    eventBus.grantPutEventsTo(handleVendorTimeoutFn);

    // Lambda: Escalate Incident
    const escalateIncidentFn = new nodejs.NodejsFunction(this, 'EscalateIncidentFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/escalate-incident.ts',
      handler: 'handler',
      description: 'Escalate incident to dispatcher',
    });

    incidentsTable.grantReadWriteData(escalateIncidentFn);
    eventBus.grantPutEventsTo(escalateIncidentFn);

    // Lambda: Handle State Transition
    const handleStateTransitionFn = new nodejs.NodejsFunction(this, 'HandleStateTransitionFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/handle-state-transition.ts',
      handler: 'handler',
      description: 'Handle automatic state transitions',
    });

    incidentsTable.grantReadWriteData(handleStateTransitionFn);
    eventBus.grantPutEventsTo(handleStateTransitionFn);

    // Create CloudWatch Log Group for State Machine
    const logGroup = new logs.LogGroup(this, 'StateMachineLogGroup', {
      logGroupName: `/aws/vendedlogs/states/incident-lifecycle-${cdk.Stack.of(this).stackName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      encryptionKey: kmsKey,
    });

    // Build state machine definition with Lambda ARNs
    const stateMachineDefinition = this.buildStateMachineDefinition({
      checkVendorResponseFnArn: checkVendorResponseFn.functionArn,
      checkVendorArrivalFnArn: checkVendorArrivalFn.functionArn,
      triggerVendorMatchingFnArn: triggerVendorMatchingFn.functionArn,
      handleVendorTimeoutFnArn: handleVendorTimeoutFn.functionArn,
      escalateIncidentFnArn: escalateIncidentFn.functionArn,
      handleStateTransitionFnArn: handleStateTransitionFn.functionArn,
    });

    // Create State Machine
    this.stateMachine = new sfn.StateMachine(this, 'IncidentLifecycleStateMachine', {
      stateMachineName: `incident-lifecycle-${cdk.Stack.of(this).stackName}`,
      definitionBody: sfn.DefinitionBody.fromString(JSON.stringify(stateMachineDefinition)),
      tracingEnabled: true,
      logs: {
        destination: logGroup,
        level: sfn.LogLevel.ALL,
        includeExecutionData: true,
      },
    });

    // Grant state machine permission to invoke Lambda functions
    checkVendorResponseFn.grantInvoke(this.stateMachine);
    checkVendorArrivalFn.grantInvoke(this.stateMachine);
    triggerVendorMatchingFn.grantInvoke(this.stateMachine);
    handleVendorTimeoutFn.grantInvoke(this.stateMachine);
    escalateIncidentFn.grantInvoke(this.stateMachine);
    handleStateTransitionFn.grantInvoke(this.stateMachine);

    // Grant state machine permission to publish events
    eventBus.grantPutEventsTo(this.stateMachine);

    // Create EventBridge rule to trigger state machine on IncidentCreated
    const incidentCreatedRule = new events.Rule(this, 'IncidentCreatedRule', {
      eventBus,
      eventPattern: {
        source: ['incident.service'],
        detailType: ['IncidentCreated'],
      },
      description: 'Trigger incident lifecycle state machine on incident creation',
    });

    incidentCreatedRule.addTarget(
      new targets.SfnStateMachine(this.stateMachine, {
        input: events.RuleTargetInput.fromEventPath('$.detail'),
      })
    );

    // Create EventBridge rule for vendor acceptance
    const vendorAcceptedRule = new events.Rule(this, 'VendorAcceptedRule', {
      eventBus,
      eventPattern: {
        source: ['match.service'],
        detailType: ['OfferAccepted'],
      },
      description: 'Update state machine when vendor accepts offer',
    });

    // Lambda to send task token on vendor acceptance
    const sendTaskTokenFn = new nodejs.NodejsFunction(this, 'SendTaskTokenFn', {
      ...commonLambdaProps,
      entry: '../services/incident-svc/src/state-machine/handlers/send-task-token.ts',
      handler: 'handler',
      description: 'Send task token to resume state machine execution',
      environment: {
        ...commonEnvironment,
        STATE_MACHINE_ARN: this.stateMachine.stateMachineArn,
      },
    });

    this.stateMachine.grantTaskResponse(sendTaskTokenFn);
    vendorAcceptedRule.addTarget(new targets.LambdaFunction(sendTaskTokenFn));

    // CloudWatch Alarms
    const executionFailedMetric = this.stateMachine.metricFailed({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    new cdk.aws_cloudwatch.Alarm(this, 'StateMachineFailureAlarm', {
      metric: executionFailedMetric,
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when state machine executions fail',
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const executionTimeoutMetric = this.stateMachine.metricTimedOut({
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    new cdk.aws_cloudwatch.Alarm(this, 'StateMachineTimeoutAlarm', {
      metric: executionTimeoutMetric,
      threshold: 3,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when state machine executions timeout',
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Outputs
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: this.stateMachine.stateMachineArn,
      description: 'Incident Lifecycle State Machine ARN',
      exportName: `${cdk.Stack.of(this).stackName}-StateMachineArn`,
    });

    new cdk.CfnOutput(this, 'StateMachineName', {
      value: this.stateMachine.stateMachineName,
      description: 'Incident Lifecycle State Machine Name',
      exportName: `${cdk.Stack.of(this).stackName}-StateMachineName`,
    });
  }

  private buildStateMachineDefinition(lambdaArns: {
    checkVendorResponseFnArn: string;
    checkVendorArrivalFnArn: string;
    triggerVendorMatchingFnArn: string;
    handleVendorTimeoutFnArn: string;
    escalateIncidentFnArn: string;
    handleStateTransitionFnArn: string;
  }) {
    return {
      Comment: 'Incident Lifecycle State Machine with timeout handling and escalation',
      StartAt: 'InitializeIncident',
      States: {
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
        TriggerVendorMatching: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: {
            FunctionName: lambdaArns.triggerVendorMatchingFnArn,
            'Payload.$': '$',
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
        WaitForVendorResponse: {
          Type: 'Wait',
          Seconds: 120,
          Next: 'CheckVendorResponse',
        },
        CheckVendorResponse: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: {
            FunctionName: lambdaArns.checkVendorResponseFnArn,
            'Payload.$': '$',
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
        WaitForVendorArrival: {
          Type: 'Wait',
          Seconds: 300,
          Next: 'CheckVendorArrival',
        },
        CheckVendorArrival: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: {
            FunctionName: lambdaArns.checkVendorArrivalFnArn,
            'Payload.$': '$',
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
        HandleVendorTimeout: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: {
            FunctionName: lambdaArns.handleVendorTimeoutFnArn,
            'Payload.$': '$',
          },
          ResultPath: '$.timeoutResult',
          Next: 'InitializeIncident',
          Retry: [
            {
              ErrorEquals: ['States.TaskFailed'],
              IntervalSeconds: 2,
              MaxAttempts: 2,
              BackoffRate: 2,
            },
          ],
        },
        VendorArrived: {
          Type: 'Pass',
          Parameters: {
            'incidentId.$': '$.incidentId',
            'vendorId.$': '$.vendorId',
            'status': 'vendor_arrived',
          },
          Next: 'IncidentComplete',
        },
        IncidentComplete: {
          Type: 'Succeed',
        },
        EscalateToDispatcher: {
          Type: 'Task',
          Resource: 'arn:aws:states:::lambda:invoke',
          Parameters: {
            FunctionName: lambdaArns.escalateIncidentFnArn,
            'Payload.$': '$',
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
        EscalationComplete: {
          Type: 'Pass',
          Parameters: {
            'incidentId.$': '$.incidentId',
            'status': 'escalated',
            'escalatedAt.$': '$$.State.EnteredTime',
          },
          End: true,
        },
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
  }
}
