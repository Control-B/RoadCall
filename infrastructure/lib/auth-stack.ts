import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface AuthStackProps extends cdk.StackProps {
  stage: string;
  usersTable: dynamodb.ITable;
}

export class AuthStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly authorizer: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const { stage, usersTable } = props;

    // Create JWT secret in Secrets Manager
    const jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: `roadcall/jwt/${stage}/secret`,
      description: 'JWT signing secret for authentication',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: 'secret',
        excludePunctuation: true,
        passwordLength: 64,
      },
    });

    // Common Lambda environment variables
    const commonEnv = {
      USERS_TABLE: usersTable.tableName,
      JWT_SECRET_NAME: jwtSecret.secretName,
      NODE_ENV: stage === 'prod' ? 'production' : 'development',
      SERVICE_NAME: 'auth-svc',
    };

    // Common Lambda props
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      environment: commonEnv,
    };

    // Register Lambda
    const registerFn = new lambda.Function(this, 'RegisterFunction', {
      ...commonLambdaProps,
      functionName: `roadcall-auth-register-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-svc/dist')),
      handler: 'handlers/register.handler',
      description: 'User registration and OTP generation',
    });

    // Verify Lambda
    const verifyFn = new lambda.Function(this, 'VerifyFunction', {
      ...commonLambdaProps,
      functionName: `roadcall-auth-verify-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-svc/dist')),
      handler: 'handlers/verify.handler',
      description: 'OTP verification and JWT token generation',
    });

    // Refresh Lambda
    const refreshFn = new lambda.Function(this, 'RefreshFunction', {
      ...commonLambdaProps,
      functionName: `roadcall-auth-refresh-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-svc/dist')),
      handler: 'handlers/refresh.handler',
      description: 'JWT token refresh',
    });

    // Me Lambda
    const meFn = new lambda.Function(this, 'MeFunction', {
      ...commonLambdaProps,
      functionName: `roadcall-auth-me-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-svc/dist')),
      handler: 'handlers/me.handler',
      description: 'Get current user profile',
    });

    // Authorizer Lambda
    const authorizerFn = new lambda.Function(this, 'AuthorizerFunction', {
      ...commonLambdaProps,
      functionName: `roadcall-authorizer-${stage}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/auth-svc/dist')),
      handler: 'middleware/authorizer.handler',
      description: 'JWT token authorizer for API Gateway',
    });

    // Grant permissions
    usersTable.grantReadWriteData(registerFn);
    usersTable.grantReadWriteData(verifyFn);
    usersTable.grantReadData(meFn);
    jwtSecret.grantRead(verifyFn);
    jwtSecret.grantRead(refreshFn);
    jwtSecret.grantRead(meFn);
    jwtSecret.grantRead(authorizerFn);

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'AuthApi', {
      restApiName: `roadcall-auth-api-${stage}`,
      description: 'AI Roadcall Assistant - Authentication API',
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: stage !== 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key'],
      },
      cloudWatchRole: true,
    });

    // Create Token Authorizer
    this.authorizer = new apigateway.TokenAuthorizer(this, 'JWTAuthorizer', {
      handler: authorizerFn,
      identitySource: 'method.request.header.Authorization',
      authorizerName: `roadcall-jwt-authorizer-${stage}`,
      resultsCacheTtl: cdk.Duration.minutes(5),
    });

    // Create /auth resource
    const auth = this.api.root.addResource('auth');

    // POST /auth/register
    const register = auth.addResource('register');
    register.addMethod('POST', new apigateway.LambdaIntegration(registerFn), {
      requestValidator: new apigateway.RequestValidator(this, 'RegisterValidator', {
        restApi: this.api,
        validateRequestBody: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'RegisterModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['phone', 'role', 'name'],
            properties: {
              phone: { type: apigateway.JsonSchemaType.STRING },
              role: { type: apigateway.JsonSchemaType.STRING, enum: ['driver', 'vendor', 'dispatcher', 'admin'] },
              name: { type: apigateway.JsonSchemaType.STRING },
              email: { type: apigateway.JsonSchemaType.STRING },
              companyId: { type: apigateway.JsonSchemaType.STRING },
              truckNumber: { type: apigateway.JsonSchemaType.STRING },
            },
          },
        }),
      },
    });

    // POST /auth/verify
    const verify = auth.addResource('verify');
    verify.addMethod('POST', new apigateway.LambdaIntegration(verifyFn), {
      requestValidator: new apigateway.RequestValidator(this, 'VerifyValidator', {
        restApi: this.api,
        validateRequestBody: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'VerifyModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['phone', 'otp'],
            properties: {
              phone: { type: apigateway.JsonSchemaType.STRING },
              otp: { type: apigateway.JsonSchemaType.STRING },
            },
          },
        }),
      },
    });

    // POST /auth/refresh
    const refresh = auth.addResource('refresh');
    refresh.addMethod('POST', new apigateway.LambdaIntegration(refreshFn), {
      requestValidator: new apigateway.RequestValidator(this, 'RefreshValidator', {
        restApi: this.api,
        validateRequestBody: true,
      }),
      requestModels: {
        'application/json': new apigateway.Model(this, 'RefreshModel', {
          restApi: this.api,
          contentType: 'application/json',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['refreshToken'],
            properties: {
              refreshToken: { type: apigateway.JsonSchemaType.STRING },
            },
          },
        }),
      },
    });

    // GET /auth/me (protected)
    const me = auth.addResource('me');
    me.addMethod('GET', new apigateway.LambdaIntegration(meFn), {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

    // Outputs
    new cdk.CfnOutput(this, 'AuthApiUrl', {
      value: this.api.url,
      description: 'Auth API URL',
      exportName: `${stage}-AuthApiUrl`,
    });

    new cdk.CfnOutput(this, 'AuthApiId', {
      value: this.api.restApiId,
      description: 'Auth API ID',
      exportName: `${stage}-AuthApiId`,
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Auth');
  }
}
