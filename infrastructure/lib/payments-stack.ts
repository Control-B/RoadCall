import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';
import { FraudDetectorSetup } from './fraud-detector-setup';

export interface PaymentsStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.IVpc;
  auroraCluster: rds.DatabaseCluster;
  auroraSecurityGroup: ec2.ISecurityGroup;
  kmsKey: kms.IKey;
  eventBus: events.IEventBus;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  stripeSecretArn?: string;
}

export class PaymentsStack extends cdk.Stack {
  public readonly approvalQueue: sqs.Queue;
  public readonly approvalDLQ: sqs.Queue;
  public readonly fraudDetector: FraudDetectorSetup;

  constructor(scope: Construct, id: string, props: PaymentsStackProps) {
    super(scope, id, props);

    const { stage, vpc, auroraCluster, auroraSecurityGroup, kmsKey, eventBus, api, authorizer, stripeSecretArn } =
      props;

    // ========================================================================
    // Fraud Detector Setup
    // ========================================================================

    this.fraudDetector = new FraudDetectorSetup(this, 'FraudDetector', {
      stage,
      detectorName: `vendor_payment_detector_${stage}`,
      eventTypeName: 'vendor_payment',
    });

    // ========================================================================
    // SQS Queues for Payment Approval Workflow
    // ========================================================================

    // Dead Letter Queue for failed approval messages
    this.approvalDLQ = new sqs.Queue(this, 'ApprovalDLQ', {
      queueName: `roadcall-payment-approval-dlq-${stage}`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsKey,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Main approval queue
    this.approvalQueue = new sqs.Queue(this, 'ApprovalQueue', {
      queueName: `roadcall-payment-approval-${stage}`,
      encryption: sqs.QueueEncryption.KMS,
      encryptionMasterKey: kmsKey,
      visibilityTimeout: cdk.Duration.seconds(300), // 5 minutes
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      deadLetterQueue: {
        queue: this.approvalDLQ,
        maxReceiveCount: 3,
      },
    });

    // ========================================================================
    // Lambda Security Group
    // ========================================================================

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      description: 'Security group for Payment Service Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to Aurora
    auroraSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to Aurora'
    );

    // ========================================================================
    // Lambda Functions
    // ========================================================================

    const servicePath = path.join(__dirname, '../../services/payments-svc');

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        AURORA_SECRET_ARN: auroraCluster.secret!.secretArn,
        AURORA_ENDPOINT: auroraCluster.clusterEndpoint.hostname,
        DATABASE_NAME: 'roadcall',
        EVENT_BUS_NAME: eventBus.eventBusName,
        APPROVAL_QUEUE_URL: this.approvalQueue.queueUrl,
        STRIPE_SECRET_ARN: stripeSecretArn || '',
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'payments-svc',
        LOG_LEVEL: stage === 'prod' ? 'INFO' : 'DEBUG',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['aws-sdk', 'pg-native'],
      },
      tracing: lambda.Tracing.ACTIVE,
    };

