import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface NotificationsApiStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  notificationLogTable: dynamodb.ITable;
  preferencesTable: dynamodb.ITable;
}

export class NotificationsApiStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: NotificationsApiStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, notificationLogTable, preferencesTable } = props;

    // Define routes for notifications service
    const routes: RouteConfig[] = [
      {
        path: 'notifications/preferences',
        method: 'GET',
        handler: 'handlers/get-preferences.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get notification preferences',
      },
      {
        path: 'notifications/preferences',
        method: 'PUT',
        handler: 'handlers/update-preferences.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Update notification preferences',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          properties: {
            channels: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                push: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  properties: {
                    enabled: { type: apigateway.JsonSchemaType.BOOLEAN },
                  },
                },
                sms: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  properties: {
                    enabled: { type: apigateway.JsonSchemaType.BOOLEAN },
                  },
                },
                email: {
                  type: apigateway.JsonSchemaType.OBJECT,
                  properties: {
                    enabled: { type: apigateway.JsonSchemaType.BOOLEAN },
                  },
                },
              },
            },
            mutedTypes: {
              type: apigateway.JsonSchemaType.ARRAY,
              items: { type: apigateway.JsonSchemaType.STRING },
            },
            quietHours: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                start: { type: apigateway.JsonSchemaType.STRING },
                end: { type: apigateway.JsonSchemaType.STRING },
                timezone: { type: apigateway.JsonSchemaType.STRING },
              },
            },
          },
        },
      },
      {
        path: 'notifications/history',
        method: 'GET',
        handler: 'handlers/get-history.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get notification history',
      },
      {
        path: 'notifications/send',
        method: 'POST',
        handler: 'handlers/send-notification.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'Send notification (admin/system use)',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['type', 'recipientId', 'channels'],
          properties: {
            type: { type: apigateway.JsonSchemaType.STRING },
            recipientId: { type: apigateway.JsonSchemaType.STRING },
            recipientType: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['driver', 'vendor', 'dispatcher', 'admin'],
            },
            channels: {
              type: apigateway.JsonSchemaType.ARRAY,
              items: {
                type: apigateway.JsonSchemaType.STRING,
                enum: ['push', 'sms', 'email'],
              },
            },
            priority: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['low', 'normal', 'high', 'urgent'],
            },
            data: { type: apigateway.JsonSchemaType.OBJECT },
          },
        },
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'NotificationsMicroserviceApi', {
      serviceName: 'notifications-svc',
      stage,
      api,
      authorizer,
      environment: {
        NOTIFICATION_LOG_TABLE: notificationLogTable.tableName,
        PREFERENCES_TABLE: preferencesTable.tableName,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      notificationLogTable.grantReadWriteData(fn);
      preferencesTable.grantReadWriteData(fn);
      // Grant Pinpoint permissions
      fn.addToRolePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'mobiletargeting:SendMessages',
            'mobiletargeting:SendUsersMessages',
          ],
          resources: ['*'],
        })
      );
      // Grant SES permissions
      fn.addToRolePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
        })
      );
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'NotificationsApi');
  }
}
