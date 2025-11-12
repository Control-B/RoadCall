import * as cdk from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface WafStackProps extends cdk.StackProps {
  stage: string;
  scope: 'REGIONAL' | 'CLOUDFRONT';
}

export class WafStack extends cdk.Stack {
  public readonly webAcl: wafv2.CfnWebACL;
  public readonly loggingBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);

    const { stage, scope: wafScope } = props;

    // ========================================================================
    // S3 Bucket for WAF Logs
    // ========================================================================

    this.loggingBucket = new s3.Bucket(this, 'WafLoggingBucket', {
      bucketName: `roadcall-waf-logs-${stage}-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
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
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // Grant WAF service permission to write logs
    this.loggingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSLogDeliveryWrite',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['s3:PutObject'],
        resources: [`${this.loggingBucket.bucketArn}/*`],
        conditions: {
          StringEquals: {
            's3:x-amz-acl': 'bucket-owner-full-control',
          },
        },
      })
    );

    this.loggingBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'AWSLogDeliveryAclCheck',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal('delivery.logs.amazonaws.com')],
        actions: ['s3:GetBucketAcl'],
        resources: [this.loggingBucket.bucketArn],
      })
    );

    // ========================================================================
    // WAF Web ACL with Security Rules
    // ========================================================================

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `roadcall-waf-${stage}`,
      scope: wafScope,
      defaultAction: { allow: {} },
      description: `WAF rules for AI Roadcall Assistant - ${stage} environment`,
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `roadcall-waf-${stage}`,
      },
      rules: this.createWafRules(stage),
      customResponseBodies: {
        'rate-limit-exceeded': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: {
              type: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests from your IP address. Please try again later.',
              code: 'RATE_LIMIT_EXCEEDED',
            },
          }),
        },
        'geo-blocked': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: {
              type: 'FORBIDDEN',
              message: 'Access denied from your location.',
              code: 'GEO_BLOCKED',
            },
          }),
        },
        'sql-injection-detected': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: {
              type: 'FORBIDDEN',
              message: 'Request blocked due to security policy.',
              code: 'SQL_INJECTION_DETECTED',
            },
          }),
        },
        'xss-detected': {
          contentType: 'APPLICATION_JSON',
          content: JSON.stringify({
            error: {
              type: 'FORBIDDEN',
              message: 'Request blocked due to security policy.',
              code: 'XSS_DETECTED',
            },
          }),
        },
      },
    });

    // ========================================================================
    // CloudWatch Log Group for WAF Logs
    // ========================================================================

    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
      logGroupName: `/aws/wafv2/roadcall-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ========================================================================
    // WAF Logging Configuration
    // ========================================================================

    new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfig', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [
        wafLogGroup.logGroupArn,
        `arn:aws:s3:::${this.loggingBucket.bucketName}`,
      ],
      loggingFilter: {
        defaultBehavior: 'KEEP',
        filters: [
          {
            behavior: 'KEEP',
            conditions: [
              {
                actionCondition: {
                  action: 'BLOCK',
                },
              },
            ],
            requirement: 'MEETS_ANY',
          },
          {
            behavior: 'KEEP',
            conditions: [
              {
                actionCondition: {
                  action: 'COUNT',
                },
              },
            ],
            requirement: 'MEETS_ANY',
          },
        ],
      },
      redactedFields: [
        {
          singleHeader: {
            name: 'authorization',
          },
        },
        {
          singleHeader: {
            name: 'cookie',
          },
        },
      ],
    });

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'WebAclArn', {
      value: this.webAcl.attrArn,
      description: 'WAF Web ACL ARN',
      exportName: `${stage}-WafWebAclArn`,
    });

    new cdk.CfnOutput(this, 'WebAclId', {
      value: this.webAcl.attrId,
      description: 'WAF Web ACL ID',
      exportName: `${stage}-WafWebAclId`,
    });

    new cdk.CfnOutput(this, 'WafLoggingBucketName', {
      value: this.loggingBucket.bucketName,
      description: 'S3 bucket for WAF logs',
      exportName: `${stage}-WafLoggingBucketName`,
    });

    new cdk.CfnOutput(this, 'WafLogGroupName', {
      value: wafLogGroup.logGroupName,
      description: 'CloudWatch Log Group for WAF logs',
      exportName: `${stage}-WafLogGroupName`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'WAF');
    cdk.Tags.of(this).add('SecurityLayer', 'WAF');
  }

  /**
   * Create comprehensive WAF rules
   */
  private createWafRules(stage: string): wafv2.CfnWebACL.RuleProperty[] {
    const rules: wafv2.CfnWebACL.RuleProperty[] = [];

    // ========================================================================
    // Rule 1: Rate Limiting (2000 requests per 5 minutes per IP)
    // ========================================================================
    rules.push({
      name: 'RateLimitRule',
      priority: 1,
      statement: {
        rateBasedStatement: {
          limit: 2000,
          aggregateKeyType: 'IP',
        },
      },
      action: {
        block: {
          customResponse: {
            responseCode: 429,
            customResponseBodyKey: 'rate-limit-exceeded',
          },
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RateLimitRule',
      },
    });

    // ========================================================================
    // Rule 2: AWS Managed Rules - Core Rule Set (XSS, SQL Injection, etc.)
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesCommonRuleSet',
      priority: 2,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesCommonRuleSet',
      },
    });

    // ========================================================================
    // Rule 3: AWS Managed Rules - Known Bad Inputs
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesKnownBadInputsRuleSet',
      priority: 3,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesKnownBadInputsRuleSet',
      },
    });

    // ========================================================================
    // Rule 4: AWS Managed Rules - SQL Injection Protection
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesSQLiRuleSet',
      priority: 4,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesSQLiRuleSet',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesSQLiRuleSet',
      },
    });

    // ========================================================================
    // Rule 5: AWS Managed Rules - Linux Operating System Protection
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesLinuxRuleSet',
      priority: 5,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesLinuxRuleSet',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesLinuxRuleSet',
      },
    });

    // ========================================================================
    // Rule 6: AWS Managed Rules - Amazon IP Reputation List
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesAmazonIpReputationList',
      priority: 6,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesAmazonIpReputationList',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesAmazonIpReputationList',
      },
    });

    // ========================================================================
    // Rule 7: AWS Managed Rules - Anonymous IP List
    // ========================================================================
    rules.push({
      name: 'AWSManagedRulesAnonymousIpList',
      priority: 7,
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesAnonymousIpList',
          excludedRules: [],
        },
      },
      overrideAction: { none: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWSManagedRulesAnonymousIpList',
      },
    });

    // ========================================================================
    // Rule 8: Geo-Blocking for High-Risk Countries
    // ========================================================================
    // Block traffic from high-risk countries (customize based on requirements)
    // This example blocks countries commonly associated with high fraud rates
    const blockedCountries = this.getBlockedCountries(stage);

    if (blockedCountries.length > 0) {
      rules.push({
        name: 'GeoBlockingRule',
        priority: 8,
        statement: {
          geoMatchStatement: {
            countryCodes: blockedCountries,
          },
        },
        action: {
          block: {
            customResponse: {
              responseCode: 403,
              customResponseBodyKey: 'geo-blocked',
            },
          },
        },
        visibilityConfig: {
          sampledRequestsEnabled: true,
          cloudWatchMetricsEnabled: true,
          metricName: 'GeoBlockingRule',
        },
      });
    }

    return rules;
  }

  /**
   * Get list of blocked countries based on stage
   * In production, this should be configurable via parameters or SSM
   */
  private getBlockedCountries(stage: string): string[] {
    // For development/staging, don't block any countries
    if (stage !== 'prod') {
      return [];
    }

    // For production, block high-risk countries
    // This is a sample list - customize based on your risk assessment
    // ISO 3166-1 alpha-2 country codes
    return [
      'KP', // North Korea
      'IR', // Iran
      'SY', // Syria
      'CU', // Cuba
      // Add more countries based on your security requirements
    ];
  }

  /**
   * Associate WAF with API Gateway
   */
  public associateWithApiGateway(apiGatewayStageArn: string): wafv2.CfnWebACLAssociation {
    return new wafv2.CfnWebACLAssociation(this, 'ApiGatewayWafAssociation', {
      resourceArn: apiGatewayStageArn,
      webAclArn: this.webAcl.attrArn,
    });
  }

  /**
   * Associate WAF with AppSync GraphQL API
   */
  public associateWithAppSync(appSyncApiArn: string): wafv2.CfnWebACLAssociation {
    return new wafv2.CfnWebACLAssociation(this, 'AppSyncWafAssociation', {
      resourceArn: appSyncApiArn,
      webAclArn: this.webAcl.attrArn,
    });
  }
}
