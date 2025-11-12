import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, SecretValue } from '@roadcall/utils';
import { secretsManager } from '@roadcall/aws-clients';
import Stripe from 'stripe';

interface StripeSecrets {
  apiKey: SecretValue;
  publishableKey: SecretValue;
}

// Cache Stripe client instance
let stripeClient: Stripe | null = null;
let stripeSecrets: StripeSecrets | null = null;

/**
 * Initialize Stripe client with secrets from Secrets Manager
 */
async function getStripeClient(): Promise<Stripe> {
  if (stripeClient && stripeSecrets) {
    return stripeClient;
  }

  const stage = process.env.STAGE || 'dev';
  const secretName = `roadcall/stripe/api-key-${stage}`;

  try {
    // Get secrets with caching enabled
    stripeSecrets = await secretsManager.getSecretJSON<StripeSecrets>(secretName);

    // Initialize Stripe with the secret API key
    stripeClient = new Stripe(stripeSecrets.apiKey.getValue(), {
      apiVersion: '2023-10-16',
      typescript: true,
    });

    logger.info('Stripe client initialized', {
      secretName,
      // Do NOT log the actual API key
    });

    return stripeClient;
  } catch (error) {
    logger.error('Failed to initialize Stripe client', error as Error, {
      secretName,
      // Error details are sanitized by createSafeError
    });
    throw error;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { paymentId } = JSON.parse(event.body || '{}');

    if (!paymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Payment ID is required',
          },
        }),
      };
    }

    // Get Stripe client (uses cached secrets)
    const stripe = await getStripeClient();

    // TODO: Fetch payment details from database
    // const payment = await getPaymentFromDB(paymentId);

    // Create Payment Intent with idempotency key
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: 10000, // $100.00 in cents
        currency: 'usd',
        metadata: {
          paymentId,
          source: 'roadcall-platform',
        },
      },
      {
        // Use idempotency key for safe retries
        idempotencyKey: `payment-${paymentId}`,
      }
    );

    logger.info('Payment intent created', {
      paymentId,
      paymentIntentId: paymentIntent.id,
      // Do NOT log sensitive payment details
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      }),
    };
  } catch (error) {
    logger.error('Payment processing failed', error as Error, {
      // Sanitized error logging
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to process payment',
          // Do NOT expose internal error details
        },
      }),
    };
  }
};
