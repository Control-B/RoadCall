import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, AuthorizationError } from '@roadcall/utils';
import { getDriverPreferences } from '../driver-service';

/**
 * Lambda handler for getting driver preferences
 * GET /drivers/{id}/preferences
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const driverId = event.pathParameters?.id;
    if (!driverId) {
      throw new NotFoundError('Driver', 'undefined');
    }

    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Check authorization
    if (role === 'driver' && userId !== driverId) {
      throw new AuthorizationError('You can only view your own preferences');
    }

    logger.info('Getting driver preferences', { driverId });

    const preferences = await getDriverPreferences(driverId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        preferences,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Get driver preferences failed', error as Error, { requestId });

    const statusCode = (error as any).statusCode || 500;
    const message = (error as Error).message || 'Internal server error';

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
