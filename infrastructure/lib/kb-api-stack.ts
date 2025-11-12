import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { MicroserviceApi, RouteConfig } from './constructs/microservice-api';

export interface KbApiStackProps extends cdk.StackProps {
  stage: string;
  api: apigateway.RestApi;
  authorizer: apigateway.IAuthorizer;
  documentsTable: dynamodb.ITable;
  documentsBucket: s3.IBucket;
  kendraIndexId: string;
}

export class KbApiStack extends cdk.Stack {
  public readonly microserviceApi: MicroserviceApi;

  constructor(scope: Construct, id: string, props: KbApiStackProps) {
    super(scope, id, props);

    const { stage, api, authorizer, documentsTable, documentsBucket, kendraIndexId } = props;

    // Define routes for knowledge base service
    const routes: RouteConfig[] = [
      {
        path: 'kb/documents',
        method: 'POST',
        handler: 'handlers/upload-document.handler',
        requiresAuth: true,
        rateLimitPerMinute: 10,
        description: 'Upload knowledge base document',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['title', 'category'],
          properties: {
            title: { type: apigateway.JsonSchemaType.STRING },
            category: {
              type: apigateway.JsonSchemaType.STRING,
              enum: ['sop', 'vendor_sla', 'troubleshooting', 'policy'],
            },
            tags: {
              type: apigateway.JsonSchemaType.ARRAY,
              items: { type: apigateway.JsonSchemaType.STRING },
            },
            effectiveDate: { type: apigateway.JsonSchemaType.STRING },
            expiryDate: { type: apigateway.JsonSchemaType.STRING },
          },
        },
      },
      {
        path: 'kb/documents/{id}',
        method: 'GET',
        handler: 'handlers/get-document.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Get document metadata',
      },
      {
        path: 'kb/documents',
        method: 'GET',
        handler: 'handlers/list-documents.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'List knowledge base documents',
      },
      {
        path: 'kb/documents/{id}',
        method: 'DELETE',
        handler: 'handlers/delete-document.handler',
        requiresAuth: true,
        rateLimitPerMinute: 10,
        description: 'Delete knowledge base document',
      },
      {
        path: 'kb/search',
        method: 'POST',
        handler: 'handlers/search-documents.handler',
        requiresAuth: true,
        rateLimitPerMinute: 100,
        description: 'Search knowledge base',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['query'],
          properties: {
            query: { type: apigateway.JsonSchemaType.STRING },
            category: { type: apigateway.JsonSchemaType.STRING },
            maxResults: { type: apigateway.JsonSchemaType.INTEGER },
          },
        },
      },
      {
        path: 'kb/query',
        method: 'POST',
        handler: 'handlers/rag-query.handler',
        requiresAuth: true,
        rateLimitPerMinute: 50,
        description: 'RAG query with LLM',
        requestSchema: {
          type: apigateway.JsonSchemaType.OBJECT,
          required: ['query'],
          properties: {
            query: { type: apigateway.JsonSchemaType.STRING },
            context: {
              type: apigateway.JsonSchemaType.OBJECT,
              properties: {
                category: { type: apigateway.JsonSchemaType.STRING },
                incidentType: { type: apigateway.JsonSchemaType.STRING },
              },
            },
          },
        },
      },
    ];

    // Create microservice API
    this.microserviceApi = new MicroserviceApi(this, 'KbMicroserviceApi', {
      serviceName: 'kb-svc',
      stage,
      api,
      authorizer,
      environment: {
        DOCUMENTS_TABLE: documentsTable.tableName,
        DOCUMENTS_BUCKET: documentsBucket.bucketName,
        KENDRA_INDEX_ID: kendraIndexId,
      },
      routes,
    });

    // Grant permissions
    this.microserviceApi.functions.forEach((fn) => {
      documentsTable.grantReadWriteData(fn);
      documentsBucket.grantReadWrite(fn);
      // Grant Kendra permissions
      fn.addToRolePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: ['kendra:Query', 'kendra:DescribeIndex'],
          resources: [`arn:aws:kendra:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:index/${kendraIndexId}`],
        })
      );
      // Grant Bedrock permissions
      fn.addToRolePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: ['bedrock:InvokeModel'],
          resources: ['*'],
        })
      );
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'KbApi');
  }
}
