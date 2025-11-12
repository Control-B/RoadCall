import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';

/**
 * Lambda handler for getting user notification preferences
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.pathParameters?.userId;

  logger.info('Get preferences request', { requestId, userId });

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

    const preferences = await notificationService.getUserPreferences(userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: preferences,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    logger.error('Failed to get preferences', error instanceof Error ? error : new Error(String(error)), { requestId, userId });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to get preferences',
          details: error?.message || 'Unknown error',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
