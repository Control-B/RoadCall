import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  stage: string;
  vpc: ec2.IVpc;
  kmsKey: kms.IKey;
  auroraSecurityGroup: ec2.ISecurityGroup;
  elasticacheSecurityGroup: ec2.ISecurityGroup;
}

export class DataStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly incidentsTable: dynamodb.Table;
  public readonly vendorsTable: dynamodb.Table;
  public readonly offersTable: dynamodb.Table;
  public readonly trackingSessionsTable: dynamodb.Table;
  public readonly callRecordsTable: dynamodb.Table;
  public readonly kbDocumentsTable: dynamodb.Table;
  public readonly notificationLogTable: dynamodb.Table;
  public readonly auroraCluster: rds.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly callRecordingsBucket: s3.Bucket;
  public readonly kbDocumentsBucket: s3.Bucket;
  public readonly incidentMediaBucket: s3.Bucket;
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const { stage, vpc, kmsKey, auroraSecurityGroup, elasticacheSecurityGroup } = props;

    // ========================================================================
    // EventBridge Event Bus
    // ========================================================================

    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `roadcall-events-${stage}`,
    });

    // ========================================================================
    // DynamoDB Tables
    // ========================================================================

    // Users Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `roadcall-users-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for phone lookup (ANI)
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'phone-index',
      partitionKey: { name: 'phone', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for company queries
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'company-index',
      partitionKey: { name: 'companyId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Incidents Table
    this.incidentsTable = new dynamodb.Table(this, 'IncidentsTable', {
      tableName: `roadcall-incidents-${stage}`,
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for driver's active incidents
    this.incidentsTable.addGlobalSecondaryIndex({
      indexName: 'driver-status-index',
      partitionKey: { name: 'driverId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for vendor's active incidents
    this.incidentsTable.addGlobalSecondaryIndex({
      indexName: 'vendor-status-index',
      partitionKey: { name: 'assignedVendorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for global incident queue
    this.incidentsTable.addGlobalSecondaryIndex({
      indexName: 'status-created-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Vendors Table
    this.vendorsTable = new dynamodb.Table(this, 'VendorsTable', {
      tableName: `roadcall-vendors-${stage}`,
      partitionKey: { name: 'vendorId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for geospatial queries
    this.vendorsTable.addGlobalSecondaryIndex({
      indexName: 'geohash-availability-index',
      partitionKey: { name: 'geohash', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'availabilityStatus', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for top-rated vendors
    this.vendorsTable.addGlobalSecondaryIndex({
      indexName: 'rating-index',
      partitionKey: { name: 'availabilityStatus', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'avgRating', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Offers Table
    this.offersTable = new dynamodb.Table(this, 'OffersTable', {
      tableName: `roadcall-offers-${stage}`,
      partitionKey: { name: 'offerId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for incident's offers
    this.offersTable.addGlobalSecondaryIndex({
      indexName: 'incident-status-index',
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for vendor's pending offers
    this.offersTable.addGlobalSecondaryIndex({
      indexName: 'vendor-status-index',
      partitionKey: { name: 'vendorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Tracking Sessions Table
    this.trackingSessionsTable = new dynamodb.Table(this, 'TrackingSessionsTable', {
      tableName: `roadcall-tracking-sessions-${stage}`,
      partitionKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for incident's tracking session
    this.trackingSessionsTable.addGlobalSecondaryIndex({
      indexName: 'incident-index',
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for vendor's active sessions
    this.trackingSessionsTable.addGlobalSecondaryIndex({
      indexName: 'vendor-status-index',
      partitionKey: { name: 'vendorId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Call Records Table
    this.callRecordsTable = new dynamodb.Table(this, 'CallRecordsTable', {
      tableName: `roadcall-call-records-${stage}`,
      partitionKey: { name: 'callId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      pointInTimeRecovery: stage === 'prod',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for incident's calls
    this.callRecordsTable.addGlobalSecondaryIndex({
      indexName: 'incident-index',
      partitionKey: { name: 'incidentId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for driver's call history
    this.callRecordsTable.addGlobalSecondaryIndex({
      indexName: 'driver-time-index',
      partitionKey: { name: 'driverId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startTime', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Knowledge Base Documents Table
    this.kbDocumentsTable = new dynamodb.Table(this, 'KBDocumentsTable', {
      tableName: `roadcall-kb-documents-${stage}`,
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for documents by category
    this.kbDocumentsTable.addGlobalSecondaryIndex({
      indexName: 'category-uploaded-index',
      partitionKey: { name: 'category', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'uploadedAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Notification Log Table
    this.notificationLogTable = new dynamodb.Table(this, 'NotificationLogTable', {
      tableName: `roadcall-notification-log-${stage}`,
      partitionKey: { name: 'notificationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: kmsKey,
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user's notification history
    this.notificationLogTable.addGlobalSecondaryIndex({
      indexName: 'recipient-time-index',
      partitionKey: { name: 'recipientId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================================================
    // Aurora Postgres Cluster
    // ========================================================================

    this.auroraCluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      clusterIdentifier: `roadcall-aurora-${stage}`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('postgres', {
        secretName: `roadcall/aurora/${stage}/credentials`,
      }),
      writer: rds.ClusterInstance.serverlessV2('writer', {
        autoMinorVersionUpgrade: true,
      }),
      readers: stage === 'prod' ? [
        // Multi-AZ readers for high availability in production
        rds.ClusterInstance.serverlessV2('reader1', {
          scaleWithWriter: true,
          autoMinorVersionUpgrade: true,
        }),
        rds.ClusterInstance.serverlessV2('reader2', {
          scaleWithWriter: true,
          autoMinorVersionUpgrade: true,
        }),
      ] : [
        rds.ClusterInstance.serverlessV2('reader', {
          scaleWithWriter: true,
          autoMinorVersionUpgrade: true,
        }),
      ],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: stage === 'prod' ? 16 : 4,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [auroraSecurityGroup],
      storageEncrypted: true,
      storageEncryptionKey: kmsKey,
      backup: {
        retention: stage === 'prod' ? cdk.Duration.days(35) : cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.SNAPSHOT : cdk.RemovalPolicy.DESTROY,
      defaultDatabaseName: 'roadcall',
      // Enable deletion protection for production
      deletionProtection: stage === 'prod',
      // Enable CloudWatch logs export
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: stage === 'prod' ? 90 : 7,
    });

    // ========================================================================
    // ElastiCache Redis Cluster
    // ========================================================================

    // Create subnet group for ElastiCache
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for ElastiCache Redis',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
      cacheSubnetGroupName: `roadcall-redis-subnet-${stage}`,
    });

    this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: stage === 'prod' ? 'cache.r7g.large' : 'cache.t4g.micro',
      engine: 'redis',
      numCacheNodes: 1,
      clusterName: `roadcall-redis-${stage}`,
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [elasticacheSecurityGroup.securityGroupId],
      engineVersion: '7.0',
      port: 6379,
      transitEncryptionEnabled: true,
      snapshotRetentionLimit: stage === 'prod' ? 7 : 1,
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
    });

    this.redisCluster.addDependency(redisSubnetGroup);

    // ========================================================================
    // S3 Buckets
    // ========================================================================

    // Call Recordings Bucket
    this.callRecordingsBucket = new s3.Bucket(this, 'CallRecordingsBucket', {
      bucketName: `roadcall-call-recordings-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: stage === 'prod',
      lifecycleRules: [
        {
          id: 'DeleteAfter90Days',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
        {
          id: 'TransitionToGlacier',
          enabled: stage === 'prod',
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // Knowledge Base Documents Bucket
    this.kbDocumentsBucket = new s3.Bucket(this, 'KBDocumentsBucket', {
      bucketName: `roadcall-kb-documents-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // Incident Media Bucket
    this.incidentMediaBucket = new s3.Bucket(this, 'IncidentMediaBucket', {
      bucketName: `roadcall-incident-media-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsKey,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: stage === 'prod',
      lifecycleRules: [
        {
          id: 'DeleteAfter90Days',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Will be restricted to specific domains in production
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      exportName: `${stage}-UsersTableName`,
    });

    new cdk.CfnOutput(this, 'IncidentsTableName', {
      value: this.incidentsTable.tableName,
      exportName: `${stage}-IncidentsTableName`,
    });

    new cdk.CfnOutput(this, 'VendorsTableName', {
      value: this.vendorsTable.tableName,
      exportName: `${stage}-VendorsTableName`,
    });

    new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
      value: this.auroraCluster.clusterEndpoint.hostname,
      exportName: `${stage}-AuroraClusterEndpoint`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisCluster.attrRedisEndpointAddress,
      exportName: `${stage}-RedisEndpoint`,
    });

    new cdk.CfnOutput(this, 'CallRecordingsBucketName', {
      value: this.callRecordingsBucket.bucketName,
      exportName: `${stage}-CallRecordingsBucketName`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Data');
  }
}
