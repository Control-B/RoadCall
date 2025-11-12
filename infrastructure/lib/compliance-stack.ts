import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ComplianceStackProps extends cdk.StackProps {
  usersTable: dynamodb.ITable;
  driversTable: dynamodb.ITable;
  vendorsTable: dynamodb.ITable;
  incidentsTable: dynamodb.ITable;
  callRecordsTable: dynamodb.ITable;
  trackingSessionsTable: dynamodb.ITable;
  callRecordingsBucket: s3.IBucket;
  incidentMediaBucket: s3.IBucket;
  auroraClusterArn: string;
  auroraSecretArn: string;
  databaseName: string;
  eventBusName: string;
  kmsKey: cdk.aws_kms.IKey;
}

export class ComplianceStack extends cdk.Stack {
  public readonly piiDeletionFunction: lambda.IFunction;
  public readonly dataExportFunction: lambda.IFunction;
  public readonly rightToBeForgottenFunction: lambda.IFunction;
  public readonly consentManagementFunction: lambda.IFunction;
  public readonly consentTable: dynamodb.Table;
  public readonly exportBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ComplianceStackProps) {
    super(scope, id, props);

    // Create consent management table
    this.consentTable = new dynamodb.Table(this, 'ConsentTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'consentType', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create export bucket for data exports
    this.exportBucket = new s3.Bucket(this, 'ExportBucket', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteExportsAfter30Days',
          enabled: true,
          expiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lambda function for automated PII deletion
    this.piiDeletionFunction = new NodejsFunction(this, 'PIIDeletionFunction', {
      entry: path.join(__dirname, '../../services/compliance-svc/src/handlers/pii-deletion.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        DRIVERS_TABLE: props.driversTable.tableName,
        VENDORS_TABLE: props.vendorsTable.tableName,
        CALL_RECORDS_TABLE: props.callRecordsTable.tableName,
        AURORA_CLUSTER_ARN: props.auroraClusterArn,
        AURORA_SECRET_ARN: props.auroraSecretArn,
        DATABASE_NAME: props.databaseName,
        POWERTOOLS_SERVICE_NAME: 'compliance-svc',
        POWERTOOLS_METRICS_NAMESPACE: 'RoadcallAssistant',
        LOG_LEVEL: 'INFO',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_YEAR,
    });

    // Grant permissions for PII deletion
    props.usersTable.grantReadWriteData(this.piiDeletionFunction);
    props.driversTable.grantReadWriteData(this.piiDeletionFunction);
    props.vendorsTable.grantReadWriteData(this.piiDeletionFunction);
    props.callRecordsTable.grantReadWriteData(this.piiDeletionFunction);

    // Grant Aurora access
    this.piiDeletionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement'],
      resources: [props.auroraClusterArn],
    }));

    this.piiDeletionFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.auroraSecretArn],
    }));

    // Schedule PII deletion to run daily at 2 AM UTC
    const piiDeletionRule = new events.Rule(this, 'PIIDeletionSchedule', {
      schedule: events.Schedule.cron({ hour: '2', minute: '0' }),
      description: 'Trigger PII deletion for inactive users daily',
    });

    piiDeletionRule.addTarget(new targets.LambdaFunction(this.piiDeletionFunction));

    // Lambda function for data export
    this.dataExportFunction = new NodejsFunction(this, 'DataExportFunction', {
      entry: path.join(__dirname, '../../services/compliance-svc/src/handlers/data-export.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        DRIVERS_TABLE: props.driversTable.tableName,
        VENDORS_TABLE: props.vendorsTable.tableName,
        INCIDENTS_TABLE: props.incidentsTable.tableName,
        CALL_RECORDS_TABLE: props.callRecordsTable.tableName,
        AURORA_CLUSTER_ARN: props.auroraClusterArn,
        AURORA_SECRET_ARN: props.auroraSecretArn,
        DATABASE_NAME: props.databaseName,
        EXPORT_BUCKET: this.exportBucket.bucketName,
        POWERTOOLS_SERVICE_NAME: 'compliance-svc',
        LOG_LEVEL: 'INFO',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_YEAR,
    });

    // Grant permissions for data export
    props.usersTable.grantReadData(this.dataExportFunction);
    props.driversTable.grantReadData(this.dataExportFunction);
    props.vendorsTable.grantReadData(this.dataExportFunction);
    props.incidentsTable.grantReadData(this.dataExportFunction);
    props.callRecordsTable.grantReadData(this.dataExportFunction);
    this.exportBucket.grantWrite(this.dataExportFunction);

    this.dataExportFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement'],
      resources: [props.auroraClusterArn],
    }));

    this.dataExportFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.auroraSecretArn],
    }));

    // Lambda function for right-to-be-forgotten
    this.rightToBeForgottenFunction = new NodejsFunction(this, 'RightToBeForgottenFunction', {
      entry: path.join(__dirname, '../../services/compliance-svc/src/handlers/right-to-be-forgotten.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        USERS_TABLE: props.usersTable.tableName,
        DRIVERS_TABLE: props.driversTable.tableName,
        VENDORS_TABLE: props.vendorsTable.tableName,
        INCIDENTS_TABLE: props.incidentsTable.tableName,
        CALL_RECORDS_TABLE: props.callRecordsTable.tableName,
        TRACKING_SESSIONS_TABLE: props.trackingSessionsTable.tableName,
        AURORA_CLUSTER_ARN: props.auroraClusterArn,
        AURORA_SECRET_ARN: props.auroraSecretArn,
        DATABASE_NAME: props.databaseName,
        CALL_RECORDINGS_BUCKET: props.callRecordingsBucket.bucketName,
        INCIDENT_MEDIA_BUCKET: props.incidentMediaBucket.bucketName,
        EVENT_BUS_NAME: props.eventBusName,
        POWERTOOLS_SERVICE_NAME: 'compliance-svc',
        POWERTOOLS_METRICS_NAMESPACE: 'RoadcallAssistant',
        LOG_LEVEL: 'INFO',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_YEAR,
    });

    // Grant permissions for right-to-be-forgotten
    props.usersTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.driversTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.vendorsTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.incidentsTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.callRecordsTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.trackingSessionsTable.grantReadWriteData(this.rightToBeForgottenFunction);
    props.callRecordingsBucket.grantDelete(this.rightToBeForgottenFunction);
    props.incidentMediaBucket.grantDelete(this.rightToBeForgottenFunction);

    this.rightToBeForgottenFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['rds-data:ExecuteStatement'],
      resources: [props.auroraClusterArn],
    }));

    this.rightToBeForgottenFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.auroraSecretArn],
    }));

    this.rightToBeForgottenFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/${props.eventBusName}`],
    }));

    // Lambda function for consent management
    this.consentManagementFunction = new NodejsFunction(this, 'ConsentManagementFunction', {
      entry: path.join(__dirname, '../../services/compliance-svc/src/handlers/consent-management.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        CONSENT_TABLE: this.consentTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'compliance-svc',
        LOG_LEVEL: 'INFO',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_YEAR,
    });

    // Grant permissions for consent management
    this.consentTable.grantReadWriteData(this.consentManagementFunction);

    // Lambda function for temporary data cleanup
    const temporaryDataCleanupFunction = new NodejsFunction(this, 'TemporaryDataCleanupFunction', {
      entry: path.join(__dirname, '../../services/compliance-svc/src/handlers/temporary-data-cleanup.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      environment: {
        TRACKING_SESSIONS_TABLE: props.trackingSessionsTable.tableName,
        CALL_RECORDINGS_BUCKET: props.callRecordingsBucket.bucketName,
        INCIDENT_MEDIA_BUCKET: props.incidentMediaBucket.bucketName,
        POWERTOOLS_SERVICE_NAME: 'compliance-svc',
        POWERTOOLS_METRICS_NAMESPACE: 'RoadcallAssistant',
        LOG_LEVEL: 'INFO',
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_YEAR,
    });

    // Grant permissions for temporary data cleanup
    props.trackingSessionsTable.grantReadWriteData(temporaryDataCleanupFunction);
    props.callRecordingsBucket.grantDelete(temporaryDataCleanupFunction);
    props.callRecordingsBucket.grantReadWrite(temporaryDataCleanupFunction);
    props.incidentMediaBucket.grantDelete(temporaryDataCleanupFunction);
    props.incidentMediaBucket.grantReadWrite(temporaryDataCleanupFunction);

    // Schedule temporary data cleanup to run daily at 3 AM UTC
    const temporaryDataCleanupRule = new events.Rule(this, 'TemporaryDataCleanupSchedule', {
      schedule: events.Schedule.cron({ hour: '3', minute: '0' }),
      description: 'Trigger temporary data cleanup (GPS tracks, recordings) daily',
    });

    temporaryDataCleanupRule.addTarget(new targets.LambdaFunction(temporaryDataCleanupFunction));

    // Output important ARNs
    new cdk.CfnOutput(this, 'ConsentTableName', {
      value: this.consentTable.tableName,
      description: 'Consent management table name',
    });

    new cdk.CfnOutput(this, 'ExportBucketName', {
      value: this.exportBucket.bucketName,
      description: 'Data export bucket name',
    });

    new cdk.CfnOutput(this, 'PIIDeletionFunctionArn', {
      value: this.piiDeletionFunction.functionArn,
      description: 'PII deletion Lambda function ARN',
    });

    new cdk.CfnOutput(this, 'TemporaryDataCleanupFunctionArn', {
      value: temporaryDataCleanupFunction.functionArn,
      description: 'Temporary data cleanup Lambda function ARN',
    });
  }
}
