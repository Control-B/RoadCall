import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, ValidationError, AuthorizationError } from '@roadcall/utils';
import { updateVendor } from '../vendor-service';
import { Vendor } from '@roadcall/types';

/**
 * Lambda handler for updating vendor profile
 * PATCH /vendors/{id}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const vendorId = event.pathParameters?.id;
    if (!vendorId) {
      throw new NotFoundError('Vendor', 'undefined');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Check authorization - vendors can only update their own profile, admins can update any
    if (role === 'vendor' && userId !== vendorId) {
      throw new AuthorizationError('You can only update your own profile');
    }

    const updates: Partial<Vendor> = JSON.parse(event.body);

    // Prevent updating sensitive fields
    delete (updates as any).vendorId;
    delete (updates as any).createdAt;
    delete (updates as any).rating;
    delete (updates as any).metrics;

    logger.info('Updating vendor profile', { vendorId });

    const vendor = await updateVendor(vendorId, updates);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        vendor,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Update vendor failed', error as Error, { requestId });

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
