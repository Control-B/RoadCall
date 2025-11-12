import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface IncidentStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  incidentsTable: dynamodb.ITable;
  mediaBucket: s3.IBucket;
  eventBus: events.IEventBus;
}

export class IncidentStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: IncidentStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, incidentsTable, mediaBucket, eventBus } = props;

    // Define routes for incident service
    const routes: RouteConfig[] = [
      {
        path: 'incidents',
        method: 'POST',
        handler: 'handlers/create-incident.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Create new incident',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['type', 'location'],
          properties: {
            type: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['tire', 'engine', 'tow'],
            },
            location: {
              type: apigateway.JsonSchemaType.OBJECT,
              required: ['lat', 'lon'],
              properties: {
                lat: { type: apigateway.JsonSchemaType.NUMBER },
                lon: { type: apigateway.JsonSchemaType.NUMBER },
              },
            },
            description: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'incidents/{id}',
        method: 'GET',
        handler: 'handlers/get-incident.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get incident details',
      },
      {
        path: 'incidents',
        method: 'GET',
        handler: 'handlers/list-incidents.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'List incidents with filters',
      },
      {
        path: 'incidents/{id}/status',
        method: 'PATCH',
        handler: 'handlers/update-status.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update incident status',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['status'],
          properties: {
            status: {
              type: apigateway.JsonSchemaType.STRING,
              enum: [
                'created',
                'vendor_assigned',
                'vendor_en_route',
                'vendor_arrived',
                'work_in_progress',
                'work_completed',
                'payment_pending',
                'closed',
                'cancelled',
              ],
            },
            reason: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'incidents/{id}/media',
        method: 'POST',
        handler: 'handlers/upload-media.handler',
        requiresAuth: true,
        rateLimitPerMinute: 20,
        description: 'Upload incident media (photos/videos)',
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'IncidentMicroserviceApi', {
      serviceName: 'incident-svc',
      stage,
      api,
      authorizer,
      environment: {
        INCIDENTS_TABLE: incidentsTable.tableName,
        MEDIA_BUCKET: mediaBucket.bucketName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      incidentsTable.grantReadWriteData(fn);
      mediaBucket.grantReadWrite(fn);
      eventBus.grantPutEventsTo(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Incident');
  }
}
