import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';

/**
 * Lambda handler for getting notification history
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.pathParameters?.userId;
  const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
  const nextToken = event.queryStringParameters?.nextToken;

  logger.info('Get notification history request', { requestId, userId, limit });

  try {
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Missing userId parameter',
            requestId,
            timestamp: new Date().toISOString(),
          },
        }),
      };
    }

    const result = await notificationService.getNotificationHistory(userId, limit, nextToken);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          items: result.items,
          nextToken: result.nextToken,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    logger.error('Failed to get notification history', error instanceof Error ? error : new Error(String(error)), { requestId, userId });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to get notification history',
          details: error?.message || 'Unknown error',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
