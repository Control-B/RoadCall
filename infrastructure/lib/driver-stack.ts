import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface DriverStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  driversTable: dynamodb.ITable;
  incidentsTable: dynamodb.ITable;
}

export class DriverStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: DriverStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, driversTable, incidentsTable } = props;

    // Define routes for driver service
    const routes: RouteConfig[] = [
      {
        path: 'drivers/{id}',
        method: 'GET',
        handler: 'handlers/get-driver.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get driver profile',
      },
      {
        path: 'drivers/{id}',
        method: 'PATCH',
        handler: 'handlers/update-driver.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update driver profile',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            name: { type: apigateway.JsonSchemaType.STRING },
            email: { type: apigateway.JsonSchemaType.STRING },
            truckNumber: { type: apigateway.JsonSchemaType.STRING },
            licenseNumber: { type: apigateway.JsonSchemaType.STRING },
            licenseState: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'drivers/{id}/incidents',
        method: 'GET',
        handler: 'handlers/get-incidents.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get driver incident history',
      },
      {
        path: 'drivers/{id}/preferences',
        method: 'GET',
        handler: 'handlers/get-preferences.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get driver preferences',
      },
      {
        path: 'drivers/{id}/preferences',
        method: 'PATCH',
        handler: 'handlers/update-preferences.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update driver preferences',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            language: { type: apigateway.JsonSchemaType.STRING },
            autoShareLocation: { type: apigateway.JsonSchemaType.BOOLEAN },
            notifications: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                push: { type: apigateway.JsonSchemaType.BOOLEAN },
                sms: { type: apigateway.JsonSchemaType.BOOLEAN },
                email: { type: apigateway.JsonSchemaType.BOOLEAN },
              },
            },
          },
        },
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'DriverMicroserviceApi', {
      serviceName: 'driver-svc',
      stage,
      api,
      authorizer,
      environment: {
        DRIVERS_TABLE: driversTable.tableName,
        INCIDENTS_TABLE: incidentsTable.tableName,
      },
      routes,
    });

    // Grant DynamoDB permissions
    this.microserviceApi.functions.forEach((fn) => {
      driversTable.grantReadWriteData(fn);
      incidentsTable.grantReadData(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Driver');
  }
}
