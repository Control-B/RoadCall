import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  stage: string;
  authorizer: apigateway.IAuthorizer;
  domainName?: string;
  certificateArn?: string;
  hostedZoneId?: string;
  webAcl?: wafv2.CfnWebACL;
}

export interface ServiceEndpoint {
  serviceName: string;
  handler: lambda.IFunction;
  path: string;
  method: string;
  requiresAuth: boolean;
  rateLimitPerMinute?: number;
  requestValidator?: boolean;
  requestSchema?: apigateway.JsonSchema;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { stage, domainName, certificateArn, hostedZoneId, webAcl } = props;

    // Create CloudWatch Log Group for API Gateway
    const apiLogGroup = new logs.LogGroup(this, 'ApiGatewayLogGroup', {
      logGroupName: `/aws/apigateway/roadcall-${stage}`,
      retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Create main API Gateway
    this.api = new apigateway.RestApi(this, 'MainApi', {
      restApiName: `roadcall-api-${stage}`,
      description: `AI Roadcall Assistant - Main API Gateway (${stage})`,
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: stage !== 'prod',
        metricsEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiLogGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        throttlingBurstLimit: 5000,
        throttlingRateLimit: 2000,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: this.getAllowedOrigins(stage),
        allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Request-Id',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.hours(1),
      },
      cloudWatchRole: true,
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
    });

    // Create usage plan for standard rate limiting (100 req/min)
    const standardUsagePlan = this.api.addUsagePlan('StandardUsagePlan', {
      name: `roadcall-standard-${stage}`,
      description: 'Standard rate limit for general endpoints',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.DAY,
      },
    });

    standardUsagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Create usage plan for sensitive endpoints (10 req/min)
    const sensitiveUsagePlan = this.api.addUsagePlan('SensitiveUsagePlan', {
      name: `roadcall-sensitive-${stage}`,
      description: 'Restricted rate limit for sensitive endpoints',
      throttle: {
        rateLimit: 10,
        burstLimit: 20,
      },
      quota: {
        limit: 1000,
        period: apigateway.Period.DAY,
      },
    });

    sensitiveUsagePlan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Associate WAF with API Gateway if provided
    if (webAcl) {
      new wafv2.CfnWebACLAssociation(this, 'ApiGatewayWafAssociation', {
        resourceArn: this.api.deploymentStage.stageArn,
        webAclArn: webAcl.attrArn,
      });

      new cdk.CfnOutput(this, 'WebAclArn', {
        value: webAcl.attrArn,
        description: 'WAF Web ACL ARN attached to API Gateway',
        exportName: `${stage}-ApiGatewayWebAclArn`,
      });
    }

    // Setup custom domain if provided
    if (domainName && certificateArn) {
      this.setupCustomDomain(domainName, certificateArn, hostedZoneId, stage);
    }

    // Create request validators
    const bodyValidator = new apigateway.RequestValidator(this, 'BodyValidator', {
      restApi: this.api,
      requestValidatorName: 'body-validator',
      validateRequestBody: true,
      validateRequestParameters: false,
    });

    const paramsValidator = new apigateway.RequestValidator(this, 'ParamsValidator', {
      restApi: this.api,
      requestValidatorName: 'params-validator',
      validateRequestBody: false,
      validateRequestParameters: true,
    });

    const fullValidator = new apigateway.RequestValidator(this, 'FullValidator', {
      restApi: this.api,
      requestValidatorName: 'full-validator',
      validateRequestBody: true,
      validateRequestParameters: true,
    });

    // Store validators for use by other stacks
    this.exportValue(bodyValidator.requestValidatorId, {
      name: `${stage}-BodyValidatorId`,
    });
    this.exportValue(paramsValidator.requestValidatorId, {
      name: `${stage}-ParamsValidatorId`,
    });
    this.exportValue(fullValidator.requestValidatorId, {
      name: `${stage}-FullValidatorId`,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'Main API Gateway URL',
      exportName: `${stage}-ApiUrl`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'Main API Gateway ID',
      exportName: `${stage}-ApiId`,
    });

    new cdk.CfnOutput(this, 'ApiRootResourceId', {
      value: this.api.root.resourceId,
      description: 'API Gateway Root Resource ID',
      exportName: `${stage}-ApiRootResourceId`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'ApiGateway');
  }

  /**
   * Setup custom domain with ACM certificate
   */
  private setupCustomDomain(
    domainName: string,
    certificateArn: string,
    hostedZoneId: string | undefined,
    stage: string
  ): void {
    // Import existing certificate
    const certificate = certificatemanager.Certificate.fromCertificateArn(
      this,
      'Certificate',
      certificateArn
    );

    // Create custom domain
    const customDomain = this.api.addDomainName('CustomDomain', {
      domainName,
      certificate,
      endpointType: apigateway.EndpointType.REGIONAL,
      securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
    });

    // Add base path mapping
    customDomain.addBasePathMapping(this.api, {
      basePath: stage === 'prod' ? '' : stage,
    });

    // If hosted zone is provided, create Route53 record
    if (hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName.split('.').slice(-2).join('.'),
      });

