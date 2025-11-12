import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { declineOffer } from '../match-service';

interface DeclineOfferRequest {
  vendorId: string;
  reason?: string;
}

/**
 * Lambda handler for POST /offers/{offerId}/decline
 * Allows vendor to decline an offer
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

    const body: DeclineOfferRequest = JSON.parse(event.body || '{}');
    if (!body.vendorId) {
      throw new ValidationError('Vendor ID is required');
    }

    logger.info('Decline offer request', {
      offerId,
      vendorId: body.vendorId,
      reason: body.reason,
      requestId,
    });

    const offer = await declineOffer(offerId, body.vendorId, body.reason);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: offer,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Error declining offer', error as Error, { requestId });

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
