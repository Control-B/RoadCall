import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPendingApprovals } from '../payment-service';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for getting pending payment approvals
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get user context from authorizer
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];

    // Check if user has permission to view pending approvals
    if (userRole !== 'dispatcher' && userRole !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions to view pending approvals' }),
      };
    }

    // Parse query parameters
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 50;
    const offset = event.queryStringParameters?.offset
      ? parseInt(event.queryStringParameters.offset, 10)
      : 0;

    // Get pending approvals
    const payments = await getPendingApprovals(limit, offset);

    logger.info('Pending approvals retrieved', {
      count: payments.length,
      limit,
      offset,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payments,
        pagination: {
          limit,
          offset,
          count: payments.length,
        },
      }),
    };
  } catch (error: any) {
    logger.error('Error getting pending approvals', error as Error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
