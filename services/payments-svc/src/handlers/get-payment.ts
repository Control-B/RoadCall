import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPaymentById } from '../payment-service';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for getting a payment by ID
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const paymentId = event.pathParameters?.id;

    if (!paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Payment ID is required' }),
      };
    }

    const result = await getPaymentById(paymentId);

    if (!result) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Payment not found' }),
      };
    }

    logger.info('Payment retrieved', { paymentId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    };
  } catch (error: any) {
    logger.error('Error getting payment', error as Error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
