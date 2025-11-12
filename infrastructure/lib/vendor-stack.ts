import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface VendorStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  vendorsTable: dynamodb.ITable;
  vpc?: ec2.IVpc;
  redisCluster?: elasticache.CfnCacheCluster;
}

export class VendorStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: VendorStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, vendorsTable, redisCluster } = props;
    // vpc is available in props if needed for future VPC-specific configurations

    // Define routes for vendor service
    const routes: RouteConfig[] = [
      {
        path: 'vendors',
        method: 'POST',
        handler: 'handlers/register-vendor.handler',
        requiresAuth: true,
        rateLimitPerMinute: 10,
        description: 'Register new vendor',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['businessName', 'contactName', 'phone', 'capabilities'],
          properties: {
            businessName: { type: apigateway.JsonSchemaType.STRING },
            contactName: { type: apigateway.JsonSchemaType.STRING },
            phone: { type: apigateway.JsonSchemaType.STRING },
            email: { type: apigateway.JsonSchemaType.STRING },
            capabilities: {
              type: apigateway.JsonSchemaType.ARRAY,
              items: {
                type: apigateway.JsonSchemaType.STRING,
                enum: [
                  'tire_repair',
                  'tire_replacement',
                  'engine_repair',
                  'towing',
                  'jumpstart',
                  'fuel_delivery',
                ],
              },
            },
            coverageArea: {
              type: apigateway.JsonSchemaType.OBJECT,
              required: ['center', 'radiusMiles'],
              properties: {
                center: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  required: ['lat', 'lon'],
                  properties: {
                    lat: { type: apigateway.JsonSchemaType.NUMBER },
                    lon: { type: apigateway.JsonSchemaType.NUMBER },
                  },
                },
                radiusMiles: { type: apigateway.JsonSchemaType.NUMBER },
              },
            },
          },
        },
      },
      {
        path: 'vendors/{id}',
        method: 'GET',
        handler: 'handlers/get-vendor.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get vendor profile',
      },
      {
        path: 'vendors/{id}',
        method: 'PATCH',
        handler: 'handlers/update-vendor.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update vendor profile',
      },
      {
        path: 'vendors/{id}/availability',
        method: 'PATCH',
        handler: 'handlers/update-availability.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Update vendor availability status',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['status'],
          properties: {
            status: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['available', 'busy', 'offline'],
            },
            currentIncidentId: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'vendors/search',
        method: 'GET',
        handler: 'handlers/search-vendors.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Search vendors by location and capability',
      },
    ];

    // Create microservice API
    const environment: { [key: string]: string } = {
      VENDORS_TABLE: vendorsTable.tableName,
    };

    if (redisCluster) {
      environment.REDIS_ENDPOINT = redisCluster.attrRedisEndpointAddress;
      environment.REDIS_PORT = redisCluster.attrRedisEndpointPort;
    }

    this.microserviceApi = new MicroserviceApi(this, 'VendorMicroserviceApi', {
      serviceName: 'vendor-svc',
      stage,
      api,
      authorizer,
      environment,
      routes,
    });

    // Grant DynamoDB permissions
    this.microserviceApi.functions.forEach((fn) => {
      vendorsTable.grantReadWriteData(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Vendor');
  }
}
