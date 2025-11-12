import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as backup from 'aws-cdk-lib/aws-backup';
import { Construct } from 'constructs';

export interface DisasterRecoveryStackProps extends cdk.StackProps {
  stage: string;
  primaryRegion: string;
  drRegion: string;
  domainName?: string;
  hostedZoneId?: string;
  alarmTopic: sns.ITopic;
  
  // Primary region resources
  usersTable?: dynamodb.ITable;
  incidentsTable?: dynamodb.ITable;
  vendorsTable?: dynamodb.ITable;
  offersTable?: dynamodb.ITable;
  trackingSessionsTable?: dynamodb.ITable;
  callRecordsTable?: dynamodb.ITable;
  kbDocumentsTable?: dynamodb.ITable;
  notificationLogTable?: dynamodb.ITable;
  
  auroraCluster?: rds.IDatabaseCluster;
  
  callRecordingsBucket?: s3.IBucket;
  kbDocumentsBucket?: s3.IBucket;
  incidentMediaBucket?: s3.IBucket;
}

export class DisasterRecoveryStack extends cdk.Stack {
  public readonly healthCheckAlarm: cloudwatch.Alarm;
  public readonly backupVault: backup.BackupVault;
  public readonly backupPlan: backup.BackupPlan;

  constructor(scope: Construct, id: string, props: DisasterRecoveryStackProps) {
    super(scope, id, props);

    const { stage, primaryRegion, drRegion, alarmTopic } = props;

    // ========================================================================
    // DynamoDB Global Tables Configuration
    // ========================================================================

    // Note: Global Tables must be configured on existing tables
    // This is done via CDK custom resources or manually
    // Here we document the configuration and create monitoring

    const globalTableNames = [
      props.usersTable?.tableName,
      props.incidentsTable?.tableName,
      props.vendorsTable?.tableName,
      props.trackingSessionsTable?.tableName,
      props.callRecordsTable?.tableName,
    ].filter(Boolean);

    // Create Lambda function to configure Global Tables
    const configureGlobalTablesFunction = new lambda.Function(
      this,
      'ConfigureGlobalTablesFunction',
      {
        functionName: `roadcall-configure-global-tables-${stage}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
const { DynamoDBClient, UpdateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

exports.handler = async (event) => {
  const client = new DynamoDBClient({ region: process.env.PRIMARY_REGION });
  const tableName = event.tableName;
  const drRegion = process.env.DR_REGION;
  
  try {
    // Check if table already has global replication
    const describeResponse = await client.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    
    const existingReplicas = describeResponse.Table?.Replicas || [];
    const hasReplication = existingReplicas.some(r => r.RegionName === drRegion);
    
    if (hasReplication) {
      console.log(\`Table \${tableName} already has replication to \${drRegion}\`);
      return { status: 'already_configured', tableName };
    }
    
    // Enable global table replication
    await client.send(
      new UpdateTableCommand({
        TableName: tableName,
        ReplicaUpdates: [
          {
            Create: {
              RegionName: drRegion,
            },
          },
        ],
      })
    );
    
    console.log(\`Enabled global table replication for \${tableName} to \${drRegion}\`);
    return { status: 'configured', tableName, drRegion };
  } catch (error) {
    console.error(\`Error configuring global table for \${tableName}:\`, error);
    throw error;
  }
};
        `),
        environment: {
          PRIMARY_REGION: primaryRegion,
          DR_REGION: drRegion,
        },
        timeout: cdk.Duration.minutes(5),
      }
    );

