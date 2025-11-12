import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface ReportingApiStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  dbCluster: rds.IDatabaseCluster;
  dbSecret: secretsmanager.ISecret;
  exportBucket: s3.IBucket;
}

export class ReportingApiStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: ReportingApiStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, dbSecret, exportBucket } = props;

    // Define routes for reporting service
    const routes: RouteConfig[] = [
      {
        path: 'reports/kpis',
        method: 'GET',
        handler: 'handlers/get-kpis.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get KPI summary',
      },
      {
        path: 'reports/incidents',
        method: 'GET',
        handler: 'handlers/get-incidents.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get incident analytics',
      },
      {
        path: 'reports/vendors/{id}/performance',
        method: 'GET',
        handler: 'handlers/get-vendor-performance.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get vendor performance report',
      },
      {
        path: 'reports/export',
        method: 'POST',
        handler: 'handlers/export-data.handler',
        requiresAuth: true,
        rateLimitPerMinute: 10,
        description: 'Export data to S3',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['reportType', 'format'],
          properties: {
            reportType: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['incidents', 'vendors', 'payments', 'kpis'],
            },
            format: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['csv', 'parquet', 'json'],
            },
            startDate: { type: apigateway.JsonSchemaType.STRING },
            endDate: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'ReportingMicroserviceApi', {
      serviceName: 'reporting-svc',
      stage,
      api,
      authorizer,
      environment: {
        DB_SECRET_ARN: dbSecret.secretArn,
        EXPORT_BUCKET: exportBucket.bucketName,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      dbSecret.grantRead(fn);
      exportBucket.grantReadWrite(fn);
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'ReportingApi');
  }
}
