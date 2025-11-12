import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, AuthorizationError } from '@roadcall/utils';
import { getDriverIncidents } from '../driver-service';

/**
 * Lambda handler for getting driver incident history
 * GET /drivers/{id}/incidents
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
      throw new AuthorizationError('You can only view your own incidents');
    }

    // Get pagination parameters
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 20;

    logger.info('Getting driver incidents', { driverId, limit });

    const result = await getDriverIncidents(driverId, limit);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        ...result,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Get driver incidents failed', error as Error, { requestId });

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
