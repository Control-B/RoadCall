import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, AuthorizationError } from '@roadcall/utils';
import { getDriverById } from '../driver-service';

/**
 * Lambda handler for getting driver profile
 * GET /drivers/{id}
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

    // Check authorization - drivers can only view their own profile, admins/dispatchers can view any
    if (role === 'driver' && userId !== driverId) {
      throw new AuthorizationError('You can only view your own profile');
    }

    logger.info('Getting driver profile', { driverId });

    const driver = await getDriverById(driverId);
    if (!driver) {
      throw new NotFoundError('Driver', driverId);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        driver,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Get driver failed', error as Error, { requestId });

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
