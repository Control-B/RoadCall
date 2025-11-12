/**
 * Health Check Handler for Payments Service
 * 
 * Provides liveness, readiness, and detailed health endpoints
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  HealthCheckManager,
  createHealthCheckHandler,
  createEnvVarHealthCheck,
  createMemoryHealthCheck,
  HealthStatus,
} from '@roadcall/utils';
import { logger } from '@roadcall/utils';

// Initialize health check manager
const healthManager = new HealthCheckManager({
  serviceName: 'payments-svc',
  version: process.env.SERVICE_VERSION || '1.0.0',
  checks: [
    // Check required environment variables
    createEnvVarHealthCheck([
      'PAYMENTS_TABLE_NAME',
      'STRIPE_SECRET_KEY',
      'FRAUD_DETECTOR_NAME',
    ]),
    
    // Check memory usage
    createMemoryHealthCheck(90),
    
    // Check database connection
    {
      name: 'database-connection',
      check: async () => {
        try {
          // Simple query to check database connectivity
          const { Pool } = await import('pg');
          const pool = new Pool({
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            max: 1,
            connectionTimeoutMillis: 5000,
          });
          
          const client = await pool.connect();
          await client.query('SELECT 1');
          client.release();
          await pool.end();
          
          return { healthy: true, message: 'Database connection successful' };
        } catch (error) {
          return {
            healthy: false,
            message: error instanceof Error ? error.message : 'Database check failed',
          };
        }
      },
      critical: true,
    },
    
    // Check Stripe API connectivity
    {
      name: 'stripe-api',
      check: async () => {
        try {
          // Simple Stripe API call to verify connectivity
          const stripe = (await import('stripe')).default;
          const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY || '', {
            apiVersion: '2023-10-16',
            timeout: 5000,
          });
          
          // List balance transactions (lightweight call)
          await stripeClient.balanceTransactions.list({ limit: 1 });
          
          return { healthy: true, message: 'Stripe API accessible' };
        } catch (error) {
          return {
            healthy: false,
            message: error instanceof Error ? error.message : 'Stripe API check failed',
          };
        }
      },
      critical: false, // Non-critical - circuit breaker will handle failures
    },
  ],
});

const handlers = createHealthCheckHandler(healthManager);

/**
 * Liveness probe - checks if service is running
 */
export const liveness = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    return await handlers.liveness();
  } catch (error) {
    logger.error('Liveness check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alive: false }),
    };
  }
};

/**
 * Readiness probe - checks if service is ready to accept traffic
 */
export const readiness = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    return await handlers.readiness();
  } catch (error) {
    logger.error('Readiness check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: HealthStatus.UNHEALTHY,
        message: 'Service not ready',
      }),
    };
  }
};

/**
 * Detailed health check - includes all dependency checks
 */
export const health = async (
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    return await handlers.health();
  } catch (error) {
    logger.error('Health check failed', error instanceof Error ? error : new Error(String(error)));
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: HealthStatus.UNHEALTHY,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
