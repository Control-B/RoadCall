import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { approvePayment } from '../payment-service';
import { logger, NotFoundError, ConflictError } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';

/**
 * Lambda handler for approving a payment
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

    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.claims?.sub;
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    // Check if user has permission to approve payments
    if (userRole !== 'dispatcher' && userRole !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions to approve payments' }),
      };
    }

    // Approve payment
    const payment = await approvePayment(paymentId, userId);

    // Publish PaymentApproved event
    await eventBridge.publishEvent({
      source: EventSources.PAYMENT_SERVICE,
      detailType: EventTypes.PAYMENT_APPROVED,
      detail: {
        paymentId: payment.paymentId,
        incidentId: payment.incidentId,
        vendorId: payment.vendorId,
        amountCents: payment.amountCents,
        approvedBy: userId,
        approvedAt: payment.approvedAt,
      },
    });

    logger.info('Payment approved via API', {
      paymentId,
      approvedBy: userId,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payment),
    };
  } catch (error: any) {
    logger.error('Error approving payment', error as Error);

    if (error instanceof NotFoundError) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (error instanceof ConflictError) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
