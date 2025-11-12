import * as cdk from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SecretsStackProps extends cdk.StackProps {
  stage: string;
  kmsKey: kms.IKey;
  auroraCluster?: rds.DatabaseCluster;
  notificationEmail?: string;
}

export class SecretsStack extends cdk.Stack {
  public readonly stripeApiKeySecret: secretsmanager.ISecret;
  public readonly weatherApiKeySecret: secretsmanager.ISecret;
  public readonly rotationTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const { stage, kmsKey, auroraCluster, notificationEmail } = props;

    // ========================================================================
    // SNS Topic for Secret Rotation Notifications
    // ========================================================================

    this.rotationTopic = new sns.Topic(this, 'SecretRotationTopic', {
      topicName: `roadcall-secret-rotation-${stage}`,
      displayName: 'Roadcall Secret Rotation Notifications',
      masterKey: kmsKey,
    });

    // Add email subscription if provided
    if (notificationEmail) {
      this.rotationTopic.addSubscription(
        new subscriptions.EmailSubscription(notificationEmail)
      );
    }

    // ========================================================================
    // Stripe API Key Secret
    // ========================================================================

    this.stripeApiKeySecret = new secretsmanager.Secret(this, 'StripeApiKeySecret', {
      secretName: `roadcall/stripe/api-key-${stage}`,
      description: 'Stripe API key for payment processing',
      encryptionKey: kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiKey: 'PLACEHOLDER_REPLACE_WITH_ACTUAL_KEY',
          publishableKey: 'PLACEHOLDER_REPLACE_WITH_ACTUAL_KEY',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ========================================================================
    // Weather API Key Secret
    // ========================================================================

    this.weatherApiKeySecret = new secretsmanager.Secret(this, 'WeatherApiKeySecret', {
      secretName: `roadcall/weather/api-key-${stage}`,
      description: 'Weather API key for incident context enrichment',
      encryptionKey: kmsKey,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          apiKey: 'PLACEHOLDER_REPLACE_WITH_ACTUAL_KEY',
          endpoint: 'https://api.weatherapi.com/v1',
        }),
        generateStringKey: 'placeholder',
      },
    });

    // ========================================================================
    // Database Credentials with Automatic Rotation
    // ========================================================================

    if (auroraCluster && auroraCluster.secret) {
      // Enable automatic rotation for Aurora credentials (90-day cycle)
      auroraCluster.secret.addRotationSchedule('RotationSchedule', {
        automaticallyAfter: cdk.Duration.days(90),
        hostedRotation: secretsmanager.HostedRotation.postgreSqlSingleUser(),
      });

      // Create EventBridge rule to capture rotation events
      const dbRotationRule = new events.Rule(this, 'DBRotationRule', {
        ruleName: `roadcall-db-rotation-${stage}`,
        description: 'Capture database credential rotation events',
        eventPattern: {
          source: ['aws.secretsmanager'],
          detailType: ['AWS API Call via CloudTrail'],
          detail: {
            eventName: ['RotateSecret'],
            requestParameters: {
              secretId: [auroraCluster.secret.secretArn],
            },
          },
        },
      });

      // Send notification on rotation
      dbRotationRule.addTarget(new targets.SnsTopic(this.rotationTopic));
    }

    // ========================================================================
    // Lambda Function for Secret Rotation Notifications
    // ========================================================================

    const rotationNotificationHandler = new nodejs.NodejsFunction(
      this,
      'RotationNotificationHandler',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        architecture: lambda.Architecture.ARM_64,
        timeout: cdk.Duration.seconds(10),
        memorySize: 256,
        entry: path.join(__dirname, '../handlers/secret-rotation-notification.ts'),
        handler: 'handler',
        functionName: `roadcall-secret-rotation-notification-${stage}`,
        environment: {
          SNS_TOPIC_ARN: this.rotationTopic.topicArn,
          STAGE: stage,
          POWERTOOLS_SERVICE_NAME: 'secrets-manager',
          LOG_LEVEL: stage === 'prod' ? 'INFO' : 'DEBUG',
        },
        bundling: {
          minify: true,
          sourceMap: true,
        },
        tracing: lambda.Tracing.ACTIVE,
      }
    );

    // Grant permissions to publish to SNS
    this.rotationTopic.grantPublish(rotationNotificationHandler);

    // ========================================================================
    // EventBridge Rules for Secret Rotation Events
    // ========================================================================

    // Capture all secret rotation events
    const secretRotationRule = new events.Rule(this, 'SecretRotationRule', {
      ruleName: `roadcall-secret-rotation-events-${stage}`,
      description: 'Capture all Secrets Manager rotation events',
      eventPattern: {
        source: ['aws.secretsmanager'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventName: ['RotateSecret', 'PutSecretValue'],
        },
      },
    });

    secretRotationRule.addTarget(new targets.LambdaFunction(rotationNotificationHandler));

    // ========================================================================
    // CloudWatch Alarms for Secret Access
    // ========================================================================

    // Create log group for secret access monitoring
    const secretAccessLogGroup = new cdk.aws_logs.LogGroup(this, 'SecretAccessLogGroup', {
      logGroupName: `/aws/lambda/roadcall-secrets-${stage}`,
      retention: cdk.aws_logs.RetentionDays.ONE_MONTH,
      encryptionKey: kmsKey,
    });

    // Create metric filter for secret access failures
    const secretAccessFailureMetric = new cdk.aws_logs.MetricFilter(
      this,
      'SecretAccessFailureMetric',
      {
        logGroup: secretAccessLogGroup,
        filterPattern: cdk.aws_logs.FilterPattern.literal(
          '[time, request_id, level = ERROR, msg = "Secrets Manager get error*"]'
        ),
        metricNamespace: 'Roadcall/Secrets',
        metricName: 'SecretAccessFailures',
        metricValue: '1',
        defaultValue: 0,
      }
    );

    // Alarm for secret access failures
    new cdk.aws_cloudwatch.Alarm(this, 'SecretAccessFailureAlarm', {
      alarmName: `roadcall-secret-access-failures-${stage}`,
      alarmDescription: 'Alert when Lambda functions fail to access secrets',
      metric: secretAccessFailureMetric.metric(),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cdk.aws_cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ========================================================================
    // Resource Policies for Least-Privilege Access
    // ========================================================================

    // Add resource policy to Stripe secret (example - adjust per service)
    this.stripeApiKeySecret.addToResourcePolicy(
      new cdk.aws_iam.PolicyStatement({
        effect: cdk.aws_iam.Effect.DENY,
        principals: [new cdk.aws_iam.AnyPrincipal()],
        actions: ['secretsmanager:DeleteSecret'],
        resources: ['*'],
        conditions: {
          StringNotEquals: {
            'aws:PrincipalType': 'Account',
          },
        },
      })
    );

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'StripeApiKeySecretArn', {
      value: this.stripeApiKeySecret.secretArn,
      exportName: `${stage}-StripeApiKeySecretArn`,
      description: 'ARN of the Stripe API key secret',
    });

    new cdk.CfnOutput(this, 'WeatherApiKeySecretArn', {
      value: this.weatherApiKeySecret.secretArn,
      exportName: `${stage}-WeatherApiKeySecretArn`,
      description: 'ARN of the Weather API key secret',
    });

    new cdk.CfnOutput(this, 'RotationTopicArn', {
      value: this.rotationTopic.topicArn,
      exportName: `${stage}-SecretRotationTopicArn`,
      description: 'ARN of the secret rotation notification topic',
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Secrets');
    cdk.Tags.of(this).add('Compliance', 'PCI-DSS');
  }
}
