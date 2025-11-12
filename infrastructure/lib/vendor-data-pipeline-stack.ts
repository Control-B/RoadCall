/**
 * Vendor Data Pipeline Stack
 * 
 * Infrastructure for vendor data collection pipeline
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export interface VendorDataPipelineStackProps extends cdk.StackProps {
  environment: string;
}

export class VendorDataPipelineStack extends cdk.Stack {
  public readonly auditTable: dynamodb.Table;
  public readonly verificationQueueTable: dynamodb.Table;
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: VendorDataPipelineStackProps) {
    super(scope, id, props);

    // DynamoDB Table for Audit Logs
    this.auditTable = new dynamodb.Table(this, 'AuditLogTable', {
      tableName: `VendorDataAuditLog-${props.environment}`,
      partitionKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    // GSI for querying by action type
    this.auditTable.addGlobalSecondaryIndex({
      indexName: 'ActionIndex',
      partitionKey: { name: 'action', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // DynamoDB Table for Verification Queue
    this.verificationQueueTable = new dynamodb.Table(this, 'VerificationQueueTable', {
      tableName: `VendorVerificationQueue-${props.environment}`,
      partitionKey: { name: 'itemId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // GSI for querying by status
    this.verificationQueueTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Lambda Layer for Playwright
    const playwrightLayer = new lambda.LayerVersion(this, 'PlaywrightLayer', {
      code: lambda.Code.fromAsset('layers/playwright'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Playwright for web scraping'
    });

    // Lambda Function: Scrape Single Target
    const scrapeSingleFunction = new NodejsFunction(this, 'ScrapeSingleFunction', {
      functionName: `vendor-data-scrape-single-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/scrape-handler.ts',
      handler: 'scrapeSingleTarget',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 2048, // Playwright needs more memory
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        RATE_LIMIT_PER_MINUTE: '10',
        RATE_LIMIT_PER_HOUR: '100',
        DELAY_BETWEEN_REQUESTS: '1000',
        NODE_ENV: props.environment
      },
      bundling: {
        minify: true,
        externalModules: ['playwright']
      },
      layers: [playwrightLayer],
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda Function: Scrape Batch
    const scrapeBatchFunction = new NodejsFunction(this, 'ScrapeBatchFunction', {
      functionName: `vendor-data-scrape-batch-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/scrape-handler.ts',
      handler: 'scrapeBatch',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(15),
      memorySize: 2048,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        RATE_LIMIT_PER_MINUTE: '10',
        RATE_LIMIT_PER_HOUR: '100',
        DELAY_BETWEEN_REQUESTS: '1000',
        NODE_ENV: props.environment
      },
      bundling: {
        minify: true,
        externalModules: ['playwright']
      },
      layers: [playwrightLayer],
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda Function: Get Pipeline Status
    const getPipelineStatusFunction = new NodejsFunction(this, 'GetPipelineStatusFunction', {
      functionName: `vendor-data-pipeline-status-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/scrape-handler.ts',
      handler: 'getPipelineStatus',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        AUDIT_TABLE_NAME: this.auditTable.tableName,
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        NODE_ENV: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda Function: Get Pending Items
    const getPendingItemsFunction = new NodejsFunction(this, 'GetPendingItemsFunction', {
      functionName: `vendor-data-get-pending-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/verification-handler.ts',
      handler: 'getPendingItems',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        NODE_ENV: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda Function: Approve Item
    const approveItemFunction = new NodejsFunction(this, 'ApproveItemFunction', {
      functionName: `vendor-data-approve-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/verification-handler.ts',
      handler: 'approveItem',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        NODE_ENV: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Lambda Function: Reject Item
    const rejectItemFunction = new NodejsFunction(this, 'RejectItemFunction', {
      functionName: `vendor-data-reject-${props.environment}`,
      entry: '../services/vendor-data-pipeline-svc/src/handlers/verification-handler.ts',
      handler: 'rejectItem',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        VERIFICATION_QUEUE_TABLE_NAME: this.verificationQueueTable.tableName,
        NODE_ENV: props.environment
      },
      logRetention: logs.RetentionDays.ONE_MONTH
    });

    // Grant DynamoDB permissions
    this.auditTable.grantWriteData(scrapeSingleFunction);
    this.auditTable.grantWriteData(scrapeBatchFunction);
    this.verificationQueueTable.grantReadWriteData(scrapeSingleFunction);
    this.verificationQueueTable.grantReadWriteData(scrapeBatchFunction);
    this.verificationQueueTable.grantReadData(getPendingItemsFunction);
    this.verificationQueueTable.grantReadWriteData(approveItemFunction);
    this.verificationQueueTable.grantReadWriteData(rejectItemFunction);

    // API Gateway
    this.api = new apigateway.RestApi(this, 'VendorDataPipelineApi', {
      restApiName: `vendor-data-pipeline-${props.environment}`,
      description: 'API for vendor data collection pipeline',
      deployOptions: {
        stageName: props.environment,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        metricsEnabled: true
      }
    });

    // API Resources
    const scrapeResource = this.api.root.addResource('scrape');
    const singleResource = scrapeResource.addResource('single');
    const batchResource = scrapeResource.addResource('batch');
    const statusResource = this.api.root.addResource('status');
    
    const verificationResource = this.api.root.addResource('verification');
    const pendingResource = verificationResource.addResource('pending');
    const itemResource = verificationResource.addResource('{itemId}');
    const approveResource = itemResource.addResource('approve');
    const rejectResource = itemResource.addResource('reject');

    // API Methods
    singleResource.addMethod('POST', new apigateway.LambdaIntegration(scrapeSingleFunction));
    batchResource.addMethod('POST', new apigateway.LambdaIntegration(scrapeBatchFunction));
    statusResource.addMethod('GET', new apigateway.LambdaIntegration(getPipelineStatusFunction));
    pendingResource.addMethod('GET', new apigateway.LambdaIntegration(getPendingItemsFunction));
    approveResource.addMethod('POST', new apigateway.LambdaIntegration(approveItemFunction));
    rejectResource.addMethod('POST', new apigateway.LambdaIntegration(rejectItemFunction));

    // EventBridge Rule for Scheduled Scraping (optional)
    const scheduledScrapeRule = new events.Rule(this, 'ScheduledScrapeRule', {
      ruleName: `vendor-data-scheduled-scrape-${props.environment}`,
      description: 'Scheduled vendor data scraping',
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }), // Daily at 2 AM
      enabled: false // Disabled by default
    });

    scheduledScrapeRule.addTarget(new targets.LambdaFunction(scrapeBatchFunction));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Vendor Data Pipeline API URL'
    });

    new cdk.CfnOutput(this, 'AuditTableName', {
      value: this.auditTable.tableName,
      description: 'Audit Log Table Name'
    });

    new cdk.CfnOutput(this, 'VerificationQueueTableName', {
      value: this.verificationQueueTable.tableName,
      description: 'Verification Queue Table Name'
    });
  }
}
