import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface MonitoringStackProps extends cdk.StackProps {
  readonly serviceName: string;
  readonly environment: string;
  readonly alarmEmail: string;
  readonly apis?: apigateway.RestApi[];
  readonly functions?: lambda.Function[];
}

export class MonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly trail: cloudtrail.Trail;

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

    // SNS Topic for alarm notifications
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: `${props.serviceName}-${props.environment}-alarms`,
      topicName: `${props.serviceName}-${props.environment}-alarms`,
    });

    // Subscribe email to alarm topic
    this.alarmTopic.addSubscription(
      new subscriptions.EmailSubscription(props.alarmEmail)
    );

    // CloudTrail for audit logging
    const trailBucket = new s3.Bucket(this, 'TrailBucket', {
      bucketName: `${props.serviceName}-${props.environment}-cloudtrail-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
          expiration: cdk.Duration.days(2555), // 7 years
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.trail = new cloudtrail.Trail(this, 'CloudTrail', {
      trailName: `${props.serviceName}-${props.environment}-trail`,
      bucket: trailBucket,
      enableFileValidation: true,
      includeGlobalServiceEvents: true,
      isMultiRegionTrail: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      sendToCloudWatchLogs: true,
      cloudWatchLogsRetention: logs.RetentionDays.ONE_YEAR,
    });

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${props.serviceName}-${props.environment}`,
    });

    // Add system-wide metrics
    this.addSystemMetrics();

    // Add API Gateway metrics if provided
    if (props.apis && props.apis.length > 0) {
      this.addApiGatewayMetrics(props.apis);
      this.createApiGatewayAlarms(props.apis);
    }

    // Add Lambda metrics if provided
    if (props.functions && props.functions.length > 0) {
      this.addLambdaMetrics(props.functions);
      this.createLambdaAlarms(props.functions);
    }

    // Create business KPI metrics
    this.createBusinessKPIMetrics(props.serviceName, props.environment);

    // Output alarm topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: this.alarmTopic.topicArn,
      description: 'SNS Topic ARN for CloudWatch Alarms',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }

  private addSystemMetrics(): void {
    // System-wide error rate widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'System Error Rate',
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/ApiGateway',
            metricName: '5XXError',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );

    // System uptime widget
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'System Uptime (Last 24h)',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.MathExpression({
            expression: '100 - (errors / requests * 100)',
            usingMetrics: {
              errors: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: '5XXError',
                statistic: 'Sum',
                period: cdk.Duration.hours(24),
              }),
              requests: new cloudwatch.Metric({
                namespace: 'AWS/ApiGateway',
                metricName: 'Count',
                statistic: 'Sum',
                period: cdk.Duration.hours(24),
              }),
            },
            label: 'Uptime %',
          }),
        ],
      })
    );
  }

  private addApiGatewayMetrics(apis: apigateway.RestApi[]): void {
    apis.forEach((api) => {
      // API Latency widget
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `${api.restApiName} - Latency`,
          width: 12,
          height: 6,
          left: [
            api.metricLatency({
              statistic: 'p95',
              period: cdk.Duration.minutes(5),
              label: 'P95',
            }),
            api.metricLatency({
              statistic: 'p99',
              period: cdk.Duration.minutes(5),
              label: 'P99',
            }),
            api.metricLatency({
              statistic: 'Average',
              period: cdk.Duration.minutes(5),
              label: 'Average',
            }),
          ],
        })
      );

      // API Request count and errors
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: `${api.restApiName} - Requests & Errors`,
          width: 12,
          height: 6,
          left: [
            api.metricCount({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
              label: 'Total Requests',
            }),
          ],
          right: [
            api.metric('4XXError', {
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
              label: '4XX Errors',
            }),
            api.metric('5XXError', {
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
              label: '5XX Errors',
            }),
          ],
        })
      );
    });
  }

  private addLambdaMetrics(functions: lambda.Function[]): void {
    // Lambda invocations widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        width: 12,
        height: 6,
        left: functions.map((fn) =>
          fn.metricInvocations({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: fn.functionName,
          })
        ),
      })
    );

    // Lambda errors widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        width: 12,
        height: 6,
        left: functions.map((fn) =>
          fn.metricErrors({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: fn.functionName,
          })
        ),
      })
    );

    // Lambda duration widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration (P95)',
        width: 12,
        height: 6,
        left: functions.map((fn) =>
          fn.metricDuration({
            statistic: 'p95',
            period: cdk.Duration.minutes(5),
            label: fn.functionName,
          })
        ),
      })
    );

    // Lambda throttles widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        width: 12,
        height: 6,
        left: functions.map((fn) =>
          fn.metricThrottles({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: fn.functionName,
          })
        ),
      })
    );
  }

  private createApiGatewayAlarms(apis: apigateway.RestApi[]): void {
    apis.forEach((api) => {
      // P95 Latency alarm (> 300ms)
      const latencyAlarm = new cloudwatch.Alarm(this, `${api.restApiName}LatencyAlarm`, {
        alarmName: `${api.restApiName}-high-latency`,
        alarmDescription: `P95 latency exceeds 300ms for ${api.restApiName}`,
        metric: api.metricLatency({
          statistic: 'p95',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 300,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      latencyAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      // 5XX Error rate alarm
      const errorRateAlarm = new cloudwatch.Alarm(this, `${api.restApiName}ErrorRateAlarm`, {
        alarmName: `${api.restApiName}-high-error-rate`,
        alarmDescription: `5XX error rate exceeds 5% for ${api.restApiName}`,
        metric: new cloudwatch.MathExpression({
          expression: '(errors / requests) * 100',
          usingMetrics: {
            errors: api.metric('5XXError', {
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
            requests: api.metricCount({
              statistic: 'Sum',
              period: cdk.Duration.minutes(5),
            }),
          },
        }),
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });
  }

  private createLambdaAlarms(functions: lambda.Function[]): void {
    functions.forEach((fn) => {
      // Error rate alarm
      const errorAlarm = fn.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }).createAlarm(this, `${fn.functionName}ErrorAlarm`, {
        alarmName: `${fn.functionName}-errors`,
        alarmDescription: `Lambda function ${fn.functionName} has errors`,
        threshold: 5,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      errorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

      // Throttle alarm
      const throttleAlarm = fn.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }).createAlarm(this, `${fn.functionName}ThrottleAlarm`, {
        alarmName: `${fn.functionName}-throttles`,
        alarmDescription: `Lambda function ${fn.functionName} is being throttled`,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    });
  }

  private createBusinessKPIMetrics(serviceName: string, environment: string): void {
    const namespace = `${serviceName}/${environment}`;

    // Business KPIs dashboard section
    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '## Business KPIs',
        width: 24,
        height: 1,
      })
    );

    // Time to assign metric
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Time to Assign (seconds)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'TimeToAssign',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            label: 'Average',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'TimeToAssign',
            statistic: 'p95',
            period: cdk.Duration.minutes(5),
            label: 'P95',
          }),
        ],
      })
    );

    // Time to arrival metric
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Time to Arrival (minutes)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'TimeToArrival',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            label: 'Average',
          }),
          new cloudwatch.Metric({
            namespace,
            metricName: 'TimeToArrival',
            statistic: 'p95',
            period: cdk.Duration.minutes(5),
            label: 'P95',
          }),
        ],
      })
    );

    // Vendor acceptance rate
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Vendor Acceptance Rate (%)',
        width: 8,
        height: 6,
        left: [
          new cloudwatch.MathExpression({
            expression: '(accepted / offered) * 100',
            usingMetrics: {
              accepted: new cloudwatch.Metric({
                namespace,
                metricName: 'OffersAccepted',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
              }),
              offered: new cloudwatch.Metric({
                namespace,
                metricName: 'OffersCreated',
                statistic: 'Sum',
                period: cdk.Duration.minutes(5),
              }),
            },
            label: 'Acceptance Rate',
          }),
        ],
      })
    );

    // Active incidents
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'Active Incidents',
        width: 6,
        height: 6,
        metrics: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'ActiveIncidents',
            statistic: 'Maximum',
            period: cdk.Duration.minutes(1),
          }),
        ],
      })
    );

    // Incident resolution rate
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Incident Resolution Rate (%)',
        width: 9,
        height: 6,
        left: [
          new cloudwatch.MathExpression({
            expression: '(completed / created) * 100',
            usingMetrics: {
              completed: new cloudwatch.Metric({
                namespace,
                metricName: 'IncidentsCompleted',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
              created: new cloudwatch.Metric({
                namespace,
                metricName: 'IncidentsCreated',
                statistic: 'Sum',
                period: cdk.Duration.hours(1),
              }),
            },
            label: 'Resolution Rate',
          }),
        ],
      })
    );

    // Payment processing time
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Payment Approval Time (minutes)',
        width: 9,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName: 'PaymentApprovalTime',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            label: 'Average',
          }),
        ],
      })
    );

    // Create alarms for business KPIs
    this.createBusinessKPIAlarms(namespace);
  }

  private createBusinessKPIAlarms(namespace: string): void {
    // Time to assign SLA alarm (> 60 seconds)
    const timeToAssignAlarm = new cloudwatch.Alarm(this, 'TimeToAssignAlarm', {
      alarmName: 'high-time-to-assign',
      alarmDescription: 'Time to assign vendor exceeds 60 seconds',
      metric: new cloudwatch.Metric({
        namespace,
        metricName: 'TimeToAssign',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 60,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    timeToAssignAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));

    // Vendor acceptance rate alarm (< 50%)
    const acceptanceRateAlarm = new cloudwatch.Alarm(this, 'AcceptanceRateAlarm', {
      alarmName: 'low-vendor-acceptance-rate',
      alarmDescription: 'Vendor acceptance rate below 50%',
      metric: new cloudwatch.MathExpression({
        expression: '(accepted / offered) * 100',
        usingMetrics: {
          accepted: new cloudwatch.Metric({
            namespace,
            metricName: 'OffersAccepted',
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
          offered: new cloudwatch.Metric({
            namespace,
            metricName: 'OffersCreated',
            statistic: 'Sum',
            period: cdk.Duration.minutes(15),
          }),
        },
      }),
      threshold: 50,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    acceptanceRateAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
  }

  /**
   * Add custom metric to the dashboard
   */
  public addCustomMetric(
    title: string,
    namespace: string,
    metricName: string,
    statistic: string = 'Average'
  ): void {
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title,
        width: 12,
        height: 6,
        left: [
          new cloudwatch.Metric({
            namespace,
            metricName,
            statistic,
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );
  }

  /**
   * Create a custom alarm
   */
  public createCustomAlarm(
    id: string,
    alarmName: string,
    description: string,
    metric: cloudwatch.IMetric,
    threshold: number,
    comparisonOperator: cloudwatch.ComparisonOperator = cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD
  ): cloudwatch.Alarm {
    const alarm = new cloudwatch.Alarm(this, id, {
      alarmName,
      alarmDescription: description,
      metric,
      threshold,
      evaluationPeriods: 2,
      comparisonOperator,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    alarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(this.alarmTopic));
    return alarm;
  }
}