    // Create Payment Handler
    const createPaymentHandler = new nodejs.NodejsFunction(this, 'CreatePaymentHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/create-payment.ts'),
      handler: 'handler',
      functionName: `roadcall-create-payment-${stage}`,
    });

    // Get Payment Handler
    const getPaymentHandler = new nodejs.NodejsFunction(this, 'GetPaymentHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/get-payment.ts'),
      handler: 'handler',
      functionName: `roadcall-get-payment-${stage}`,
    });

    // Approve Payment Handler
    const approvePaymentHandler = new nodejs.NodejsFunction(this, 'ApprovePaymentHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/approve-payment.ts'),
      handler: 'handler',
      functionName: `roadcall-approve-payment-${stage}`,
    });

    // Get Pending Approvals Handler
    const getPendingApprovalsHandler = new nodejs.NodejsFunction(
      this,
      'GetPendingApprovalsHandler',
      {
        ...commonLambdaProps,
        entry: path.join(servicePath, 'src/handlers/get-pending-approvals.ts'),
        handler: 'handler',
        functionName: `roadcall-get-pending-approvals-${stage}`,
      }
    );

    // Work Completed Event Handler
    const workCompletedHandler = new nodejs.NodejsFunction(this, 'WorkCompletedHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/work-completed-handler.ts'),
      handler: 'handler',
      functionName: `roadcall-work-completed-${stage}`,
    });

    // Fraud Scoring Handler
    const scoreFraudHandler = new nodejs.NodejsFunction(this, 'ScoreFraudHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/score-fraud.ts'),
      handler: 'handler',
      functionName: `roadcall-score-fraud-${stage}`,
      timeout: cdk.Duration.seconds(10), // Allow extra time for fraud detection
      environment: {
        ...commonLambdaProps.environment,
        FRAUD_DETECTOR_NAME: `vendor_payment_detector_${stage}`,
        FRAUD_EVENT_TYPE: 'vendor_payment',
        FRAUD_THRESHOLD: '0.7',
      },
    });

    // Get Flagged Payments Handler
    const getFlaggedPaymentsHandler = new nodejs.NodejsFunction(
      this,
      'GetFlaggedPaymentsHandler',
      {
        ...commonLambdaProps,
        entry: path.join(servicePath, 'src/handlers/get-flagged-payments.ts'),
        handler: 'handler',
        functionName: `roadcall-get-flagged-payments-${stage}`,
      }
    );

    // Process Payment Handler (Stripe integration)
    const processPaymentHandler = new nodejs.NodejsFunction(this, 'ProcessPaymentHandler', {
      ...commonLambdaProps,
      entry: path.join(servicePath, 'src/handlers/process-payment.ts'),
      handler: 'handler',
      functionName: `roadcall-process-payment-${stage}`,
      timeout: cdk.Duration.seconds(30),
    });

    // ========================================================================
    // IAM Permissions
    // ========================================================================

    // Grant database access to all Lambda functions
    const lambdaFunctions = [
      createPaymentHandler,
      getPaymentHandler,
      approvePaymentHandler,
      getPendingApprovalsHandler,
      workCompletedHandler,
      scoreFraudHandler,
      getFlaggedPaymentsHandler,
      processPaymentHandler,
    ];

    lambdaFunctions.forEach((fn) => {
      // Grant access to Aurora secret
      auroraCluster.secret!.grantRead(fn);

      // Grant EventBridge publish permissions
      eventBus.grantPutEventsTo(fn);

      // Grant KMS permissions
      kmsKey.grantEncryptDecrypt(fn);
    });

    // Grant Stripe secret access to payment processing handler
    if (stripeSecretArn) {
      const stripeSecret = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'StripeSecret',
        stripeSecretArn
      );
      stripeSecret.grantRead(processPaymentHandler);
    }

    // Grant SQS permissions
    this.approvalQueue.grantSendMessages(workCompletedHandler);
    this.approvalQueue.grantSendMessages(scoreFraudHandler);

    // Grant Fraud Detector permissions to fraud scoring handler
    scoreFraudHandler.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.ALLOW,
        actions: [
          'frauddetector:GetEventPrediction',
          'frauddetector:GetDetectors',
          'frauddetector:GetEventTypes',
        ],
        resources: ['*'], // Fraud Detector doesn't support resource-level permissions
      })
    );

    // ========================================================================
    // EventBridge Rules
    // ========================================================================

    // Rule for WorkCompleted events
    const workCompletedRule = new events.Rule(this, 'WorkCompletedRule', {
      eventBus,
      ruleName: `roadcall-work-completed-payment-${stage}`,
      description: 'Trigger payment creation when work is completed',
      eventPattern: {
        source: ['roadcall.incident-service'],
        detailType: ['WorkCompleted'],
      },
    });

    workCompletedRule.addTarget(new targets.LambdaFunction(workCompletedHandler));

    // Rule for PaymentCreated events (trigger fraud detection)
    const paymentCreatedRule = new events.Rule(this, 'PaymentCreatedRule', {
      eventBus,
      ruleName: `roadcall-payment-created-fraud-${stage}`,
      description: 'Trigger fraud detection when payment is created',
      eventPattern: {
        source: ['roadcall.payment-service'],
        detailType: ['PaymentCreated'],
      },
    });

    paymentCreatedRule.addTarget(new targets.LambdaFunction(scoreFraudHandler));

    // ========================================================================
    // API Gateway Routes
    // ========================================================================

    const paymentsResource = api.root.addResource('payments');

    // POST /payments - Create payment
    paymentsResource.addMethod('POST', new apigateway.LambdaIntegration(createPaymentHandler), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // GET /payments/pending - Get pending approvals
    const pendingResource = paymentsResource.addResource('pending');
    pendingResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getPendingApprovalsHandler),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      }
    );

    // GET /payments/{id} - Get payment by ID
    const paymentIdResource = paymentsResource.addResource('{id}');
    paymentIdResource.addMethod('GET', new apigateway.LambdaIntegration(getPaymentHandler), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // POST /payments/{id}/approve - Approve payment
    const approveResource = paymentIdResource.addResource('approve');
    approveResource.addMethod('POST', new apigateway.LambdaIntegration(approvePaymentHandler), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // POST /payments/{id}/process - Process payment via Stripe
    const processResource = paymentIdResource.addResource('process');
    processResource.addMethod('POST', new apigateway.LambdaIntegration(processPaymentHandler), {
      authorizationType: apigateway.AuthorizationType.COGNITO,
      authorizer,
    });

    // GET /payments/flagged - Get flagged payments for manual review
    const flaggedResource = paymentsResource.addResource('flagged');
    flaggedResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getFlaggedPaymentsHandler),
      {
        authorizationType: apigateway.AuthorizationType.COGNITO,
        authorizer,
      }
    );

    // ========================================================================
    // CloudWatch Alarms
    // ========================================================================

    // Alarm for DLQ messages
    this.approvalDLQ
      .metricApproximateNumberOfMessagesVisible()
      .createAlarm(this, 'ApprovalDLQAlarm', {
        alarmName: `roadcall-payment-approval-dlq-${stage}`,
        alarmDescription: 'Alert when messages appear in payment approval DLQ',
        threshold: 1,
        evaluationPeriods: 1,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

    // Alarm for queue depth
    this.approvalQueue
      .metricApproximateNumberOfMessagesVisible()
      .createAlarm(this, 'ApprovalQueueDepthAlarm', {
        alarmName: `roadcall-payment-approval-queue-depth-${stage}`,
        alarmDescription: 'Alert when payment approval queue has too many messages',
        threshold: 100,
        evaluationPeriods: 2,
        treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
      });

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'ApprovalQueueUrl', {
      value: this.approvalQueue.queueUrl,
      exportName: `${stage}-PaymentApprovalQueueUrl`,
    });

    new cdk.CfnOutput(this, 'ApprovalQueueArn', {
      value: this.approvalQueue.queueArn,
      exportName: `${stage}-PaymentApprovalQueueArn`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Payments');
  }
}
