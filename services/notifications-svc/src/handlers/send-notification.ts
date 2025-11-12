import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { NotificationRequest } from '@roadcall/types';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';

/**
 * Lambda handler for sending notifications via API
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  logger.info('Send notification request', { requestId });

  try {
    const request: NotificationRequest = JSON.parse(event.body || '{}');

    // Validate request
    if (!request.type || !request.recipientId || !request.channels || request.channels.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Missing required fields: type, recipientId, channels',
            requestId,
            timestamp: new Date().toISOString(),
          },
        }),
      };
    }

    const log = await notificationService.sendNotification(request);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: {
          notificationId: log.notificationId,
          deliveryStatus: log.deliveryStatus,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    logger.error('Failed to send notification', error instanceof Error ? error : new Error(String(error)), { requestId });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to send notification',
          details: error?.message || 'Unknown error',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
