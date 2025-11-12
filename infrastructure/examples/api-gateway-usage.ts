/**
 * Example: How to integrate a new microservice with API Gateway
 * 
 * This example shows how to create a new service stack that integrates
 * with the centralized API Gateway infrastructure.
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from '../lib/constructs/microservice-api';

export interface ExampleServiceStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  exampleTable: dynamodb.ITable;
}

export class ExampleServiceStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: ExampleServiceStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, exampleTable } = props;

    // Define routes for your service
    const routes: RouteConfig[] = [
      // Public endpoint (no authentication)
      {
        path: 'health',
        method: 'GET',
        handler: 'handlers/health.handler',
        requiresAuth: false,
        rateLimitPerMinute: 1000,
        description: 'Health check endpoint',
      },

      // Standard protected endpoint
      {
        path: 'resources',
        method: 'GET',
        handler: 'handlers/list-resources.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100, // Standard rate limit
        description: 'List all resources',
      },

      // Protected endpoint with request validation
      {
        path: 'resources',
        method: 'POST',
        handler: 'handlers/create-resource.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Create a new resource',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['name', 'type'],
          properties: {
            name: {
              type: apigateway.JsonSchemaType.STRING,
              minLength: 1,
              maxLength: 100,
            },
            type: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['type_a', 'type_b', 'type_c'],
            },
            metadata: {
              type: apigateway.JsonSchemaType.OBJECT,
            },
          },
        },
        responseSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            resourceId: { type: apigateway.JsonSchemaType.STRING },
            name: { type: apigateway.JsonSchemaType.STRING },
            type: { type: apigateway.JsonSchemaType.STRING },
            createdAt: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },

      // Sensitive endpoint (restricted rate limit)
      {
        path: 'resources/{id}/approve',
        method: 'POST',
        handler: 'handlers/approve-resource.handler',
        requiresAuth: true,
        isSensitive: true, // 10 req/min rate limit
        description: 'Approve a resource (admin only)',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            notes: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },

      // GET endpoint with path parameter
      {
        path: 'resources/{id}',
        method: 'GET',
        handler: 'handlers/get-resource.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get resource by ID',
      },

      // UPDATE endpoint
      {
        path: 'resources/{id}',
        method: 'PATCH',
        handler: 'handlers/update-resource.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update resource',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            name: { type: apigateway.JsonSchemaType.STRING },
            metadata: { type: apigateway.JsonSchemaType.OBJECT },
          },
        },
      },

      // DELETE endpoint
      {
        path: 'resources/{id}',
        method: 'DELETE',
        handler: 'handlers/delete-resource.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Delete resource',
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'ExampleMicroserviceApi', {
      serviceName: 'example-svc',
      stage,
      api,
      authorizer,
      environment: {
        EXAMPLE_TABLE: exampleTable.tableName,
        // Add other environment variables
      },
      routes,
    });

    // Grant DynamoDB permissions to all Lambda functions
    this.microserviceApi.functions.forEach((fn) => {
      exampleTable.grantReadWriteData(fn);
    });

    // Grant specific permissions to individual functions
    const createFn = this.microserviceApi.getFunction('postResources');
    if (createFn) {
      // Grant additional permissions to create function
      // e.g., SNS publish, S3 write, etc.
    }

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'ExampleService');
  }
}

/**
 * Example Lambda Handler
 * 
 * File: services/example-svc/src/handlers/create-resource.ts
 */

/*
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const dynamodb = DynamoDBDocument.from(new DynamoDB({}));
const TABLE_NAME = process.env.EXAMPLE_TABLE!;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body (already validated by API Gateway)
    const body = JSON.parse(event.body || '{}');
    
    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.userId;
    const userRole = event.requestContext.authorizer?.role;
    
    // Create resource
    const resource = {
      resourceId: uuidv4(),
      name: body.name,
      type: body.type,
      metadata: body.metadata || {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    
    // Save to DynamoDB
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: resource,
    });
    
    // Return success response
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(resource),
    };
  } catch (error) {
    console.error('Error creating resource:', error);
    
    // Return error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to create resource',
          code: 'CREATE_FAILED',
          requestId: event.requestContext.requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
};
*/

/**
 * Example: Testing the API
 */

/*
// 1. Register and authenticate
curl -X POST https://api.roadcall.com/dev/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "role": "driver",
    "name": "John Doe"
  }'

curl -X POST https://api.roadcall.com/dev/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+15551234567",
    "otp": "123456"
  }'

// 2. Create a resource
TOKEN="<access_token_from_verify>"
curl -X POST https://api.roadcall.com/dev/resources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Resource",
    "type": "type_a",
    "metadata": {
      "key": "value"
    }
  }'

// 3. Get resource
curl -X GET https://api.roadcall.com/dev/resources/resource-123 \
  -H "Authorization: Bearer $TOKEN"

// 4. Update resource
curl -X PATCH https://api.roadcall.com/dev/resources/resource-123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Resource Name"
  }'

// 5. Delete resource
curl -X DELETE https://api.roadcall.com/dev/resources/resource-123 \
  -H "Authorization: Bearer $TOKEN"
*/
