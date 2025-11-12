import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, ValidationError, AuthorizationError } from '@roadcall/utils';
import { updateDriver } from '../driver-service';
import { Driver } from '@roadcall/types';

/**
 * Lambda handler for updating driver profile
 * PATCH /drivers/{id}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const driverId = event.pathParameters?.id;
    if (!driverId) {
      throw new NotFoundError('Driver', 'undefined');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Check authorization - drivers can only update their own profile
    if (role === 'driver' && userId !== driverId) {
      throw new AuthorizationError('You can only update your own profile');
    }

    const updates: Partial<Driver> = JSON.parse(event.body);

    // Prevent updating sensitive fields
    delete (updates as any).driverId;
    delete (updates as any).userId;
    delete (updates as any).createdAt;
    delete (updates as any).stats;

    logger.info('Updating driver profile', { driverId });

    const driver = await updateDriver(driverId, updates);

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
    logger.error('Update driver failed', error as Error, { requestId });

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
