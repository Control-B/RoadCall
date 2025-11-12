import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface EventBridgeStackProps extends cdk.StackProps {
  stage: string;
  eventBus: events.IEventBus;
}

export class EventBridgeStack extends cdk.Stack {
  public readonly queues: Map<string, sqs.Queue>;
  public readonly deadLetterQueues: Map<string, sqs.Queue>;

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props);

    const { stage, eventBus } = props;

    this.queues = new Map();
    this.deadLetterQueues = new Map();

    // ========================================================================
    // CloudWatch Log Group for EventBridge
    // ========================================================================

    const eventBusLogGroup = new logs.LogGroup(this, 'EventBusLogGroup', {
      logGroupName: `/aws/events/roadcall-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_YEAR : logs.RetentionDays.ONE_MONTH,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Archive all events for replay capability
    new events.Archive(this, 'EventArchive', {
      sourceEventBus: eventBus,
      archiveName: `roadcall-events-archive-${stage}`,
      description: 'Archive of all domain events for replay capability',
      retention: cdk.Duration.days(stage === 'prod' ? 90 : 30),
      eventPattern: {
        source: events.Match.prefix('roadcall.'),
      },
    });

    // ========================================================================
    // SQS Queues with Dead Letter Queues
    // ========================================================================

    // Notifications Queue
    const notificationsDLQ = this.createDeadLetterQueue('notifications', stage);
    const notificationsQueue = this.createQueue('notifications', stage, notificationsDLQ);
    this.queues.set('notifications', notificationsQueue);
    this.deadLetterQueues.set('notifications', notificationsDLQ);

    // Reporting/Analytics Queue
    const reportingDLQ = this.createDeadLetterQueue('reporting', stage);
    const reportingQueue = this.createQueue('reporting', stage, reportingDLQ);
    this.queues.set('reporting', reportingQueue);
    this.deadLetterQueues.set('reporting', reportingDLQ);

    // Match Service Queue (for incident created events)
    const matchDLQ = this.createDeadLetterQueue('match', stage);
    const matchQueue = this.createQueue('match', stage, matchDLQ);
    this.queues.set('match', matchQueue);
    this.deadLetterQueues.set('match', matchDLQ);

    // Payment Approval Queue
    const paymentApprovalDLQ = this.createDeadLetterQueue('payment-approval', stage);
    const paymentApprovalQueue = this.createQueue('payment-approval', stage, paymentApprovalDLQ);
    this.queues.set('payment-approval', paymentApprovalQueue);
    this.deadLetterQueues.set('payment-approval', paymentApprovalDLQ);

    // ========================================================================
    // EventBridge Rules
    // ========================================================================

    // Rule: Route all events to CloudWatch Logs for debugging
    new events.Rule(this, 'LogAllEventsRule', {
      eventBus,
      ruleName: `roadcall-log-all-events-${stage}`,
      description: 'Log all domain events to CloudWatch',
      eventPattern: {
        source: events.Match.prefix('roadcall.'),
      },
      targets: [new targets.CloudWatchLogGroup(eventBusLogGroup)],
    });

    // Rule: Incident Created -> Match Service
    new events.Rule(this, 'IncidentCreatedRule', {
      eventBus,
      ruleName: `roadcall-incident-created-${stage}`,
      description: 'Route incident created events to match service',
      eventPattern: {
        source: ['roadcall.incident'],
        detailType: ['IncidentCreated'],
      },
      targets: [
        new targets.SqsQueue(matchQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(2),
        }),
      ],
    });

    // Rule: Offer Events -> Notifications
    new events.Rule(this, 'OfferEventsRule', {
      eventBus,
      ruleName: `roadcall-offer-events-${stage}`,
      description: 'Route offer events to notifications service',
      eventPattern: {
        source: ['roadcall.match'],
        detailType: ['OfferCreated', 'OfferAccepted', 'OfferDeclined', 'OfferExpired'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // Rule: Incident Status Changes -> Notifications
    new events.Rule(this, 'IncidentStatusChangedRule', {
      eventBus,
      ruleName: `roadcall-incident-status-changed-${stage}`,
      description: 'Route incident status changes to notifications',
      eventPattern: {
        source: ['roadcall.incident'],
        detailType: ['IncidentStatusChanged', 'IncidentAssigned', 'IncidentCancelled'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // Rule: Vendor Events -> Notifications
    new events.Rule(this, 'VendorEventsRule', {
      eventBus,
      ruleName: `roadcall-vendor-events-${stage}`,
      description: 'Route vendor events to notifications',
      eventPattern: {
        source: ['roadcall.vendor', 'roadcall.tracking'],
        detailType: ['VendorArrived', 'VendorStatusChanged'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // Rule: Work Events -> Notifications & Payments
    new events.Rule(this, 'WorkCompletedRule', {
      eventBus,
      ruleName: `roadcall-work-completed-${stage}`,
      description: 'Route work completed events to notifications and payments',
      eventPattern: {
        source: ['roadcall.incident'],
        detailType: ['WorkCompleted'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
        new targets.SqsQueue(paymentApprovalQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(24),
        }),
      ],
    });

    // Rule: Payment Events -> Notifications
    new events.Rule(this, 'PaymentEventsRule', {
      eventBus,
      ruleName: `roadcall-payment-events-${stage}`,
      description: 'Route payment events to notifications',
      eventPattern: {
        source: ['roadcall.payment'],
        detailType: ['PaymentApproved', 'PaymentCompleted', 'PaymentFailed', 'PaymentFlagged'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // Rule: All Events -> Reporting/Analytics
    new events.Rule(this, 'AllEventsToReportingRule', {
      eventBus,
      ruleName: `roadcall-all-events-reporting-${stage}`,
      description: 'Route all domain events to reporting service for analytics',
      eventPattern: {
        source: events.Match.prefix('roadcall.'),
      },
      targets: [
        new targets.SqsQueue(reportingQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(24),
        }),
      ],
    });

    // Rule: Call Events -> Notifications
    new events.Rule(this, 'CallEventsRule', {
      eventBus,
      ruleName: `roadcall-call-events-${stage}`,
      description: 'Route call events to notifications',
      eventPattern: {
        source: ['roadcall.telephony'],
        detailType: ['CallSummaryGenerated', 'TranscriptReady'],
      },
      targets: [
        new targets.SqsQueue(notificationsQueue, {
          retryAttempts: 3,
          maxEventAge: cdk.Duration.hours(1),
        }),
      ],
    });

    // ========================================================================
    // CloudWatch Alarms for Dead Letter Queues
    // ========================================================================

    this.createDLQAlarms(notificationsDLQ, 'notifications', stage);
    this.createDLQAlarms(reportingDLQ, 'reporting', stage);
    this.createDLQAlarms(matchDLQ, 'match', stage);
    this.createDLQAlarms(paymentApprovalDLQ, 'payment-approval', stage);

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'NotificationsQueueUrl', {
      value: notificationsQueue.queueUrl,
      exportName: `${stage}-NotificationsQueueUrl`,
    });

    new cdk.CfnOutput(this, 'ReportingQueueUrl', {
      value: reportingQueue.queueUrl,
      exportName: `${stage}-ReportingQueueUrl`,
    });

    new cdk.CfnOutput(this, 'MatchQueueUrl', {
      value: matchQueue.queueUrl,
      exportName: `${stage}-MatchQueueUrl`,
    });

    new cdk.CfnOutput(this, 'PaymentApprovalQueueUrl', {
      value: paymentApprovalQueue.queueUrl,
      exportName: `${stage}-PaymentApprovalQueueUrl`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'EventBridge');
  }

  /**
   * Create a dead letter queue
   */
  private createDeadLetterQueue(name: string, stage: string): sqs.Queue {
    return new sqs.Queue(this, `${name}DLQ`, {
      queueName: `roadcall-${name}-dlq-${stage}`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
    });
  }

  /**
   * Create a queue with dead letter queue
   */
  private createQueue(name: string, stage: string, dlq: sqs.Queue): sqs.Queue {
    return new sqs.Queue(this, `${name}Queue`, {
      queueName: `roadcall-${name}-${stage}`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.KMS_MANAGED,
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3, // Retry 3 times before sending to DLQ
      },
    });
  }

  /**
   * Create CloudWatch alarms for DLQ
   */
  private createDLQAlarms(dlq: sqs.Queue, name: string, stage: string): void {
    dlq.metricApproximateNumberOfMessagesVisible().createAlarm(this, `${name}DLQAlarm`, {
      alarmName: `roadcall-${name}-dlq-messages-${stage}`,
      alarmDescription: `Alert when messages appear in ${name} DLQ`,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // In production, you would add SNS topic for notifications
    // if (stage === 'prod') {
    //   alarm.addAlarmAction(new cw_actions.SnsAction(snsTopic));
    // }
  }
}