    // Grant permissions to configure DynamoDB Global Tables
    configureGlobalTablesFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'dynamodb:UpdateTable',
          'dynamodb:DescribeTable',
          'dynamodb:CreateTableReplica',
        ],
        resources: ['*'], // Scoped to tables in the account
      })
    );

    // ========================================================================
    // S3 Cross-Region Replication
    // ========================================================================

    if (props.callRecordingsBucket && stage === 'prod') {
      // Create replication bucket in DR region
      const callRecordingsReplicaBucket = new s3.Bucket(
        this,
        'CallRecordingsReplicaBucket',
        {
          bucketName: `roadcall-call-recordings-${stage}-${drRegion}-${this.account}`,
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          versioned: true,
          lifecycleRules: [
            {
              id: 'DeleteAfter90Days',
              enabled: true,
              expiration: cdk.Duration.days(90),
            },
          ],
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        }
      );

      // Note: S3 replication must be configured on the source bucket
      // This requires the source bucket to have versioning enabled
      // and a replication role with appropriate permissions
    }

    if (props.kbDocumentsBucket && stage === 'prod') {
      const kbDocumentsReplicaBucket = new s3.Bucket(
        this,
        'KBDocumentsReplicaBucket',
        {
          bucketName: `roadcall-kb-documents-${stage}-${drRegion}-${this.account}`,
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          versioned: true,
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        }
      );
    }

    if (props.incidentMediaBucket && stage === 'prod') {
      const incidentMediaReplicaBucket = new s3.Bucket(
        this,
        'IncidentMediaReplicaBucket',
        {
          bucketName: `roadcall-incident-media-${stage}-${drRegion}-${this.account}`,
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          versioned: true,
          lifecycleRules: [
            {
              id: 'DeleteAfter90Days',
              enabled: true,
              expiration: cdk.Duration.days(90),
            },
          ],
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        }
      );
    }

    // ========================================================================
    // Aurora Cross-Region Read Replica
    // ========================================================================

    // Note: Aurora cross-region read replicas must be created manually
    // or via custom resources due to CDK limitations
    // This section documents the configuration

    if (props.auroraCluster && stage === 'prod') {
      // Create Lambda function to set up Aurora read replica
      const configureAuroraReplicaFunction = new lambda.Function(
        this,
        'ConfigureAuroraReplicaFunction',
        {
          functionName: `roadcall-configure-aurora-replica-${stage}`,
          runtime: lambda.Runtime.NODEJS_18_X,
          handler: 'index.handler',
          code: lambda.Code.fromInline(`
const { RDSClient, CreateDBClusterCommand, DescribeDBClustersCommand } = require('@aws-sdk/client-rds');

exports.handler = async (event) => {
  const primaryClusterArn = process.env.PRIMARY_CLUSTER_ARN;
  const drRegion = process.env.DR_REGION;
  const replicaIdentifier = process.env.REPLICA_IDENTIFIER;
  
  const client = new RDSClient({ region: drRegion });
  
  try {
    // Check if replica already exists
    try {
      const describeResponse = await client.send(
        new DescribeDBClustersCommand({ DBClusterIdentifier: replicaIdentifier })
      );
      console.log(\`Replica \${replicaIdentifier} already exists\`);
      return { status: 'already_exists', replicaIdentifier };
    } catch (error) {
      if (error.name !== 'DBClusterNotFoundFault') {
        throw error;
      }
    }
    
    // Create read replica
    await client.send(
      new CreateDBClusterCommand({
        DBClusterIdentifier: replicaIdentifier,
        Engine: 'aurora-postgresql',
        ReplicationSourceIdentifier: primaryClusterArn,
        StorageEncrypted: true,
      })
    );
    
    console.log(\`Created Aurora read replica \${replicaIdentifier} in \${drRegion}\`);
    return { status: 'created', replicaIdentifier, drRegion };
  } catch (error) {
    console.error('Error creating Aurora read replica:', error);
    throw error;
  }
};
          `),
          environment: {
            PRIMARY_CLUSTER_ARN: props.auroraCluster.clusterArn,
            DR_REGION: drRegion,
            REPLICA_IDENTIFIER: `roadcall-aurora-${stage}-replica`,
          },
          timeout: cdk.Duration.minutes(10),
        }
      );

      configureAuroraReplicaFunction.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'rds:CreateDBCluster',
            'rds:DescribeDBClusters',
            'rds:AddTagsToResource',
          ],
          resources: ['*'],
        })
      );
    }

    // ========================================================================
    // Route 53 Health Checks and Failover
    // ========================================================================

    if (props.domainName && props.hostedZoneId && stage === 'prod') {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        'HostedZone',
        {
          hostedZoneId: props.hostedZoneId,
          zoneName: props.domainName,
        }
      );

      // Create health check for primary region API
      const primaryHealthCheck = new route53.CfnHealthCheck(
        this,
        'PrimaryHealthCheck',
        {
          healthCheckConfig: {
            type: 'HTTPS',
            resourcePath: '/health',
            fullyQualifiedDomainName: `api-${primaryRegion}.${props.domainName}`,
            port: 443,
            requestInterval: 30,
            failureThreshold: 3,
            measureLatency: true,
          },
          healthCheckTags: [
            {
              key: 'Name',
              value: `roadcall-${stage}-primary-health-check`,
            },
          ],
        }
      );

      // Create CloudWatch alarm for health check
      this.healthCheckAlarm = new cloudwatch.Alarm(this, 'HealthCheckAlarm', {
        alarmName: `roadcall-${stage}-primary-region-unhealthy`,
        alarmDescription: `Primary region (${primaryRegion}) health check failed`,
        metric: new cloudwatch.Metric({
          namespace: 'AWS/Route53',
          metricName: 'HealthCheckStatus',
          dimensionsMap: {
            HealthCheckId: primaryHealthCheck.attrHealthCheckId,
          },
          statistic: 'Minimum',
          period: cdk.Duration.minutes(1),
        }),
        threshold: 1,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.BREACHING,
      });

      this.healthCheckAlarm.addAlarmAction(
        new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic)
      );

      // Create failover routing policy
      // Note: This requires API Gateway endpoints in both regions
      // The actual DNS records would be created in the API Gateway stack
    }

    // ========================================================================
    // AWS Backup Configuration
    // ========================================================================

    // Create backup vault
    this.backupVault = new backup.BackupVault(this, 'BackupVault', {
      backupVaultName: `roadcall-backup-vault-${stage}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Create backup plan
    this.backupPlan = new backup.BackupPlan(this, 'BackupPlan', {
      backupPlanName: `roadcall-backup-plan-${stage}`,
      backupPlanRules: [
        // Daily backups with 35-day retention
        new backup.BackupPlanRule({
          ruleName: 'DailyBackup',
          scheduleExpression: events.Schedule.cron({
            hour: '2',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(35),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(2),
        }),
        // Weekly backups with 90-day retention
        new backup.BackupPlanRule({
          ruleName: 'WeeklyBackup',
          scheduleExpression: events.Schedule.cron({
            weekDay: 'SUN',
            hour: '3',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(90),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(3),
        }),
        // Monthly backups with 1-year retention
        new backup.BackupPlanRule({
          ruleName: 'MonthlyBackup',
          scheduleExpression: events.Schedule.cron({
            day: '1',
            hour: '4',
            minute: '0',
          }),
          deleteAfter: cdk.Duration.days(365),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(4),
          copyActions: stage === 'prod' ? [
            {
              destinationBackupVault: backup.BackupVault.fromBackupVaultName(
                this,
                'DrBackupVault',
                `roadcall-backup-vault-${stage}-${drRegion}`
              ),
            },
          ] : undefined,
        }),
      ],
    });

    // Add Aurora cluster to backup plan
    if (props.auroraCluster) {
      this.backupPlan.addSelection('AuroraBackup', {
        resources: [
          backup.BackupResource.fromRdsDatabaseCluster(props.auroraCluster),
        ],
      });
    }

    // ========================================================================
    // Backup Verification Lambda
    // ========================================================================

    const backupVerificationFunction = new lambda.Function(
      this,
      'BackupVerificationFunction',
      {
        functionName: `roadcall-backup-verification-${stage}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
const { BackupClient, ListRecoveryPointsByBackupVaultCommand } = require('@aws-sdk/client-backup');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

exports.handler = async (event) => {
  const backupClient = new BackupClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });
  
  const vaultName = process.env.BACKUP_VAULT_NAME;
  const topicArn = process.env.ALARM_TOPIC_ARN;
  
  try {
    // List recent recovery points
    const response = await backupClient.send(
      new ListRecoveryPointsByBackupVaultCommand({
        BackupVaultName: vaultName,
        ByCreatedAfter: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      })
    );
    
    const recoveryPoints = response.RecoveryPoints || [];
    const completedBackups = recoveryPoints.filter(
      rp => rp.Status === 'COMPLETED'
    );
    
    console.log(\`Found \${completedBackups.length} completed backups in last 24 hours\`);
    
    // Check if we have recent backups
    if (completedBackups.length === 0) {
      const message = \`WARNING: No completed backups found in vault \${vaultName} in the last 24 hours\`;
      console.error(message);
      
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: 'Backup Verification Failed',
          Message: message,
        })
      );
      
      return { status: 'failed', message };
    }
    
    // Verify backup integrity
    const failedBackups = recoveryPoints.filter(
      rp => rp.Status === 'FAILED' || rp.Status === 'EXPIRED'
    );
    
    if (failedBackups.length > 0) {
      const message = \`WARNING: Found \${failedBackups.length} failed/expired backups in vault \${vaultName}\`;
      console.warn(message);
      
      await snsClient.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: 'Backup Verification Warning',
          Message: message,
        })
      );
    }
    
    return {
      status: 'success',
      completedBackups: completedBackups.length,
      failedBackups: failedBackups.length,
    };
  } catch (error) {
    console.error('Error verifying backups:', error);
    
    await snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: 'Backup Verification Error',
        Message: \`Error verifying backups: \${error.message}\`,
      })
    );
    
    throw error;
  }
};
        `),
        environment: {
          BACKUP_VAULT_NAME: this.backupVault.backupVaultName,
          ALARM_TOPIC_ARN: alarmTopic.topicArn,
        },
        timeout: cdk.Duration.minutes(5),
      }
    );

    // Grant permissions
    backupVerificationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'backup:ListRecoveryPointsByBackupVault',
          'backup:DescribeRecoveryPoint',
        ],
        resources: ['*'],
      })
    );

    alarmTopic.grantPublish(backupVerificationFunction);

    // Schedule backup verification daily
    const backupVerificationRule = new events.Rule(
      this,
      'BackupVerificationRule',
      {
        ruleName: `roadcall-backup-verification-${stage}`,
        schedule: events.Schedule.cron({
          hour: '6',
          minute: '0',
        }),
      }
    );

    backupVerificationRule.addTarget(
      new targets.LambdaFunction(backupVerificationFunction)
    );

    // ========================================================================
    // Restore Testing Lambda
    // ========================================================================

    const restoreTestingFunction = new lambda.Function(
      this,
      'RestoreTestingFunction',
      {
        functionName: `roadcall-restore-testing-${stage}`,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromInline(`
const { BackupClient, StartRestoreJobCommand, DescribeRestoreJobCommand } = require('@aws-sdk/client-backup');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

exports.handler = async (event) => {
  const backupClient = new BackupClient({ region: process.env.AWS_REGION });
  const snsClient = new SNSClient({ region: process.env.AWS_REGION });
  
  const topicArn = process.env.ALARM_TOPIC_ARN;
  
  try {
    // This is a placeholder for restore testing logic
    // In production, this would:
    // 1. Select a recent recovery point
    // 2. Restore to a test environment
    // 3. Verify the restored data
    // 4. Clean up test resources
    
    console.log('Restore testing would be performed here');
    console.log('This requires careful implementation to avoid costs and data issues');
    
    return {
      status: 'skipped',
      message: 'Restore testing requires manual configuration',
    };
  } catch (error) {
    console.error('Error in restore testing:', error);
    
    await snsClient.send(
      new PublishCommand({
        TopicArn: topicArn,
        Subject: 'Restore Testing Error',
        Message: \`Error in restore testing: \${error.message}\`,
      })
    );
    
    throw error;
  }
};
        `),
        environment: {
          ALARM_TOPIC_ARN: alarmTopic.topicArn,
        },
        timeout: cdk.Duration.minutes(15),
      }
    );

    alarmTopic.grantPublish(restoreTestingFunction);

    // Schedule restore testing monthly
    const restoreTestingRule = new events.Rule(this, 'RestoreTestingRule', {
      ruleName: `roadcall-restore-testing-${stage}`,
      schedule: events.Schedule.cron({
        day: '15',
        hour: '10',
        minute: '0',
      }),
    });

    restoreTestingRule.addTarget(
      new targets.LambdaFunction(restoreTestingFunction)
    );

    // ========================================================================
    // Failover Monitoring
    // ========================================================================

    // Create custom metric for failover events
    const failoverMetric = new cloudwatch.Metric({
      namespace: `roadcall/${stage}`,
      metricName: 'FailoverEvents',
      statistic: 'Sum',
      period: cdk.Duration.minutes(5),
    });

    // Create alarm for failover events
    const failoverAlarm = new cloudwatch.Alarm(this, 'FailoverAlarm', {
      alarmName: `roadcall-${stage}-failover-detected`,
      alarmDescription: 'Failover event detected',
      metric: failoverMetric,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    failoverAlarm.addAlarmAction(
      new cdk.aws_cloudwatch_actions.SnsAction(alarmTopic)
    );

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'BackupVaultName', {
      value: this.backupVault.backupVaultName,
      description: 'Backup vault name',
      exportName: `${stage}-BackupVaultName`,
    });

    new cdk.CfnOutput(this, 'BackupPlanId', {
      value: this.backupPlan.backupPlanId,
      description: 'Backup plan ID',
      exportName: `${stage}-BackupPlanId`,
    });

    if (this.healthCheckAlarm) {
      new cdk.CfnOutput(this, 'HealthCheckAlarmName', {
        value: this.healthCheckAlarm.alarmName,
        description: 'Health check alarm name',
        exportName: `${stage}-HealthCheckAlarmName`,
      });
    }

    new cdk.CfnOutput(this, 'DisasterRecoveryRegion', {
      value: drRegion,
      description: 'Disaster recovery region',
      exportName: `${stage}-DRRegion`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'DisasterRecovery');
    cdk.Tags.of(this).add('Purpose', 'HighAvailability');
  }
}
