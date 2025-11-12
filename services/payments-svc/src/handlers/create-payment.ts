import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createPayment, CreatePaymentInput } from '../payment-service';
import { logger, ValidationError } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';

/**
 * Lambda handler for creating a payment
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body is required' }),
      };
    }

    const input: CreatePaymentInput = JSON.parse(event.body);

    // Get user context from authorizer
    const userId = event.requestContext.authorizer?.claims?.sub || 'system';

    // Validate required fields
    if (!input.incidentId || !input.vendorId || !input.payerType) {
      throw new ValidationError('Missing required fields: incidentId, vendorId, payerType');
    }

    if (!input.lineItems || input.lineItems.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    // Create payment
    const payment = await createPayment(input, userId, 'system');

    // Publish PaymentCreated event
    await eventBridge.publishEvent({
      source: EventSources.PAYMENT_SERVICE,
      detailType: EventTypes.PAYMENT_CREATED,
      detail: {
        paymentId: payment.paymentId,
        incidentId: payment.incidentId,
        vendorId: payment.vendorId,
        amountCents: payment.amountCents,
        status: payment.status,
        payerType: payment.payerType,
        createdAt: payment.createdAt,
      },
    });

    logger.info('Payment created via API', {
      paymentId: payment.paymentId,
      incidentId: input.incidentId,
      userId,
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payment),
    };
  } catch (error: any) {
    logger.error('Error creating payment', error as Error);

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
