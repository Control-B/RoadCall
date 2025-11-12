import { EventBridgeEvent } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { createPayment, CreatePaymentInput } from '../payment-service';
import { logger } from '@roadcall/utils';

const APPROVAL_QUEUE_URL = process.env.APPROVAL_QUEUE_URL || '';
const sqsClient = new SQSClient({});

interface WorkCompletedDetail {
  incidentId: string;
  vendorId: string;
  driverId: string;
  completedAt: string;
  workDetails: {
    notes: string;
    photos: string[];
    serviceType: string;
    duration: number;
  };
  pricing: {
    basePrice: number;
    mileageCharge: number;
    additionalCharges?: Array<{
      description: string;
      amount: number;
    }>;
  };
}

/**
 * Lambda handler for WorkCompleted event
 * Creates payment record and routes to approval queue
 */
export async function handler(
  event: EventBridgeEvent<'WorkCompleted', WorkCompletedDetail>
): Promise<void> {
  try {
    const { incidentId, vendorId, pricing, workDetails } = event.detail;

    // Build line items from pricing
    const lineItems: CreatePaymentInput['lineItems'] = [
      {
        description: `${workDetails.serviceType} - Base Service`,
        quantity: 1,
        unitPriceCents: pricing.basePrice,
      },
      {
        description: 'Mileage Charge',
        quantity: 1,
        unitPriceCents: pricing.mileageCharge,
      },
    ];

    // Add additional charges if any
    if (pricing.additionalCharges) {
      for (const charge of pricing.additionalCharges) {
        lineItems.push({
          description: charge.description,
          quantity: 1,
          unitPriceCents: charge.amount,
        });
      }
    }

    // Calculate total amount
    const amountCents = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents,
      0
    );

    // Create payment record
    const paymentInput: CreatePaymentInput = {
      incidentId,
      vendorId,
      payerType: 'back_office', // Default to back office, can be updated based on driver type
      amountCents,
      currency: 'USD',
      lineItems,
      metadata: {
        workCompletedAt: event.detail.completedAt,
        serviceType: workDetails.serviceType,
        duration: workDetails.duration,
        photoCount: workDetails.photos.length,
      },
    };

    const payment = await createPayment(paymentInput, 'system', 'system');

    // Send to approval queue
    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: APPROVAL_QUEUE_URL,
        MessageBody: JSON.stringify({
          paymentId: payment.paymentId,
          incidentId,
          vendorId,
          amountCents,
          createdAt: payment.createdAt,
          workDetails,
        }),
        MessageAttributes: {
          paymentId: {
            DataType: 'String',
            StringValue: payment.paymentId,
          },
          incidentId: {
            DataType: 'String',
            StringValue: incidentId,
          },
          priority: {
            DataType: 'String',
            StringValue: 'normal',
          },
        },
      })
    );

    logger.info('Payment created from work completion', {
      paymentId: payment.paymentId,
      incidentId,
      vendorId,
      amountCents,
    });
  } catch (error) {
    logger.error('Error handling work completed event', error as Error, {
      incidentId: event.detail.incidentId,
    });
    throw error;
  }
}
