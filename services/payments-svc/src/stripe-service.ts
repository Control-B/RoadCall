import Stripe from 'stripe';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger, ValidationError, stripeCircuitBreaker } from '@roadcall/utils';
import { Payment } from './payment-service';

// ========================================================================
// Types
// ========================================================================

export interface StripeConfig {
  apiKey: string;
  webhookSecret: string;
  connectEnabled: boolean;
}

export interface CreatePaymentIntentInput {
  amountCents: number;
  currency: string;
  paymentId: string;
  incidentId: string;
  vendorId: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

export interface CreateConnectTransferInput {
  amountCents: number;
  currency: string;
  paymentId: string;
  vendorStripeAccountId: string;
  metadata?: Record<string, string>;
}

export interface ProcessPaymentResult {
  success: boolean;
  paymentIntentId?: string;
  transferId?: string;
  error?: string;
  requiresAction?: boolean;
  clientSecret?: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
}

// ========================================================================
// Stripe Client Singleton
// ========================================================================

let stripeClient: Stripe | null = null;
let stripeConfig: StripeConfig | null = null;
const secretsClient = new SecretsManagerClient({});

/**
 * Initialize Stripe client with API key from Secrets Manager
 */
async function getStripeClient(): Promise<Stripe> {
  if (stripeClient) {
    return stripeClient;
  }

  if (!stripeConfig) {
    stripeConfig = await loadStripeConfig();
  }

  stripeClient = new Stripe(stripeConfig.apiKey, {
    apiVersion: '2023-10-16',
    typescript: true,
    maxNetworkRetries: 3,
    timeout: 30000,
  });

  logger.info('Stripe client initialized');
  return stripeClient;
}

/**
 * Load Stripe configuration from Secrets Manager
 */
async function loadStripeConfig(): Promise<StripeConfig> {
  const secretName = process.env.STRIPE_SECRET_NAME || 'roadcall/stripe/api-keys';

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);

    return {
      apiKey: secret.apiKey || secret.STRIPE_API_KEY,
      webhookSecret: secret.webhookSecret || secret.STRIPE_WEBHOOK_SECRET,
      connectEnabled: secret.connectEnabled !== false,
    };
  } catch (error) {
    logger.error('Failed to load Stripe configuration from Secrets Manager', error as Error);
    throw new Error('Failed to initialize Stripe: configuration not available');
  }
}

/**
 * Reload Stripe configuration (for secret rotation)
 */
export async function reloadStripeConfig(): Promise<void> {
  stripeConfig = null;
  stripeClient = null;
  logger.info('Stripe configuration reloaded');
}

// ========================================================================
// Payment Intent Operations (IC Driver Payments)
// ========================================================================

/**
 * Create a Payment Intent for IC driver payment
 * Protected by circuit breaker
 */
export async function createPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<Stripe.PaymentIntent> {
  return stripeCircuitBreaker.execute(async () => {
    const stripe = await getStripeClient();

    try {
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          customer: input.customerId,
          metadata: {
            paymentId: input.paymentId,
            incidentId: input.incidentId,
            vendorId: input.vendorId,
            ...input.metadata,
          },
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          // Idempotency key to prevent duplicate charges
          idempotencyKey: `payment_${input.paymentId}`,
        }
      );

      logger.info('Payment Intent created', {
        paymentIntentId: paymentIntent.id,
        paymentId: input.paymentId,
        amountCents: input.amountCents,
      });

      return paymentIntent;
    } catch (error: any) {
      logger.error('Failed to create Payment Intent', error as Error, {
        paymentId: input.paymentId,
        amountCents: input.amountCents,
      });
      throw new Error(`Stripe Payment Intent creation failed: ${error.message}`);
    }
  });
}

/**
 * Confirm a Payment Intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId?: string
): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeClient();

  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    logger.info('Payment Intent confirmed', {
      paymentIntentId,
      status: paymentIntent.status,
    });

    return paymentIntent;
  } catch (error: any) {
    logger.error('Failed to confirm Payment Intent', error as Error, {
      paymentIntentId,
    });
    throw new Error(`Stripe Payment Intent confirmation failed: ${error.message}`);
  }
}

/**
 * Retrieve a Payment Intent
 */
export async function getPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeClient();

  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error: any) {
    logger.error('Failed to retrieve Payment Intent', error as Error, {
      paymentIntentId,
    });
    throw new Error(`Failed to retrieve Payment Intent: ${error.message}`);
  }
}

/**
 * Cancel a Payment Intent
 */
export async function cancelPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  const stripe = await getStripeClient();

  try {
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

    logger.info('Payment Intent cancelled', { paymentIntentId });

    return paymentIntent;
  } catch (error: any) {
    logger.error('Failed to cancel Payment Intent', error as Error, {
      paymentIntentId,
    });
    throw new Error(`Failed to cancel Payment Intent: ${error.message}`);
  }
}

// ========================================================================
// Stripe Connect Operations (Vendor Payouts)
// ========================================================================

/**
 * Create a transfer to vendor's Stripe Connect account
 * Protected by circuit breaker
 */
export async function createConnectTransfer(
  input: CreateConnectTransferInput
): Promise<Stripe.Transfer> {
  return stripeCircuitBreaker.execute(async () => {
    const stripe = await getStripeClient();

    if (!stripeConfig?.connectEnabled) {
      throw new Error('Stripe Connect is not enabled');
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: input.amountCents,
          currency: input.currency.toLowerCase(),
          destination: input.vendorStripeAccountId,
          metadata: {
            paymentId: input.paymentId,
            ...input.metadata,
          },
        },
        {
          // Idempotency key to prevent duplicate transfers
          idempotencyKey: `transfer_${input.paymentId}`,
        }
      );

      logger.info('Stripe Connect transfer created', {
        transferId: transfer.id,
        paymentId: input.paymentId,
        amountCents: input.amountCents,
        destination: input.vendorStripeAccountId,
      });

      return transfer;
    } catch (error: any) {
      logger.error('Failed to create Stripe Connect transfer', error as Error, {
        paymentId: input.paymentId,
        vendorStripeAccountId: input.vendorStripeAccountId,
      });
      throw new Error(`Stripe Connect transfer failed: ${error.message}`);
    }
  });
}

