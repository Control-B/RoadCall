import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { refreshAccessToken } from '../jwt-service';

interface RefreshRequest {
  refreshToken: string;
}

/**
 * Lambda handler for token refresh
 * POST /auth/refresh
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: RefreshRequest = JSON.parse(event.body);

    // Validate required fields
    if (!body.refreshToken) {
      throw new ValidationError('Missing required field: refreshToken');
    }

    logger.info('Token refresh initiated');

    // Refresh tokens
    const tokens = await refreshAccessToken(body.refreshToken);

    logger.info('Tokens refreshed successfully');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        tokens,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Token refresh failed', error as Error, { requestId });

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
