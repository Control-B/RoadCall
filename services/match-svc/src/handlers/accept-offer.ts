import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { acceptOffer } from '../match-service';

interface AcceptOfferRequest {
  vendorId: string;
}

/**
 * Lambda handler for POST /offers/{offerId}/accept
 * Allows vendor to accept an offer
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const offerId = event.pathParameters?.offerId;
    if (!offerId) {
      throw new ValidationError('Offer ID is required');
    }

    const body: AcceptOfferRequest = JSON.parse(event.body || '{}');
    if (!body.vendorId) {
      throw new ValidationError('Vendor ID is required');
    }

    logger.info('Accept offer request', { offerId, vendorId: body.vendorId, requestId });

    const result = await acceptOffer(offerId, body.vendorId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Error accepting offer', error as Error, { requestId });

    const statusCode = getErrorStatusCode(error as Error);
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: (error as Error).name,
          message: (error as Error).message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}

function getErrorStatusCode(error: Error): number {
  if (error.name === 'NotFoundError') return 404;
  if (error.name === 'ValidationError') return 400;
  if (error.name === 'ConflictError') return 409;
  return 500;
}
