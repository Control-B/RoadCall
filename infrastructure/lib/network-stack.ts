import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  stage: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly kmsKey: kms.Key;
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly auroraSecurityGroup: ec2.SecurityGroup;
  public readonly elasticacheSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // Create KMS key for encryption
    this.kmsKey = new kms.Key(this, 'RoadcallKmsKey', {
      description: `AI Roadcall Assistant encryption key - ${stage}`,
      enableKeyRotation: true,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      alias: `roadcall-${stage}`,
    });

    // Create VPC with 3-tier architecture across 2 AZs
    this.vpc = new ec2.Vpc(this, 'RoadcallVpc', {
      vpcName: `roadcall-vpc-${stage}`,
      maxAzs: 2,
      natGateways: 2, // One per AZ for high availability
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Data',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
      gatewayEndpoints: {
        S3: {
          service: ec2.GatewayVpcEndpointAwsService.S3,
        },
        DynamoDB: {
          service: ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        },
      },
    });

    // Add VPC endpoints for AWS services
    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('KmsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.KMS,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('SqsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    this.vpc.addInterfaceEndpoint('SnsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SNS,
      privateDnsEnabled: true,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Create security group for Lambda functions
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      securityGroupName: `roadcall-lambda-sg-${stage}`,
      allowAllOutbound: true,
    });

    // Create security group for Aurora database
    this.auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Aurora Postgres cluster',
      securityGroupName: `roadcall-aurora-sg-${stage}`,
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to Aurora on port 5432
    this.auroraSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda functions to connect to Aurora'
    );

    // Create security group for ElastiCache Redis
    this.elasticacheSecurityGroup = new ec2.SecurityGroup(this, 'ElastiCacheSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for ElastiCache Redis cluster',
      securityGroupName: `roadcall-elasticache-sg-${stage}`,
      allowAllOutbound: false,
    });

    // Allow Lambda to connect to Redis on port 6379
    this.elasticacheSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Lambda functions to connect to Redis'
    );

    // Output VPC ID
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${stage}-VpcId`,
    });

    // Output KMS Key ARN
    new cdk.CfnOutput(this, 'KmsKeyArn', {
      value: this.kmsKey.keyArn,
      description: 'KMS Key ARN',
      exportName: `${stage}-KmsKeyArn`,
    });

    // Output security group IDs
    new cdk.CfnOutput(this, 'LambdaSecurityGroupId', {
      value: this.lambdaSecurityGroup.securityGroupId,
      description: 'Lambda Security Group ID',
      exportName: `${stage}-LambdaSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'AuroraSecurityGroupId', {
      value: this.auroraSecurityGroup.securityGroupId,
      description: 'Aurora Security Group ID',
      exportName: `${stage}-AuroraSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'ElastiCacheSecurityGroupId', {
      value: this.elasticacheSecurityGroup.securityGroupId,
      description: 'ElastiCache Security Group ID',
      exportName: `${stage}-ElastiCacheSecurityGroupId`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Network');
  }
}
