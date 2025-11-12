import { EventBridgeEvent } from 'aws-lambda';
import { scoreFraudRisk, shouldFlagForManualReview } from '../fraud-service';
import { updatePayment, getPaymentById } from '../payment-service';
import { logger, NotFoundError } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const APPROVAL_QUEUE_URL = process.env.APPROVAL_QUEUE_URL!;

interface PaymentCreatedDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  status: string;
  payerType: 'back_office' | 'driver_ic';
  createdAt: string;
}

/**
 * Lambda handler for scoring fraud risk on payment creation
 * Triggered by PaymentCreated EventBridge event
 */
export async function handler(
  event: EventBridgeEvent<'PaymentCreated', PaymentCreatedDetail>
): Promise<void> {
  try {
    const { paymentId, incidentId, vendorId, amountCents, payerType } = event.detail;

    logger.info('Processing fraud detection for payment', {
      paymentId,
      incidentId,
      vendorId,
    });

    // Score fraud risk
    const fraudResult = await scoreFraudRisk({
      paymentId,
      incidentId,
      vendorId,
      amountCents,
      payerType,
    });

    // Update payment with fraud score and status
    await updatePayment(
      paymentId,
      {
        fraudScore: fraudResult.fraudScore,
        fraudStatus: fraudResult.fraudStatus,
        metadata: {
          fraudDetection: {
            riskLevel: fraudResult.riskLevel,
            reasons: fraudResult.reasons,
            modelScores: fraudResult.modelScores,
            ruleResults: fraudResult.ruleResults,
            scoredAt: new Date().toISOString(),
          },
        },
      },
      'fraud-detector',
      'system'
    );

    logger.info('Fraud score updated for payment', {
      paymentId,
      fraudScore: fraudResult.fraudScore,
      fraudStatus: fraudResult.fraudStatus,
    });

    // Check if payment should be flagged for manual review
    if (shouldFlagForManualReview(fraudResult)) {
      logger.warn('Payment flagged for manual review', {
        paymentId,
        fraudScore: fraudResult.fraudScore,
        reasons: fraudResult.reasons,
      });

      // Publish FraudDetected event
      await eventBridge.publishEvent({
        source: EventSources.PAYMENT_SERVICE,
        detailType: EventTypes.FRAUD_DETECTED,
        detail: {
          paymentId,
          incidentId,
          vendorId,
          fraudScore: fraudResult.fraudScore,
          fraudStatus: fraudResult.fraudStatus,
          reasons: fraudResult.reasons,
          flaggedAt: new Date().toISOString(),
        },
      });

      // Send to manual review queue with high priority
      await sendToManualReviewQueue(paymentId, fraudResult);
    } else {
      // Low/medium/high risk but not flagged - send to normal approval queue
      await sendToApprovalQueue(paymentId);
    }

    logger.info('Fraud detection completed successfully', {
      paymentId,
      fraudStatus: fraudResult.fraudStatus,
    });
  } catch (error) {
    logger.error('Error in fraud detection handler', error as Error, {
      paymentId: event.detail.paymentId,
    });

    // Don't throw - we don't want to retry fraud detection
    // Payment will remain in pending_approval and can be manually reviewed
  }
}

/**
 * Send payment to manual review queue (high priority)
 */
async function sendToManualReviewQueue(
  paymentId: string,
  fraudResult: any
): Promise<void> {
  try {
    // Get full payment details
    const paymentData = await getPaymentById(paymentId);

    if (!paymentData) {
      throw new NotFoundError('Payment', paymentId);
    }

    const message = {
      paymentId,
      priority: 'high',
      reason: 'fraud_flagged',
      fraudScore: fraudResult.fraudScore,
      fraudStatus: fraudResult.fraudStatus,
      fraudReasons: fraudResult.reasons,
      payment: paymentData.payment,
      lineItems: paymentData.lineItems,
      flaggedAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: APPROVAL_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        Priority: {
          DataType: 'String',
          StringValue: 'high',
        },
        Reason: {
          DataType: 'String',
          StringValue: 'fraud_flagged',
        },
        FraudScore: {
          DataType: 'Number',
          StringValue: fraudResult.fraudScore.toString(),
        },
      },
    });

    await sqsClient.send(command);

    logger.info('Payment sent to manual review queue', {
      paymentId,
      fraudScore: fraudResult.fraudScore,
    });
  } catch (error) {
    logger.error('Error sending payment to manual review queue', error as Error, {
      paymentId,
    });
    throw error;
  }
}

/**
 * Send payment to normal approval queue
 */
async function sendToApprovalQueue(paymentId: string): Promise<void> {
  try {
    // Get full payment details
    const paymentData = await getPaymentById(paymentId);

    if (!paymentData) {
      throw new NotFoundError('Payment', paymentId);
    }

    const message = {
      paymentId,
      priority: 'normal',
      reason: 'standard_approval',
      payment: paymentData.payment,
      lineItems: paymentData.lineItems,
      queuedAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: APPROVAL_QUEUE_URL,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        Priority: {
          DataType: 'String',
          StringValue: 'normal',
        },
        Reason: {
          DataType: 'String',
          StringValue: 'standard_approval',
        },
      },
    });

    await sqsClient.send(command);

    logger.info('Payment sent to approval queue', { paymentId });
  } catch (error) {
    logger.error('Error sending payment to approval queue', error as Error, {
      paymentId,
    });
    throw error;
  }
}
