import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, ValidationError, AuthorizationError } from '@roadcall/utils';
import { updateVendorAvailability } from '../vendor-service';
import { VendorAvailabilityStatus } from '@roadcall/types';

interface UpdateAvailabilityRequest {
  status: VendorAvailabilityStatus;
  currentIncidentId?: string;
}

/**
 * Lambda handler for updating vendor availability
 * PATCH /vendors/{id}/availability
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

    // Check authorization - vendors can only update their own availability
    if (role === 'vendor' && userId !== vendorId) {
      throw new AuthorizationError('You can only update your own availability');
    }

    const body: UpdateAvailabilityRequest = JSON.parse(event.body);

    if (!body.status) {
      throw new ValidationError('Status is required');
    }

    logger.info('Updating vendor availability', { vendorId, status: body.status });

    await updateVendorAvailability(vendorId, body.status, body.currentIncidentId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Availability updated successfully',
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Update vendor availability failed', error as Error, { requestId });

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