/**
 * Retrieve a transfer
 */
export async function getTransfer(transferId: string): Promise<Stripe.Transfer> {
  const stripe = await getStripeClient();

  try {
    return await stripe.transfers.retrieve(transferId);
  } catch (error: any) {
    logger.error('Failed to retrieve transfer', error as Error, { transferId });
    throw new Error(`Failed to retrieve transfer: ${error.message}`);
  }
}

/**
 * Create a payout to vendor's bank account
 */
export async function createPayout(
  amountCents: number,
  currency: string,
  vendorStripeAccountId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Payout> {
  const stripe = await getStripeClient();

  try {
    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: currency.toLowerCase(),
        metadata,
      },
      {
        stripeAccount: vendorStripeAccountId,
      }
    );

    logger.info('Payout created', {
      payoutId: payout.id,
      amountCents,
      vendorStripeAccountId,
    });

    return payout;
  } catch (error: any) {
    logger.error('Failed to create payout', error as Error, {
      vendorStripeAccountId,
      amountCents,
    });
    throw new Error(`Payout creation failed: ${error.message}`);
  }
}

// ========================================================================
// Webhook Handling
// ========================================================================

/**
 * Verify and construct webhook event from raw body and signature
 */
export async function constructWebhookEvent(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = await getStripeClient();

  if (!stripeConfig) {
    throw new Error('Stripe configuration not loaded');
  }

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      stripeConfig.webhookSecret
    );

    logger.info('Webhook event verified', {
      eventId: event.id,
      eventType: event.type,
    });

    return event;
  } catch (error: any) {
    logger.error('Webhook signature verification failed', error as Error);
    throw new Error(`Webhook verification failed: ${error.message}`);
  }
}

/**
 * Process webhook event
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<WebhookEvent> {
  logger.info('Processing webhook event', {
    eventId: event.id,
    eventType: event.type,
  });

  return {
    id: event.id,
    type: event.type,
    data: event.data.object,
  };
}

// ========================================================================
// Retry Logic with Exponential Backoff
// ========================================================================

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Execute a function with exponential backoff retry
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 10000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        logger.warn('Client error, not retrying', {
          statusCode: error.statusCode,
          message: error.message,
        });
        throw error;
      }

      if (attempt < maxRetries) {
        // Add jitter (±25%)
        const jitter = delayMs * 0.25 * (Math.random() * 2 - 1);
        const actualDelay = Math.min(delayMs + jitter, maxDelayMs);

        logger.warn('Retrying after error', {
          attempt: attempt + 1,
          maxRetries,
          delayMs: actualDelay,
          error: error.message,
        });

        await sleep(actualDelay);
        delayMs *= backoffMultiplier;
      }
    }
  }

  logger.error('Max retries exceeded', lastError!);
  throw lastError;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========================================================================
// High-Level Payment Processing
// ========================================================================

/**
 * Process payment based on payer type
 */
export async function processPayment(
  payment: Payment,
  vendorStripeAccountId?: string
): Promise<ProcessPaymentResult> {
  try {
    if (payment.payerType === 'driver_ic') {
      // IC driver payment via Payment Intent
      return await withRetry(async () => {
        const paymentIntent = await createPaymentIntent({
          amountCents: payment.amountCents,
          currency: payment.currency,
          paymentId: payment.paymentId,
          incidentId: payment.incidentId,
          vendorId: payment.vendorId,
          customerId: payment.payerId,
          metadata: {
            payerType: payment.payerType,
          },
        });

        return {
          success: paymentIntent.status === 'succeeded',
          paymentIntentId: paymentIntent.id,
          requiresAction: paymentIntent.status === 'requires_action',
          clientSecret: paymentIntent.client_secret || undefined,
        };
      });
    } else if (payment.payerType === 'back_office') {
      // Back office payment via Stripe Connect transfer
      if (!vendorStripeAccountId) {
        throw new ValidationError('Vendor Stripe account ID is required for back office payments');
      }

      return await withRetry(async () => {
        const transfer = await createConnectTransfer({
          amountCents: payment.amountCents,
          currency: payment.currency,
          paymentId: payment.paymentId,
          vendorStripeAccountId,
          metadata: {
            incidentId: payment.incidentId,
            vendorId: payment.vendorId,
          },
        });

        return {
          success: true,
          transferId: transfer.id,
        };
      });
    } else {
      throw new ValidationError(`Unsupported payer type: ${payment.payerType}`);
    }
  } catch (error: any) {
    logger.error('Payment processing failed', error as Error, {
      paymentId: payment.paymentId,
      payerType: payment.payerType,
    });

    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Refund a payment
 */
export async function refundPayment(
  paymentIntentId: string,
  amountCents?: number,
  reason?: string
): Promise<Stripe.Refund> {
  const stripe = await getStripeClient();

  try {
    const refund = await withRetry(async () => {
      return await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });
    });

    logger.info('Refund created', {
      refundId: refund.id,
      paymentIntentId,
      amountCents: refund.amount,
    });

    return refund;
  } catch (error: any) {
    logger.error('Failed to create refund', error as Error, {
      paymentIntentId,
    });
    throw new Error(`Refund creation failed: ${error.message}`);
  }
}
