import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dax from 'aws-cdk-lib/aws-dax';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface PerformanceStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  serviceName: string;
  stage: string;
  staticAssetsBucket?: s3.IBucket;
  apiGatewayDomainName?: string;
  appSyncApi?: appsync.IGraphqlApi;
  incidentsTable?: cdk.aws_dynamodb.ITable;
  vendorsTable?: cdk.aws_dynamodb.ITable;
  trackingTable?: cdk.aws_dynamodb.ITable;
}

/**
 * Performance Optimization Stack
 * 
 * Implements caching and performance optimizations:
 * - ElastiCache Redis for vendor profiles and geospatial data
 * - CloudFront CDN for static assets and API caching
 * - DynamoDB DAX for hot data acceleration
 * - Lambda function warming
 * - AppSync caching configuration
 */
export class PerformanceStack extends cdk.Stack {
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly redisSecurityGroup: ec2.SecurityGroup;
  public readonly redisEndpoint: string;
  public readonly cloudFrontDistribution?: cloudfront.Distribution;
  public readonly daxCluster?: dax.CfnCluster;
  public readonly lambdaWarmerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: PerformanceStackProps) {
    super(scope, id, props);

    // ============================================
    // ElastiCache Redis Cluster
    // ============================================
    
    // Security group for Redis
    this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ElastiCache Redis cluster',
      allowAllOutbound: false,
    });

    // Allow inbound Redis traffic from VPC
    this.redisSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(6379),
      'Allow Redis traffic from VPC'
    );

    // Create subnet group for Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
      cacheSubnetGroupName: `${props.serviceName}-redis-subnet-${props.stage}`,
    });

    // Create Redis cluster
    this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: 'cache.t3.medium',
      engine: 'redis',
      numCacheNodes: 1,
      engineVersion: '7.0',
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
      clusterName: `${props.serviceName}-redis-${props.stage}`,
      port: 6379,
      preferredMaintenanceWindow: 'sun:05:00-sun:06:00',
      snapshotRetentionLimit: 5,
      snapshotWindow: '03:00-04:00',
      autoMinorVersionUpgrade: true,
      azMode: 'single-az',
      tags: [
        { key: 'Name', value: `${props.serviceName}-redis-${props.stage}` },
        { key: 'Environment', value: props.stage },
        { key: 'Purpose', value: 'Vendor profile and geospatial caching' },
      ],
    });

    this.redisCluster.addDependency(redisSubnetGroup);

    // Store Redis endpoint
    this.redisEndpoint = this.redisCluster.attrRedisEndpointAddress;

    // Export Redis endpoint
    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      description: 'ElastiCache Redis cluster endpoint',
      exportName: `${props.serviceName}-redis-endpoint-${props.stage}`,
    });

    new cdk.CfnOutput(this, 'RedisPort', {
      value: '6379',
      description: 'ElastiCache Redis cluster port',
      exportName: `${props.serviceName}-redis-port-${props.stage}`,
    });

    // ============================================
    // CloudFront Distribution (if static assets bucket provided)
    // ============================================
    
    if (props.staticAssetsBucket) {
      // Create CloudFront distribution
      this.cloudFrontDistribution = new cloudfront.Distribution(this, 'CDNDistribution', {
        comment: `${props.serviceName} CDN - ${props.stage}`,
        defaultBehavior: {
          origin: new origins.S3Origin(props.staticAssetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
        enableLogging: true,
        minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      });

      // Add API Gateway caching behavior if domain provided
      if (props.apiGatewayDomainName) {
        this.cloudFrontDistribution.addBehavior('/api/*', 
          new origins.HttpOrigin(props.apiGatewayDomainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }), {
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            cachePolicy: new cloudfront.CachePolicy(this, 'APICachePolicy', {
              cachePolicyName: `${props.serviceName}-api-cache-${props.stage}`,
              comment: 'Cache policy for API Gateway',
              defaultTtl: cdk.Duration.seconds(0), // No default caching
              minTtl: cdk.Duration.seconds(0),
              maxTtl: cdk.Duration.seconds(300), // Max 5 minutes
              enableAcceptEncodingGzip: true,
              enableAcceptEncodingBrotli: true,
              headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
                'Authorization',
                'Content-Type'
              ),
              queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            }),
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          }
        );
      }

      new cdk.CfnOutput(this, 'CloudFrontDomainName', {
        value: this.cloudFrontDistribution.distributionDomainName,
        description: 'CloudFront distribution domain name',
        exportName: `${props.serviceName}-cdn-domain-${props.stage}`,
      });

      new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
        value: this.cloudFrontDistribution.distributionId,
        description: 'CloudFront distribution ID',
        exportName: `${props.serviceName}-cdn-id-${props.stage}`,
      });
    }

    // ============================================
    // DynamoDB DAX Cluster (if tables provided)
    // ============================================
    
    if (props.incidentsTable || props.vendorsTable || props.trackingTable) {
      // Create IAM role for DAX
      const daxRole = new iam.Role(this, 'DAXRole', {
        assumedBy: new iam.ServicePrincipal('dax.amazonaws.com'),
        description: 'IAM role for DynamoDB DAX cluster',
      });

      // Grant DAX access to DynamoDB tables
      if (props.incidentsTable) {
        props.incidentsTable.grantReadData(daxRole);
      }
      if (props.vendorsTable) {
        props.vendorsTable.grantReadData(daxRole);
      }
      if (props.trackingTable) {
        props.trackingTable.grantReadData(daxRole);
      }

      // Create security group for DAX
      const daxSecurityGroup = new ec2.SecurityGroup(this, 'DAXSecurityGroup', {
        vpc: props.vpc,
        description: 'Security group for DynamoDB DAX cluster',
        allowAllOutbound: false,
      });

      daxSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
        ec2.Port.tcp(8111),
        'Allow DAX traffic from VPC'
      );

      // Create subnet group for DAX
      const daxSubnetGroup = new dax.CfnSubnetGroup(this, 'DAXSubnetGroup', {
        subnetIds: props.vpc.privateSubnets.map(subnet => subnet.subnetId),
        description: 'Subnet group for DAX cluster',
        subnetGroupName: `${props.serviceName}-dax-subnet-${props.stage}`,
      });

      // Create DAX cluster
      this.daxCluster = new dax.CfnCluster(this, 'DAXCluster', {
        iamRoleArn: daxRole.roleArn,
        nodeType: 'dax.t3.small',
        replicationFactor: 1,
        clusterName: `${props.serviceName}-dax-${props.stage}`,
        description: 'DAX cluster for hot data acceleration',
        subnetGroupName: daxSubnetGroup.subnetGroupName,
        securityGroupIds: [daxSecurityGroup.securityGroupId],
        sseSpecification: {
          sseEnabled: true,
        },
        tags: [
          { key: 'Name', value: `${props.serviceName}-dax-${props.stage}` },
          { key: 'Environment', value: props.stage },
        ],
      });

      this.daxCluster.addDependency(daxSubnetGroup);

      new cdk.CfnOutput(this, 'DAXClusterEndpoint', {
        value: this.daxCluster.attrClusterDiscoveryEndpoint || '',
        description: 'DAX cluster discovery endpoint',
        exportName: `${props.serviceName}-dax-endpoint-${props.stage}`,
      });
    }

    // ============================================
    // AppSync Caching Configuration
    // ============================================
    
    if (props.appSyncApi) {
      // Create AppSync cache
      const appSyncCache = new appsync.CfnApiCache(this, 'AppSyncCache', {
        apiCachingBehavior: 'PER_RESOLVER_CACHING',
        apiId: props.appSyncApi.apiId,
        ttl: 5, // 5 seconds TTL for tracking queries
        type: 'T2_SMALL',
        transitEncryptionEnabled: true,
        atRestEncryptionEnabled: true,
      });

      new cdk.CfnOutput(this, 'AppSyncCacheStatus', {
        value: appSyncCache.attrStatus || 'CREATING',
        description: 'AppSync cache status',
      });
    }

    // ============================================
    // Lambda Function Warming
    // ============================================
    
    // Create Lambda warmer function
    this.lambdaWarmerFunction = new lambda.Function(this, 'LambdaWarmer', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { Lambda } = require('@aws-sdk/client-lambda');
        const lambda = new Lambda({});

        exports.handler = async (event) => {
          const functionNames = process.env.FUNCTION_NAMES?.split(',') || [];
          const concurrency = parseInt(process.env.CONCURRENCY || '3');
          
          console.log(\`Warming \${functionNames.length} functions with concurrency \${concurrency}\`);
          
          const results = await Promise.allSettled(
            functionNames.flatMap(functionName =>
              Array.from({ length: concurrency }, (_, i) =>
                lambda.invoke({
                  FunctionName: functionName,
                  InvocationType: 'RequestResponse',
                  Payload: JSON.stringify({ warmer: true, concurrency: i + 1 }),
                }).catch(err => {
                  console.error(\`Error warming \${functionName}:\`, err);
                  return null;
                })
              )
            )
          );
          
          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;
          
          console.log(\`Warming complete: \${successful} successful, \${failed} failed\`);
          
          return {
            statusCode: 200,
            body: JSON.stringify({
              message: 'Lambda warming complete',
              successful,
              failed,
              total: results.length,
            }),
          };
        };
      `),
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        FUNCTION_NAMES: '', // Will be set by services that want warming
        CONCURRENCY: '3',
      },
      description: 'Warms Lambda functions to reduce cold starts',
    });

    // Grant Lambda warmer permission to invoke other functions
    this.lambdaWarmerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:*`],
    }));

    // Create EventBridge rule to trigger warmer every 5 minutes
    const warmerRule = new events.Rule(this, 'LambdaWarmerRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Triggers Lambda warmer function every 5 minutes',
      enabled: true,
    });

    warmerRule.addTarget(new targets.LambdaFunction(this.lambdaWarmerFunction));

    new cdk.CfnOutput(this, 'LambdaWarmerFunctionName', {
      value: this.lambdaWarmerFunction.functionName,
      description: 'Lambda warmer function name',
      exportName: `${props.serviceName}-lambda-warmer-${props.stage}`,
    });

    // ============================================
    // Stack Outputs
    // ============================================
    
    new cdk.CfnOutput(this, 'RedisSecurityGroupId', {
      value: this.redisSecurityGroup.securityGroupId,
      description: 'Redis security group ID',
      exportName: `${props.serviceName}-redis-sg-${props.stage}`,
    });

    // Add tags to all resources
    cdk.Tags.of(this).add('Stack', 'PerformanceStack');
    cdk.Tags.of(this).add('Environment', props.stage);
    cdk.Tags.of(this).add('Service', props.serviceName);
  }

  /**
   * Add Lambda function to warming schedule
   */
  public addFunctionToWarmer(functionName: string): void {
    const currentFunctions = this.lambdaWarmerFunction.environment?.FUNCTION_NAMES || '';
    const functions = currentFunctions ? currentFunctions.split(',') : [];
    
    if (!functions.includes(functionName)) {
      functions.push(functionName);
      this.lambdaWarmerFunction.addEnvironment(
        'FUNCTION_NAMES',
        functions.join(',')
      );
    }
  }
}
