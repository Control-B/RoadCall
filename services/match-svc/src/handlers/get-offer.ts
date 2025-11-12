import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError, NotFoundError } from '@roadcall/utils';
import { getOfferById } from '../match-service';

/**
 * Lambda handler for GET /offers/{offerId}
 * Retrieves offer details
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

    logger.info('Get offer request', { offerId, requestId });

    const offer = await getOfferById(offerId);
    if (!offer) {
      throw new NotFoundError('Offer', offerId);
    }

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
    logger.error('Error getting offer', error as Error, { requestId });

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
  return 500;
}
