import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { ConfigManager } from '../utils/config-manager';
import { ConfigKey } from '../types/config';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Getting configuration', { event });

    const configKey = event.queryStringParameters?.configKey as ConfigKey;
    const includeHistory = event.queryStringParameters?.includeHistory === 'true';

    if (!configKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'configKey query parameter is required',
        }),
      };
    }

    // Get latest configuration
    const config = await ConfigManager.getLatestConfig(configKey);

    if (!config) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Not Found',
          message: `Configuration for key "${configKey}" not found`,
        }),
      };
    }

    const response: any = {
      config: config.value,
      version: config.version,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt,
    };

    // Include audit history if requested
    if (includeHistory) {
      const history = await ConfigManager.getAuditHistory(configKey, 20);
      response.history = history;
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Error getting configuration', { error });

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
