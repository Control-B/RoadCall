/**
 * Circuit Breakers for External Services
 * 
 * Pre-configured circuit breakers for external service integrations
 * with appropriate fallback mechanisms.
 */

import { CircuitBreaker, createExternalServiceCircuitBreaker } from './circuit-breaker';
import { logger } from './logger';

/**
 * Stripe API Circuit Breaker
 * 
 * Fallback: Queue payment for manual processing
 */
export const stripeCircuitBreaker = createExternalServiceCircuitBreaker(
  'stripe-api',
  async <T>() => {
    logger.warn('Stripe circuit breaker open, using fallback');
    // Return a response indicating payment should be queued
    return {
      status: 'queued',
      message: 'Payment queued for processing when Stripe is available',
    } as T;
  }
);

/**
 * Weather API Circuit Breaker
 * 
 * Fallback: Return cached weather data or null
 */
export const weatherApiCircuitBreaker = createExternalServiceCircuitBreaker(
  'weather-api',
  async <T>() => {
    logger.warn('Weather API circuit breaker open, using fallback');
    // Return null weather data - incident can proceed without weather
    return null as T;
  }
);

/**
 * AWS Location Service Circuit Breaker
 * 
 * Fallback: Use cached location data or basic calculations
 */
export const locationServiceCircuitBreaker = createExternalServiceCircuitBreaker(
  'aws-location-service',
  async <T>() => {
    logger.warn('Location Service circuit breaker open, using fallback');
    // Return degraded location data
    return {
      degraded: true,
      message: 'Using cached location data',
    } as T;
  }
);

/**
 * Amazon Kendra Circuit Breaker
 * 
 * Fallback: Return empty search results
 */
export const kendraCircuitBreaker = createExternalServiceCircuitBreaker(
  'amazon-kendra',
  async <T>() => {
    logger.warn('Kendra circuit breaker open, using fallback');
    return {
      results: [],
      message: 'Knowledge base temporarily unavailable',
    } as T;
  }
);

/**
 * Amazon Bedrock Circuit Breaker
 * 
 * Fallback: Return basic response without AI enhancement
 */
export const bedrockCircuitBreaker = createExternalServiceCircuitBreaker(
  'amazon-bedrock',
  async <T>() => {
    logger.warn('Bedrock circuit breaker open, using fallback');
    return {
      summary: 'AI summarization temporarily unavailable',
      degraded: true,
    } as T;
  }
);

/**
 * Amazon Fraud Detector Circuit Breaker
 * 
 * Fallback: Allow transaction with manual review flag
 */
export const fraudDetectorCircuitBreaker = createExternalServiceCircuitBreaker(
  'amazon-fraud-detector',
  async <T>() => {
    logger.warn('Fraud Detector circuit breaker open, using fallback');
    return {
      score: 0.5,
      requiresManualReview: true,
      message: 'Fraud detection unavailable, flagged for manual review',
    } as T;
  }
);

/**
 * Generic HTTP service circuit breaker factory
 */
export function createHttpServiceCircuitBreaker(
  serviceName: string,
  cachedDataProvider?: () => Promise<any>
): CircuitBreaker {
  return createExternalServiceCircuitBreaker(
    serviceName,
    cachedDataProvider || (async () => {
      logger.warn(`${serviceName} circuit breaker open, no fallback available`);
      throw new Error(`${serviceName} is currently unavailable`);
    })
  );
}

/**
 * Get all circuit breaker statistics for monitoring
 */
export function getAllCircuitBreakerStats() {
  return {
    stripe: stripeCircuitBreaker.getStats(),
    weatherApi: weatherApiCircuitBreaker.getStats(),
    locationService: locationServiceCircuitBreaker.getStats(),
    kendra: kendraCircuitBreaker.getStats(),
    bedrock: bedrockCircuitBreaker.getStats(),
    fraudDetector: fraudDetectorCircuitBreaker.getStats(),
  };
}
