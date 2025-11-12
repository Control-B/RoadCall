import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, AuthenticationError } from '@roadcall/utils';
import { verifyToken } from '../jwt-service';
import { getUserById } from '../user-service';

/**
 * Lambda handler for getting current user
 * GET /auth/me
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Get token from Authorization header
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token
    const payload = await verifyToken(token);

    // Get user
    const user = await getUserById(payload.userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    logger.info('User profile retrieved', { userId: user.userId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        user: {
          userId: user.userId,
          phone: user.phone,
          role: user.role,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
          truckNumber: user.truckNumber,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Get user profile failed', error as Error, { requestId });

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
