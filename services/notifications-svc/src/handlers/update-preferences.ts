import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';
import { NotificationPreferences } from '../types';

/**
 * Lambda handler for updating user notification preferences
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  const userId = event.pathParameters?.userId;

  logger.info('Update preferences request', { requestId, userId });

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

    const updates: Partial<NotificationPreferences> = JSON.parse(event.body || '{}');

    // Get current preferences
    const currentPreferences = await notificationService.getUserPreferences(userId);

    // Merge updates
    const updatedPreferences: NotificationPreferences = {
      ...currentPreferences,
      ...updates,
      userId, // Ensure userId cannot be changed
      channels: {
        ...currentPreferences.channels,
        ...updates.channels,
      },
    };

    await notificationService.updateUserPreferences(updatedPreferences);

    return {
      statusCode: 200,
      body: JSON.stringify({
        data: updatedPreferences,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error: any) {
    logger.error('Failed to update preferences', error instanceof Error ? error : new Error(String(error)), { requestId, userId });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to update preferences',
          details: error?.message || 'Unknown error',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
