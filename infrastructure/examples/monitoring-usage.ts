/**
 * Example: How to use observability features in Lambda functions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  withObservability,
  EnhancedContext,
  traceOperation,
  traceAWSCall,
  createBusinessMetrics,
} from '@roadcall/utils';
import { DynamoDB } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDB({ region: process.env.AWS_REGION });
const businessMetrics = createBusinessMetrics(
  process.env.SERVICE_NAME || 'roadcall-assistant',
  process.env.ENVIRONMENT || 'dev'
);

/**
 * Example Lambda handler with full observability
 */
export const handler = withObservability(
  {
    serviceName: 'incident-svc',
    environment: process.env.ENVIRONMENT,
    enableXRay: true,
    enableMetrics: true,
    captureAWSClients: true,
  },
  async (
    event: APIGatewayProxyEvent,
    context: EnhancedContext
  ): Promise<APIGatewayProxyResult> => {
    const { logger, metrics } = context;

    try {
      // Log incoming request
      logger.info('Processing incident creation request', {
        path: event.path,
        method: event.httpMethod,
        userId: event.requestContext.authorizer?.claims?.sub,
      });

      // Parse request body
      const body = JSON.parse(event.body || '{}');
      const { driverId, type, location } = body;

      // Validate input
      if (!driverId || !type || !location) {
        logger.warn('Invalid request: missing required fields', { body });
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required fields' }),
        };
      }

      // Create incident with tracing
      const incident = await traceOperation(
        'CreateIncident',
        async () => {
          const incidentId = generateIncidentId();

          // DynamoDB operation with tracing
          await traceAWSCall('DynamoDB', 'PutItem', async () => {
            await dynamodb.putItem({
              TableName: process.env.INCIDENTS_TABLE!,
              Item: {
                incidentId: { S: incidentId },
                driverId: { S: driverId },
                type: { S: type },
                status: { S: 'created' },
                location: {
                  M: {
                    lat: { N: location.lat.toString() },
                    lon: { N: location.lon.toString() },
                  },
                },
                createdAt: { S: new Date().toISOString() },
              },
            });
          });

          return { incidentId, driverId, type, location, status: 'created' };
        },
        { driverId, type }
      );

      // Record business metrics
      await businessMetrics.recordIncidentCreated(type);
      if (metrics) {
        await metrics.recordCount('IncidentCreated', 1, [
          { Name: 'IncidentType', Value: type },
        ]);
      }

      logger.info('Incident created successfully', {
        incidentId: incident.incidentId,
        type,
      });

      return {
        statusCode: 201,
        body: JSON.stringify(incident),
      };
    } catch (error) {
      logger.error('Failed to create incident', error as Error);

      // Record error metric
      if (metrics) {
        await metrics.recordCount('IncidentCreationFailed', 1);
      }

      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal server error' }),
      };
    } finally {
      // Flush metrics before function completes
      await businessMetrics.flush();
      if (metrics) {
        await metrics.flush();
      }
    }
  }
);

function generateIncidentId(): string {
  return `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Example: Using logger in non-Lambda context
 * 
 * Uncomment to use:
 * 
 * import { createLogger } from '@roadcall/utils';
 * 
 * const logger = createLogger('background-job', 'production');
 * 
 * async function processBackgroundJob() {
 *   logger.info('Starting background job');
 * 
 *   const timer = logger.startTimer('job-processing');
 * 
 *   try {
 *     // Do work
 *     await someAsyncOperation();
 * 
 *     timer(); // Log performance metric
 *     logger.info('Background job completed successfully');
 *   } catch (error) {
 *     logger.error('Background job failed', error as Error);
 *     throw error;
 *   }
 * }
 * 
 * async function someAsyncOperation(): Promise<void> {
 *   // Simulate work
 *   await new Promise((resolve) => setTimeout(resolve, 1000));
 * }
 */

/**
 * Example: Custom CloudWatch Logs Insights queries
 * 
 * Copy these queries into CloudWatch Logs Insights console:
 * 
 * Query 1: Find all errors in the last hour
 * 
 * fields @timestamp, level, message, service, error.name, error.message
 * | filter level = "ERROR"
 * | sort @timestamp desc
 * | limit 100
 * 
 * 
 * Query 2: Calculate P95 latency by service
 * 
 * fields @timestamp, service, metadata.durationMs
 * | filter metadata.performanceMetric = true
 * | stats pct(metadata.durationMs, 95) as p95_latency by service
 * 
 * 
 * Query 3: Count incidents by type
 * 
 * fields @timestamp, message, metadata.incidentType
 * | filter message = "Incident created successfully"
 * | stats count() by metadata.incidentType
 * 
 * 
 * Query 4: Find slow operations (> 1 second)
 * 
 * fields @timestamp, service, metadata.operation, metadata.durationMs
 * | filter metadata.performanceMetric = true and metadata.durationMs > 1000
 * | sort metadata.durationMs desc
 * | limit 50
 */

/**
 * Example: X-Ray trace annotations
 * 
 * Uncomment to use:
 * 
 * import * as AWSXRay from 'aws-xray-sdk-core';
 * 
 * async function annotatedOperation() {
 *   const segment = AWSXRay.getSegment();
 *   if (segment) {
 *     // Add annotations (indexed for filtering)
 *     segment.addAnnotation('userId', 'user-123');
 *     segment.addAnnotation('incidentType', 'tire');
 * 
 *     // Add metadata (not indexed, for context)
 *     segment.addMetadata('request', {
 *       location: { lat: 40.7128, lon: -74.006 },
 *       timestamp: new Date().toISOString(),
 *     });
 *   }
 * 
 *   // Perform operation
 *   await someOperation();
 * }
 * 
 * async function someOperation(): Promise<void> {
 *   // Simulate work
 *   await new Promise((resolve) => setTimeout(resolve, 100));
 * }
 */
