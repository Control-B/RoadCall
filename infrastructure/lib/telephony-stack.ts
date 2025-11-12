/**
 * Telephony Stack
 * Amazon Connect instance and telephony service infrastructure
 */

import * as cdk from 'aws-cdk-lib';
import * as connect from 'aws-cdk-lib/aws-connect';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as events from 'aws-cdk-lib/aws-events';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import * as path from 'path';

export interface TelephonyStackProps extends cdk.StackProps {
  serviceName: string;
  usersTable: dynamodb.ITable;
  incidentsTable: dynamodb.ITable;
  eventBus: events.IEventBus;
  kmsKey: kms.IKey;
  kendraIndexId?: string;
  bedrockGuardrailId?: string;
  bedrockGuardrailVersion?: string;
}

export class TelephonyStack extends cdk.Stack {
  public readonly connectInstance: connect.CfnInstance;
  public readonly callRecordingsTable: dynamodb.Table;
  public readonly transcriptsTable: dynamodb.Table;
  public readonly summariesTable: dynamodb.Table;
  public readonly piiMappingTable: dynamodb.Table;
  public readonly piiAccessLogTable: dynamodb.Table;
  public readonly recordingsBucket: s3.Bucket;
  public readonly transcriptionBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: TelephonyStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    this.callRecordingsTable = new dynamodb.Table(this, 'CallRecordsTable', {
      tableName: `${props.serviceName}-call-records`,
      partitionKey: { name: 'callId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for incident lookup
    this.callRecordingsTable.addGlobalSecondaryIndex({
      indexName: 'incident-index',
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
    });

    // GSI for driver call history
    this.callRecordingsTable.addGlobalSecondaryIndex({
      indexName: 'driver-index',
      partitionKey: { name: 'driverId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
    });

    this.transcriptsTable = new dynamodb.Table(this, 'TranscriptsTable', {
      tableName: `${props.serviceName}-transcripts`,
      partitionKey: { name: 'transcriptId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for call lookup
    this.transcriptsTable.addGlobalSecondaryIndex({
      indexName: 'call-index',
      partitionKey: { name: 'callId', type: dynamodb.AttributeType.STRING },
    });

    // Call Summaries Table - stores AI-generated summaries
    this.summariesTable = new dynamodb.Table(this, 'SummariesTable', {
      tableName: `${props.serviceName}-summaries`,
      partitionKey: { name: 'summaryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for call lookup
    this.summariesTable.addGlobalSecondaryIndex({
      indexName: 'call-index',
      partitionKey: { name: 'callId', type: dynamodb.AttributeType.STRING },
    });

    // GSI for incident lookup
    this.summariesTable.addGlobalSecondaryIndex({
      indexName: 'incident-index',
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
    });

    // PII Mapping Table - stores encrypted PII for authorized access
    this.piiMappingTable = new dynamodb.Table(this, 'PIIMappingTable', {
      tableName: `${props.serviceName}-pii-mappings`,
      partitionKey: { name: 'mappingId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for transcript lookup
    this.piiMappingTable.addGlobalSecondaryIndex({
      indexName: 'transcript-index',
      partitionKey: { name: 'transcriptId', type: dynamodb.AttributeType.STRING },
    });

    // PII Access Log Table - audit trail for PII access
    this.piiAccessLogTable = new dynamodb.Table(this, 'PIIAccessLogTable', {
      tableName: `${props.serviceName}-pii-access-logs`,
      partitionKey: { name: 'logId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'accessedAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: props.kmsKey,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for user access history
    this.piiAccessLogTable.addGlobalSecondaryIndex({
      indexName: 'user-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'accessedAt', type: dynamodb.AttributeType.STRING },
    });

    // GSI for transcript access history
    this.piiAccessLogTable.addGlobalSecondaryIndex({
      indexName: 'transcript-index',
      partitionKey: { name: 'transcriptId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'accessedAt', type: dynamodb.AttributeType.STRING },
    });

    // S3 Buckets for recordings and transcriptions
    this.recordingsBucket = new s3.Bucket(this, 'RecordingsBucket', {
      bucketName: `${props.serviceName}-call-recordings-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [
        {
          id: 'DeleteOldRecordings',
          enabled: true,
          expiration: cdk.Duration.days(90),
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.transcriptionBucket = new s3.Bucket(this, 'TranscriptionBucket', {
      bucketName: `${props.serviceName}-transcriptions-${cdk.Aws.ACCOUNT_ID}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: props.kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldTranscriptions',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lambda Functions
    const driverLookupFunction = new nodejs.NodejsFunction(this, 'DriverLookupFunction', {
      functionName: `${props.serviceName}-driver-lookup`,
      entry: path.join(__dirname, '../../services/telephony-svc/src/handlers/driver-lookup.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(8),
      memorySize: 512,
      environment: {
        USERS_TABLE_NAME: props.usersTable.tableName,
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    props.usersTable.grantReadData(driverLookupFunction);

    const createIncidentFunction = new nodejs.NodejsFunction(this, 'CreateIncidentFunction', {
      functionName: `${props.serviceName}-create-incident-from-call`,
      entry: path.join(
        __dirname,
        '../../services/telephony-svc/src/handlers/create-incident-from-call.ts'
      ),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        INCIDENTS_TABLE_NAME: props.incidentsTable.tableName,
        EVENT_BUS_NAME: props.eventBus.eventBusName,
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    props.incidentsTable.grantWriteData(createIncidentFunction);
    props.eventBus.grantPutEventsTo(createIncidentFunction);

    const postCallProcessorFunction = new nodejs.NodejsFunction(this, 'PostCallProcessorFunction', {
      functionName: `${props.serviceName}-post-call-processor`,
      entry: path.join(
        __dirname,
        '../../services/telephony-svc/src/handlers/post-call-processor.ts'
      ),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.minutes(5),
      memorySize: 1024,
      environment: {
        TRANSCRIPTS_TABLE_NAME: this.transcriptsTable.tableName,
        CALL_RECORDS_TABLE_NAME: this.callRecordingsTable.tableName,
        PII_MAPPING_TABLE_NAME: this.piiMappingTable.tableName,
        TRANSCRIPTION_BUCKET_NAME: this.transcriptionBucket.bucketName,
        KMS_KEY_ID: props.kmsKey.keyId,
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    this.transcriptsTable.grantWriteData(postCallProcessorFunction);
    this.callRecordingsTable.grantReadWriteData(postCallProcessorFunction);
    this.piiMappingTable.grantWriteData(postCallProcessorFunction);
    this.recordingsBucket.grantRead(postCallProcessorFunction);
    this.transcriptionBucket.grantReadWrite(postCallProcessorFunction);
    props.kmsKey.grantEncryptDecrypt(postCallProcessorFunction);

    // Grant Transcribe permissions
    postCallProcessorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'transcribe:StartTranscriptionJob',
          'transcribe:GetTranscriptionJob',
          'transcribe:ListTranscriptionJobs',
        ],
        resources: ['*'],
      })
    );

    // Grant Comprehend permissions for PII detection
    postCallProcessorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['comprehend:DetectPiiEntities', 'comprehend:ContainsPiiEntities'],
        resources: ['*'],
      })
    );

    // Generate Summary Function - AI-powered call summarization
    const generateSummaryFunction = new nodejs.NodejsFunction(this, 'GenerateSummaryFunction', {
      functionName: `${props.serviceName}-generate-summary`,
      entry: path.join(
        __dirname,
        '../../services/telephony-svc/src/handlers/generate-summary.ts'
      ),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      environment: {
        TRANSCRIPTS_TABLE_NAME: this.transcriptsTable.tableName,
        SUMMARIES_TABLE_NAME: this.summariesTable.tableName,
        CALL_RECORDS_TABLE_NAME: this.callRecordingsTable.tableName,
        INCIDENTS_TABLE_NAME: props.incidentsTable.tableName,
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
        BEDROCK_GUARDRAIL_ID: props.bedrockGuardrailId || '',
        BEDROCK_GUARDRAIL_VERSION: props.bedrockGuardrailVersion || 'DRAFT',
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    this.transcriptsTable.grantReadData(generateSummaryFunction);
    this.summariesTable.grantWriteData(generateSummaryFunction);
    this.callRecordingsTable.grantReadWriteData(generateSummaryFunction);
    props.incidentsTable.grantReadWriteData(generateSummaryFunction);

    // Grant Bedrock permissions
    generateSummaryFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        ],
      })
    );

    // Grant Bedrock Guardrails permissions if configured
    if (props.bedrockGuardrailId) {
      generateSummaryFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:ApplyGuardrail'],
          resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:guardrail/${props.bedrockGuardrailId}`,
          ],
        })
      );
    }

    // Agent Assist Function - Real-time knowledge base queries
    const agentAssistFunction = new nodejs.NodejsFunction(this, 'AgentAssistFunction', {
      functionName: `${props.serviceName}-agent-assist`,
      entry: path.join(__dirname, '../../services/telephony-svc/src/handlers/agent-assist.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(5),
      memorySize: 512,
      environment: {
        KENDRA_INDEX_ID: props.kendraIndexId || '',
        BEDROCK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
        BEDROCK_GUARDRAIL_ID: props.bedrockGuardrailId || '',
        BEDROCK_GUARDRAIL_VERSION: props.bedrockGuardrailVersion || 'DRAFT',
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Grant Kendra permissions
    if (props.kendraIndexId) {
      agentAssistFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['kendra:Query', 'kendra:Retrieve'],
          resources: [
            `arn:aws:kendra:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:index/${props.kendraIndexId}`,
          ],
        })
      );
    }

    // Grant Bedrock permissions
    agentAssistFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        ],
      })
    );

    // Grant Bedrock Guardrails permissions if configured
    if (props.bedrockGuardrailId) {
      agentAssistFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['bedrock:ApplyGuardrail'],
          resources: [
            `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:guardrail/${props.bedrockGuardrailId}`,
          ],
        })
      );
    }

    // Update post-call processor to invoke summary function
    postCallProcessorFunction.addEnvironment(
      'SUMMARY_FUNCTION_NAME',
      generateSummaryFunction.functionName
    );
    generateSummaryFunction.grantInvoke(postCallProcessorFunction);

    // S3 Event trigger for post-call processing
    this.recordingsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(postCallProcessorFunction),
      { prefix: 'recordings/' }
    );

    // PII Access Handler - for authorized PII retrieval with audit logging
    const accessPIIFunction = new nodejs.NodejsFunction(this, 'AccessPIIFunction', {
      functionName: `${props.serviceName}-access-pii`,
      entry: path.join(__dirname, '../../services/telephony-svc/src/handlers/access-pii.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(10),
      memorySize: 512,
      environment: {
        PII_MAPPING_TABLE_NAME: this.piiMappingTable.tableName,
        PII_ACCESS_LOG_TABLE_NAME: this.piiAccessLogTable.tableName,
        KMS_KEY_ID: props.kmsKey.keyId,
        POWERTOOLS_SERVICE_NAME: props.serviceName,
      },
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    this.piiMappingTable.grantReadData(accessPIIFunction);
    this.piiAccessLogTable.grantWriteData(accessPIIFunction);
    props.kmsKey.grantDecrypt(accessPIIFunction);

    // Amazon Connect Instance
    this.connectInstance = new connect.CfnInstance(this, 'ConnectInstance', {
      identityManagementType: 'CONNECT_MANAGED',
      instanceAlias: `${props.serviceName}-connect`,
      attributes: {
        inboundCalls: true,
        outboundCalls: false,
        contactflowLogs: true,
        contactLens: true,
        autoResolveBestVoices: true,
        earlyMedia: true,
      },
    });

    // Grant Connect permissions to invoke Lambda functions
    driverLookupFunction.grantInvoke(
      new iam.ServicePrincipal('connect.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:connect:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:instance/*`,
          },
        },
      })
    );

    createIncidentFunction.grantInvoke(
      new iam.ServicePrincipal('connect.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:connect:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:instance/*`,
          },
        },
      })
    );

    // Grant Connect permissions to write to S3 recordings bucket
    this.recordingsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal('connect.amazonaws.com')],
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [`${this.recordingsBucket.bucketArn}/recordings/*`],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
        },
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'ConnectInstanceId', {
      value: this.connectInstance.attrId,
      description: 'Amazon Connect Instance ID',
      exportName: `${props.serviceName}-connect-instance-id`,
    });

    new cdk.CfnOutput(this, 'ConnectInstanceArn', {
      value: this.connectInstance.attrArn,
      description: 'Amazon Connect Instance ARN',
      exportName: `${props.serviceName}-connect-instance-arn`,
    });

    new cdk.CfnOutput(this, 'DriverLookupFunctionArn', {
      value: driverLookupFunction.functionArn,
      description: 'Driver Lookup Lambda Function ARN',
      exportName: `${props.serviceName}-driver-lookup-arn`,
    });

    new cdk.CfnOutput(this, 'CreateIncidentFunctionArn', {
      value: createIncidentFunction.functionArn,
      description: 'Create Incident Lambda Function ARN',
      exportName: `${props.serviceName}-create-incident-arn`,
    });

    new cdk.CfnOutput(this, 'RecordingsBucketName', {
      value: this.recordingsBucket.bucketName,
      description: 'Call Recordings S3 Bucket',
      exportName: `${props.serviceName}-recordings-bucket`,
    });

    new cdk.CfnOutput(this, 'AccessPIIFunctionArn', {
      value: accessPIIFunction.functionArn,
      description: 'Access PII Lambda Function ARN',
      exportName: `${props.serviceName}-access-pii-arn`,
    });

    new cdk.CfnOutput(this, 'GenerateSummaryFunctionArn', {
      value: generateSummaryFunction.functionArn,
      description: 'Generate Summary Lambda Function ARN',
      exportName: `${props.serviceName}-generate-summary-arn`,
    });

    new cdk.CfnOutput(this, 'AgentAssistFunctionArn', {
      value: agentAssistFunction.functionArn,
      description: 'Agent Assist Lambda Function ARN',
      exportName: `${props.serviceName}-agent-assist-arn`,
    });

    new cdk.CfnOutput(this, 'SummariesTableName', {
      value: this.summariesTable.tableName,
      description: 'Call Summaries DynamoDB Table',
      exportName: `${props.serviceName}-summaries-table`,
    });
  }
}