      new route53.ARecord(this, 'CustomDomainAliasRecord', {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53targets.ApiGatewayDomain(customDomain)
        ),
      });
    }

    new cdk.CfnOutput(this, 'CustomDomainName', {
      value: domainName,
      description: 'Custom domain name',
      exportName: `${stage}-CustomDomainName`,
    });

    new cdk.CfnOutput(this, 'CustomDomainUrl', {
      value: `https://${domainName}/${stage === 'prod' ? '' : stage}`,
      description: 'Custom domain URL',
      exportName: `${stage}-CustomDomainUrl`,
    });
  }

  /**
   * Get allowed origins based on stage
   */
  private getAllowedOrigins(stage: string): string[] {
    if (stage === 'prod') {
      // In production, specify exact origins
      return [
        'https://app.roadcall.com',
        'https://www.roadcall.com',
        'https://admin.roadcall.com',
      ];
    } else if (stage === 'staging') {
      return [
        'https://staging.roadcall.com',
        'https://staging-admin.roadcall.com',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
    } else {
      // Development: allow all origins
      return apigateway.Cors.ALL_ORIGINS;
    }
  }

  /**
   * Helper method to add a service endpoint with proper configuration
   * Note: This is a utility method for future use. Current implementation uses MicroserviceApi construct.
   */
  public addServiceEndpoint(
    _serviceName: string,
    path: string,
    method: string,
    handler: lambda.IFunction,
    options: {
      requiresAuth?: boolean;
      rateLimitPerMinute?: number;
      requestValidator?: apigateway.IRequestValidator;
      requestModel?: apigateway.IModel;
      responseModels?: { [contentType: string]: apigateway.IModel };
    } = {}
  ): apigateway.Method {
    const {
      requiresAuth = true,
      requestValidator,
      requestModel,
      responseModels,
    } = options;

    // Get or create resource
    const resource = this.getOrCreateResource(path);

    // Configure method options
    const methodOptions: apigateway.MethodOptions = {
      requestValidator,
      requestModels: requestModel ? { 'application/json': requestModel } : undefined,
      authorizationType: requiresAuth ? apigateway.AuthorizationType.CUSTOM : apigateway.AuthorizationType.NONE,
      methodResponses: [
        {
          statusCode: '200',
          responseModels: responseModels || {
            'application/json': apigateway.Model.EMPTY_MODEL,
          },
        },
        {
          statusCode: '400',
          responseModels: {
            'application/json': this.getErrorModel(),
          },
        },
        {
          statusCode: '401',
          responseModels: {
            'application/json': this.getErrorModel(),
          },
        },
        {
          statusCode: '403',
          responseModels: {
            'application/json': this.getErrorModel(),
          },
        },
        {
          statusCode: '429',
          responseModels: {
            'application/json': this.getErrorModel(),
          },
        },
        {
          statusCode: '500',
          responseModels: {
            'application/json': this.getErrorModel(),
          },
        },
      ],
    };

    // Create Lambda integration
    const integration = new apigateway.LambdaIntegration(handler, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
        },
      ],
    });

    // Add method
    return resource.addMethod(method, integration, methodOptions);
  }

  /**
   * Get or create nested resource from path
   */
  private getOrCreateResource(path: string): apigateway.IResource {
    const parts = path.split('/').filter((p) => p);
    let resource: apigateway.IResource = this.api.root;

    for (const part of parts) {
      const existing = resource.getResource(part);
      if (existing) {
        resource = existing;
      } else {
        resource = resource.addResource(part);
      }
    }

    return resource;
  }

  /**
   * Get or create error response model
   */
  private getErrorModel(): apigateway.IModel {
    const modelName = 'ErrorResponseModel';
    const existing = this.api.node.tryFindChild(modelName);
    if (existing) {
      return existing as apigateway.Model;
    }

    return new apigateway.Model(this, modelName, {
      restApi: this.api,
      contentType: 'application/json',
      modelName,
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          error: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              type: { type: apigateway.JsonSchemaType.STRING },
              message: { type: apigateway.JsonSchemaType.STRING },
              code: { type: apigateway.JsonSchemaType.STRING },
              details: { type: apigateway.JsonSchemaType.OBJECT },
              requestId: { type: apigateway.JsonSchemaType.STRING },
              timestamp: { type: apigateway.JsonSchemaType.STRING },
            },
            required: ['type', 'message', 'code'],
          },
        },
        required: ['error'],
      },
    });
  }
}
