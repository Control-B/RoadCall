import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface PaymentsApiStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  dbCluster: rds.IDatabaseCluster;
  dbSecret: secretsmanager.ISecret;
  stripeSecret: secretsmanager.ISecret;
  eventBus: events.IEventBus;
}

export class PaymentsApiStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: PaymentsApiStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, dbSecret, stripeSecret, eventBus } = props;

    // Define routes for payments service
    const routes: RouteConfig[] = [
      {
        path: 'payments',
        method: 'POST',
        handler: 'handlers/create-payment.handler',
        requiresAuth: true,
        rateLimitPerMinute: 10,
        description: 'Create payment record',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['incidentId', 'vendorId', 'amountCents'],
          properties: {
            incidentId: { type: apigateway.JsonSchemaType.STRING },
            vendorId: { type: apigateway.JsonSchemaType.STRING },
            amountCents: { type: apigateway.JsonSchemaType.INTEGER },
            lineItems: {
              type: apigateway.JsonSchemaType.ARRAY,
              items: {
                type: apigateway.JsonSchemaType.OBJECT,
                required: ['description', 'unitPriceCents'],
                properties: {
                  description: { type: apigateway.JsonSchemaType.STRING },
                  quantity: { type: apigateway.JsonSchemaType.INTEGER },
                  unitPriceCents: { type: apigateway.JsonSchemaType.INTEGER },
                },
              },
            },
          },
        },
      },
      {
        path: 'payments/{id}',
        method: 'GET',
        handler: 'handlers/get-payment.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get payment details',
      },
      {
        path: 'payments/{id}/approve',
        method: 'POST',
        handler: 'handlers/approve-payment.handler',
        requiresAuth: true,
        isSensitive: true, // 10 req/min rate limit
        description: 'Back-office payment approval',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            notes: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'payments/{id}/process',
        method: 'POST',
        handler: 'handlers/process-payment.handler',
        requiresAuth: true,
        isSensitive: true, // 10 req/min rate limit
        description: 'Process payment via Stripe',
      },
      {
        path: 'payments/pending',
        method: 'GET',
        handler: 'handlers/get-pending-approvals.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get pending payment approvals',
      },
      {
        path: 'payments/flagged',
        method: 'GET',
        handler: 'handlers/get-flagged-payments.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get fraud-flagged payments',
      },
      {
        path: 'payments/webhooks/stripe',
        method: 'POST',
        handler: 'handlers/stripe-webhook.handler',
        requiresAuth: false,
        rateLimitPerMinute: 1000,
        description: 'Stripe webhook handler',
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'PaymentsMicroserviceApi', {
      serviceName: 'payments-svc',
      stage,
      api,
      authorizer,
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        STRIPE_SECRET_NAME: stripeSecret.secretName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      dbSecret.grantRead(fn);
      stripeSecret.grantRead(fn);
      eventBus.grantPutEventsTo(fn);
      // Grant RDS Data API access if using Data API
      // dbCluster.grantDataApiAccess(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'PaymentsApi');
  }
}
