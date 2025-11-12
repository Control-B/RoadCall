import { EventBridgeEvent } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { eventBridge, EventSources } from '@roadcall/aws-clients';

interface PaymentCompletedDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  stripePaymentIntentId?: string;
  completedAt?: string;
}

/**
 * Lambda handler for PaymentCompleted events
 * Sends payment confirmation notifications to vendor
 */
export async function handler(
  event: EventBridgeEvent<'PaymentCompleted', PaymentCompletedDetail>
): Promise<void> {
  try {
    const { paymentId, incidentId, vendorId, amountCents, completedAt } = event.detail;

    logger.info('Processing PaymentCompleted event', {
      paymentId,
      incidentId,
      vendorId,
      amountCents,
    });

    // Publish notification event for vendor
    await eventBridge.publishEvent({
      source: EventSources.PAYMENT_SERVICE,
      detailType: 'SendNotification',
      detail: {
        type: 'payment_approved',
        recipientId: vendorId,
        recipientType: 'vendor',
        channels: ['push', 'sms', 'email'],
        priority: 'normal',
        data: {
          paymentId,
          incidentId,
          amountCents,
          amountFormatted: formatCurrency(amountCents),
          completedAt: completedAt || new Date().toISOString(),
        },
      },
    });

    logger.info('Payment confirmation notification sent', {
      paymentId,
      vendorId,
    });
  } catch (error) {
    logger.error('Error processing PaymentCompleted event', error as Error, {
      eventId: event.id,
    });
    throw error;
  }
}

/**
 * Format cents to currency string
 */
function formatCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
