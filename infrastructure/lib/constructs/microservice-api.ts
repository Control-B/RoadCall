import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface MicroserviceApiProps {
  serviceName: string;
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  environment?: { [key: string]: string };
  routes: RouteConfig[];
}

export interface RouteConfig {
  path: string;
  method: string;
  handler: string;
  requiresAuth?: boolean;
  rateLimitPerMinute?: number;
  requestSchema?: apigateway.JsonSchema;
  responseSchema?: apigateway.JsonSchema;
  description?: string;
  isSensitive?: boolean; // For 10 req/min rate limit
}

/**
 * Reusable construct for creating microservice API endpoints
 */
export class MicroserviceApi extends Construct {
  public readonly functions: Map<string, lambda.Function>;
  public readonly resources: Map<string, apigateway.Resource>;

  constructor(scope: Construct, id: string, props: MicroserviceApiProps) {
    super(scope, id);

    const { serviceName, stage, api, authorizer, environment = {}, routes } = props;

    this.functions = new Map();
    this.resources = new Map();

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_ENV: stage === 'prod' ? 'production' : 'development',
        SERVICE_NAME: serviceName,
        POWERTOOLS_SERVICE_NAME: serviceName,
        POWERTOOLS_METRICS_NAMESPACE: 'RoadcallAssistant',
        LOG_LEVEL: stage === 'prod' ? 'INFO' : 'DEBUG',
        ...environment,
      },
    };

    // Create Lambda functions and API routes
    for (const route of routes) {
      const functionName = this.getFunctionName(route.path, route.method);
      const lambdaFunction = new lambda.Function(this, functionName, {
        ...commonLambdaProps,
        functionName: `roadcall-${serviceName}-${functionName}-${stage}`,
        code: lambda.Code.fromAsset(path.join(__dirname, `../../../services/${serviceName}/dist`)),
        handler: route.handler,
        description: route.description || `${serviceName} - ${route.method} ${route.path}`,
      });

      this.functions.set(functionName, lambdaFunction);

      // Create API Gateway resource and method
      const resource = this.getOrCreateResource(api, route.path);
      this.resources.set(route.path, resource);

      // Add request validation if schema provided
      let validator: apigateway.IRequestValidator | undefined;
      let requestModel: apigateway.IModel | undefined;
      
      if (route.requestSchema) {
        validator = new apigateway.RequestValidator(this, `${functionName}Validator`, {
          restApi: api,
          requestValidatorName: `${serviceName}-${functionName}-validator`,
          validateRequestBody: true,
          validateRequestParameters: true,
        });

        requestModel = new apigateway.Model(this, `${functionName}RequestModel`, {
          restApi: api,
          contentType: 'application/json',
          modelName: `${serviceName}${functionName}Request`,
          schema: route.requestSchema,
        });
      }

      // Add response models
      const errorModel = this.getOrCreateErrorModel(api, serviceName);
      const responseModels: { [statusCode: string]: { [contentType: string]: apigateway.IModel } } = {
        '200': {
          'application/json': route.responseSchema
            ? new apigateway.Model(this, `${functionName}ResponseModel`, {
                restApi: api,
                contentType: 'application/json',
                modelName: `${serviceName}${functionName}Response`,
                schema: route.responseSchema,
              })
            : apigateway.Model.EMPTY_MODEL,
        },
        '400': { 'application/json': errorModel },
        '401': { 'application/json': errorModel },
        '403': { 'application/json': errorModel },
        '404': { 'application/json': errorModel },
        '429': { 'application/json': errorModel },
        '500': { 'application/json': errorModel },
      };

      // Configure method options
      const methodOptions: apigateway.MethodOptions = {
        authorizationType: route.requiresAuth !== false
          ? apigateway.AuthorizationType.CUSTOM
          : apigateway.AuthorizationType.NONE,
        authorizer: route.requiresAuth !== false ? authorizer : undefined,
        requestValidator: validator,
        requestModels: requestModel ? {
          'application/json': requestModel,
        } : undefined,
        methodResponses: Object.keys(responseModels).map((statusCode) => ({
          statusCode,
          responseModels: responseModels[statusCode],
        })),
      };

      // Add method with Lambda integration
      resource.addMethod(
        route.method,
        new apigateway.LambdaIntegration(lambdaFunction, {
          proxy: true,
        }),
        methodOptions
      );

      // Add usage plan for rate limiting based on sensitivity
      const rateLimit = route.isSensitive ? 10 : (route.rateLimitPerMinute || 100);
      const usagePlanName = route.isSensitive ? 'Sensitive' : 'Standard';
      
      new apigateway.UsagePlan(this, `${functionName}UsagePlan`, {
        name: `${serviceName}-${functionName}-${usagePlanName}-${stage}`,
        description: `${usagePlanName} rate limit for ${serviceName} ${route.method} ${route.path}`,
        throttle: {
          rateLimit,
          burstLimit: rateLimit * 2,
        },
        quota: {
          limit: rateLimit * 60 * 24, // Daily quota
          period: apigateway.Period.DAY,
        },
        apiStages: [
          {
            api,
            stage: api.deploymentStage,
          },
        ],
      });
    }

    // Tag all resources
    cdk.Tags.of(this).add('Service', serviceName);
  }

  /**
   * Get or create nested resource from path
   */
  private getOrCreateResource(api: apigateway.RestApi, path: string): apigateway.Resource {
    const parts = path.split('/').filter((p) => p);
    let resource: apigateway.IResource = api.root;

    for (const part of parts) {
      const childResource = resource.getResource(part);
      if (childResource) {
        resource = childResource;
      } else {
        resource = resource.addResource(part);
      }
    }

    return resource as apigateway.Resource;
  }

  /**
   * Generate function name from path and method
   */
  private getFunctionName(path: string, method: string): string {
    const pathParts = path
      .split('/')
      .filter((p) => p && !p.startsWith('{'))
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');

    return `${method.toLowerCase()}${pathParts || 'Root'}`;
  }

  /**
   * Grant a Lambda function permissions to a resource
   */
  public grantFunctionPermissions(
    functionName: string,
    grantFn: (fn: lambda.IFunction) => void
  ): void {
    const fn = this.functions.get(functionName);
    if (fn) {
      grantFn(fn);
    }
  }

  /**
   * Get a Lambda function by name
   */
  public getFunction(functionName: string): lambda.Function | undefined {
    return this.functions.get(functionName);
  }

  /**
   * Get or create error response model
   */
  private getOrCreateErrorModel(api: apigateway.RestApi, serviceName: string): apigateway.IModel {
    const modelName = `${serviceName}ErrorModel`;
    const existing = this.node.tryFindChild(modelName);
    if (existing) {
      return existing as apigateway.Model;
    }

    return new apigateway.Model(this, modelName, {
      restApi: api,
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
