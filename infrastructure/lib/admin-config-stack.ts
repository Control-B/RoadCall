import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface AdminConfigStackProps extends cdk.StackProps {
  stage: string;
  kmsKey: kms.IKey;
  api: apigateway.RestApi;
  cognitoAuthorizer: apigateway.CognitoUserPoolsAuthorizer;
  eventBus: events.IEventBus;
}

export class AdminConfigStack extends cdk.Stack {
  public readonly configTable: dynamodb.Table;
  public readonly configAuditTable: dynamodb.Table;
  public readonly configVersionsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: AdminConfigStackProps) {
    super(scope, id, props);

    const { stage, kmsKey, api, cognitoAuthorizer, eventBus } = props;

    // ========================================================================
    // DynamoDB Tables
    // ========================================================================

    // System Configuration Table
    this.configTable = new dynamodb.Table(this, 'ConfigTable', {
      tableName: `roadcall-config-${stage}`,
      partitionKey: { name: 'configKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for getting latest version
    this.configTable.addGlobalSecondaryIndex({
      indexName: 'latest-version-index',
      partitionKey: { name: 'configKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'isLatest', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Configuration Audit Log Table
    this.configAuditTable = new dynamodb.Table(this, 'ConfigAuditTable', {
      tableName: `roadcall-config-audit-${stage}`,
      partitionKey: { name: 'auditId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying by config key
    this.configAuditTable.addGlobalSecondaryIndex({
      indexName: 'config-key-index',
      partitionKey: { name: 'configKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying by user
    this.configAuditTable.addGlobalSecondaryIndex({
      indexName: 'user-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Configuration Versions Table (for rollback)
    this.configVersionsTable = new dynamodb.Table(this, 'ConfigVersionsTable', {
      tableName: `roadcall-config-versions-${stage}`,
      partitionKey: { name: 'configKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ========================================================================
    // Lambda Functions
    // ========================================================================

    // Get Configuration Handler
    const getConfigHandler = new NodejsFunction(this, 'GetConfigHandler', {
      functionName: `roadcall-get-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/get-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadData(getConfigHandler);

    // Update Configuration Handler
    const updateConfigHandler = new NodejsFunction(this, 'UpdateConfigHandler', {
      functionName: `roadcall-update-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/update-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(updateConfigHandler);
    this.configAuditTable.grantWriteData(updateConfigHandler);
    this.configVersionsTable.grantWriteData(updateConfigHandler);

    // Get Matching Config Handler
    const getMatchingConfigHandler = new NodejsFunction(this, 'GetMatchingConfigHandler', {
      functionName: `roadcall-get-matching-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/get-matching-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadData(getMatchingConfigHandler);

    // Update Matching Config Handler
    const updateMatchingConfigHandler = new NodejsFunction(this, 'UpdateMatchingConfigHandler', {
      functionName: `roadcall-update-matching-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/update-matching-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(updateMatchingConfigHandler);
    this.configAuditTable.grantWriteData(updateMatchingConfigHandler);
    this.configVersionsTable.grantWriteData(updateMatchingConfigHandler);

    // Get SLA Tiers Config Handler
    const getSLAConfigHandler = new NodejsFunction(this, 'GetSLAConfigHandler', {
      functionName: `roadcall-get-sla-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/get-sla-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadData(getSLAConfigHandler);

    // Update SLA Tiers Config Handler
    const updateSLAConfigHandler = new NodejsFunction(this, 'UpdateSLAConfigHandler', {
      functionName: `roadcall-update-sla-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/update-sla-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(updateSLAConfigHandler);
    this.configAuditTable.grantWriteData(updateSLAConfigHandler);
    this.configVersionsTable.grantWriteData(updateSLAConfigHandler);

    // Create Geofence Handler
    const createGeofenceHandler = new NodejsFunction(this, 'CreateGeofenceHandler', {
      functionName: `roadcall-create-geofence-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/create-geofence.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(createGeofenceHandler);
    this.configAuditTable.grantWriteData(createGeofenceHandler);
    this.configVersionsTable.grantWriteData(createGeofenceHandler);

    // Get Pricing Config Handler
    const getPricingConfigHandler = new NodejsFunction(this, 'GetPricingConfigHandler', {
      functionName: `roadcall-get-pricing-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/get-pricing-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadData(getPricingConfigHandler);

    // Update Pricing Config Handler
    const updatePricingConfigHandler = new NodejsFunction(this, 'UpdatePricingConfigHandler', {
      functionName: `roadcall-update-pricing-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/update-pricing-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(updatePricingConfigHandler);
    this.configAuditTable.grantWriteData(updatePricingConfigHandler);
    this.configVersionsTable.grantWriteData(updatePricingConfigHandler);

    // Rollback Configuration Handler
    const rollbackConfigHandler = new NodejsFunction(this, 'RollbackConfigHandler', {
      functionName: `roadcall-rollback-config-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/rollback-config.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONFIG_TABLE_NAME: this.configTable.tableName,
        CONFIG_AUDIT_TABLE_NAME: this.configAuditTable.tableName,
        CONFIG_VERSIONS_TABLE_NAME: this.configVersionsTable.tableName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.configTable.grantReadWriteData(rollbackConfigHandler);
    this.configAuditTable.grantWriteData(rollbackConfigHandler);
    this.configVersionsTable.grantReadData(rollbackConfigHandler);

    // Config Change Notifier (DynamoDB Stream Handler)
    const configChangeNotifier = new NodejsFunction(this, 'ConfigChangeNotifier', {
      functionName: `roadcall-config-change-notifier-${stage}`,
      entry: path.join(__dirname, '../../services/admin-config-svc/src/handlers/config-change-notifier.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
        STAGE: stage,
        POWERTOOLS_SERVICE_NAME: 'admin-config-svc',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Add DynamoDB Stream as event source
    configChangeNotifier.addEventSource(
      new DynamoEventSource(this.configTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 3,
      })
    );

    // Grant permissions to publish to EventBridge
    eventBus.grantPutEventsTo(configChangeNotifier);

    // ========================================================================
    // API Gateway Routes
    // ========================================================================

    const configResource = api.root.addResource('config');

    // GET /config/matching
    const matchingResource = configResource.addResource('matching');
    matchingResource.addMethod('GET', new apigateway.LambdaIntegration(getMatchingConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /config/matching
    matchingResource.addMethod('PUT', new apigateway.LambdaIntegration(updateMatchingConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /config/sla-tiers
    const slaResource = configResource.addResource('sla-tiers');
    slaResource.addMethod('GET', new apigateway.LambdaIntegration(getSLAConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /config/sla-tiers
    slaResource.addMethod('PUT', new apigateway.LambdaIntegration(updateSLAConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /config/pricing
    const pricingResource = configResource.addResource('pricing');
    pricingResource.addMethod('GET', new apigateway.LambdaIntegration(getPricingConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /config/pricing
    pricingResource.addMethod('PUT', new apigateway.LambdaIntegration(updatePricingConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /config/geofences
    const geofencesResource = configResource.addResource('geofences');
    geofencesResource.addMethod('POST', new apigateway.LambdaIntegration(createGeofenceHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /config/rollback
    const rollbackResource = configResource.addResource('rollback');
    rollbackResource.addMethod('POST', new apigateway.LambdaIntegration(rollbackConfigHandler), {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'ConfigTableName', {
      value: this.configTable.tableName,
      exportName: `${stage}-ConfigTableName`,
    });

    new cdk.CfnOutput(this, 'ConfigAuditTableName', {
      value: this.configAuditTable.tableName,
      exportName: `${stage}-ConfigAuditTableName`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'AdminConfig');
  }
}
