import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface MatchStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  offersTable: dynamodb.ITable;
  vendorsTable: dynamodb.ITable;
  incidentsTable: dynamodb.ITable;
  eventBus: events.IEventBus;
}

export class MatchStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: MatchStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, offersTable, vendorsTable, incidentsTable, eventBus } = props;

    // Define routes for match service
    const routes: RouteConfig[] = [
      {
        path: 'offers/{id}',
        method: 'GET',
        handler: 'handlers/get-offer.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get offer details',
      },
      {
        path: 'offers/{id}/accept',
        method: 'POST',
        handler: 'handlers/accept-offer.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Vendor accepts offer',
      },
      {
        path: 'offers/{id}/decline',
        method: 'POST',
        handler: 'handlers/decline-offer.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Vendor declines offer',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            reason: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'MatchMicroserviceApi', {
      serviceName: 'match-svc',
      stage,
      api,
      authorizer,
      environment: {
        OFFERS_TABLE: offersTable.tableName,
        VENDORS_TABLE: vendorsTable.tableName,
        INCIDENTS_TABLE: incidentsTable.tableName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      offersTable.grantReadWriteData(fn);
      vendorsTable.grantReadData(fn);
      incidentsTable.grantReadWriteData(fn);
      eventBus.grantPutEventsTo(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Match');
  }
}
