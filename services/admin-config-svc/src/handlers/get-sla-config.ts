import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { ConfigManager } from '../utils/config-manager';
import { CONFIG_KEYS, DEFAULT_SLA_CONFIG } from '../types/config';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Getting SLA tiers configuration', { event });

    // Get latest SLA configuration
    const config = await ConfigManager.getLatestConfig(CONFIG_KEYS.SLA_TIERS);

    if (!config) {
      // Return default configuration if none exists
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          config: DEFAULT_SLA_CONFIG,
          version: 0,
          isDefault: true,
          message: 'No custom configuration found, returning defaults',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        config: config.value,
        version: config.version,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt,
        isDefault: false,
      }),
    };
  } catch (error) {
    logger.error('Error getting SLA configuration', { error });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
