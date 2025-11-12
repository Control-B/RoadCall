import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { constructWebhookEvent } from '../stripe-service';
import { getPaymentById, updatePayment } from '../payment-service';
import { logger } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import Stripe from 'stripe';

/**
 * Lambda handler for Stripe webhook events
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get Stripe signature from headers
    const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

    if (!signature) {
      logger.warn('Missing Stripe signature header');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing Stripe signature' }),
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing request body' }),
      };
    }

    // Verify and construct webhook event
    const stripeEvent = await constructWebhookEvent(event.body, signature);

    logger.info('Received Stripe webhook', {
      eventId: stripeEvent.id,
      eventType: stripeEvent.type,
    });

    // Process the webhook event
    await handleWebhookEvent(stripeEvent);

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true, eventId: stripeEvent.id }),
    };
  } catch (error: any) {
    logger.error('Webhook processing error', error as Error);

    // Return 400 for signature verification failures
    if (error.message.includes('verification failed')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Webhook verification failed' }),
      };
    }

    // Return 500 for other errors but acknowledge receipt to Stripe
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Handle different types of Stripe webhook events
 */
async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.canceled':
      await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
      break;

    case 'payment_intent.requires_action':
      await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
      break;

    case 'transfer.created':
      await handleTransferCreated(event.data.object as Stripe.Transfer);
      break;

    case 'transfer.reversed':
      await handleTransferReversed(event.data.object as Stripe.Transfer);
      break;

    case 'payout.paid':
      await handlePayoutPaid(event.data.object as Stripe.Payout);
      break;

    case 'payout.failed':
      await handlePayoutFailed(event.data.object as Stripe.Payout);
      break;

    default:
      logger.info('Unhandled webhook event type', { eventType: event.type });
  }
}

/**
 * Handle successful payment intent
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const paymentId = paymentIntent.metadata.paymentId;

  if (!paymentId) {
    logger.warn('Payment Intent missing paymentId in metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  logger.info('Payment Intent succeeded', {
    paymentIntentId: paymentIntent.id,
    paymentId,
    amount: paymentIntent.amount,
  });

  // Get payment
  const paymentData = await getPaymentById(paymentId);

  if (!paymentData) {
    logger.warn('Payment not found for Payment Intent', {
      paymentId,
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  const { payment } = paymentData;

  // Update payment status
  if (payment.status === 'processing') {
    const updatedPayment = await updatePayment(
      paymentId,
      {
        status: 'completed',
        stripePaymentIntentId: paymentIntent.id,
      },
      'stripe_webhook',
      'system'
    );

    // Publish PaymentCompleted event
    await eventBridge.publishEvent({
      source: EventSources.PAYMENT_SERVICE,
      detailType: EventTypes.PAYMENT_COMPLETED,
      detail: {
        paymentId: updatedPayment.paymentId,
        incidentId: updatedPayment.incidentId,
        vendorId: updatedPayment.vendorId,
        amountCents: updatedPayment.amountCents,
        stripePaymentIntentId: updatedPayment.stripePaymentIntentId,
        completedAt: updatedPayment.processedAt,
      },
    });

    logger.info('Payment marked as completed', { paymentId });
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const paymentId = paymentIntent.metadata.paymentId;

  if (!paymentId) {
    logger.warn('Payment Intent missing paymentId in metadata', {
      paymentIntentId: paymentIntent.id,
    });
    return;
  }

  logger.warn('Payment Intent failed', {
    paymentIntentId: paymentIntent.id,
    paymentId,
    failureMessage: paymentIntent.last_payment_error?.message,
  });

  // Get payment
  const paymentData = await getPaymentById(paymentId);

  if (!paymentData) {
    return;
  }

  const { payment } = paymentData;

  // Update payment status
  if (payment.status === 'processing') {
    const updatedPayment = await updatePayment(
      paymentId,
      {
        status: 'failed',
        stripePaymentIntentId: paymentIntent.id,
        failedReason: paymentIntent.last_payment_error?.message || 'Payment failed',
      },
      'stripe_webhook',
      'system'
    );

    // Publish PaymentFailed event
    await eventBridge.publishEvent({
      source: EventSources.PAYMENT_SERVICE,
      detailType: EventTypes.PAYMENT_FAILED,
      detail: {
        paymentId: updatedPayment.paymentId,
        incidentId: updatedPayment.incidentId,
        vendorId: updatedPayment.vendorId,
        failedReason: updatedPayment.failedReason,
      },
    });

    logger.info('Payment marked as failed', { paymentId });
  }
}

/**
 * Handle canceled payment intent
 */
async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const paymentId = paymentIntent.metadata.paymentId;

  if (!paymentId) {
    return;
  }

  logger.info('Payment Intent canceled', {
    paymentIntentId: paymentIntent.id,
    paymentId,
  });

  // Update payment status
  await updatePayment(
    paymentId,
    {
      status: 'cancelled',
      stripePaymentIntentId: paymentIntent.id,
    },
    'stripe_webhook',
    'system'
  );
}

/**
 * Handle payment intent requiring action
 */
async function handlePaymentIntentRequiresAction(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const paymentId = paymentIntent.metadata.paymentId;

  if (!paymentId) {
    return;
  }

  logger.info('Payment Intent requires action', {
    paymentIntentId: paymentIntent.id,
    paymentId,
    nextAction: paymentIntent.next_action?.type,
  });

  // Publish event for client to handle
  await eventBridge.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: 'PaymentRequiresAction',
    detail: {
      paymentId,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      nextAction: paymentIntent.next_action?.type,
    },
  });
}

/**
 * Handle transfer created
 */
async function handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
  const paymentId = transfer.metadata.paymentId;

  if (!paymentId) {
    logger.warn('Transfer missing paymentId in metadata', {
      transferId: transfer.id,
    });
    return;
  }

  logger.info('Transfer created', {
    transferId: transfer.id,
    paymentId,
    amount: transfer.amount,
    destination: transfer.destination,
  });

  // Update payment with transfer ID
  await updatePayment(
    paymentId,
    {
      stripePaymentIntentId: transfer.id,
    },
    'stripe_webhook',
    'system'
  );
}

/**
 * Handle reversed transfer
 */
async function handleTransferReversed(transfer: Stripe.Transfer): Promise<void> {
  const paymentId = transfer.metadata.paymentId;

  if (!paymentId) {
    return;
  }

  logger.warn('Transfer reversed', {
    transferId: transfer.id,
    paymentId,
  });

  // Publish event for manual review
  await eventBridge.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: 'PaymentTransferReversed',
    detail: {
      paymentId,
      transferId: transfer.id,
      amount: transfer.amount,
    },
  });
}

/**
 * Handle successful payout
 */
async function handlePayoutPaid(payout: Stripe.Payout): Promise<void> {
  logger.info('Payout paid', {
    payoutId: payout.id,
    amount: payout.amount,
    destination: payout.destination,
  });

  // Log for audit purposes
  // Payouts are typically not linked to individual payments
}

/**
 * Handle failed payout
 */
async function handlePayoutFailed(payout: Stripe.Payout): Promise<void> {
  logger.error('Payout failed', new Error(payout.failure_message || 'Unknown error'), {
    payoutId: payout.id,
    amount: payout.amount,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
  });

  // Publish event for manual review
  await eventBridge.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: 'PayoutFailed',
    detail: {
      payoutId: payout.id,
      amount: payout.amount,
      failureCode: payout.failure_code,
      failureMessage: payout.failure_message,
    },
  });
}
