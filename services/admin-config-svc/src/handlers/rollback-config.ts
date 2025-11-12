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
    logger.info('Rolling back configuration', { event });

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Request body is required',
        }),
      };
    }

    const body = JSON.parse(event.body);
    const configKey: ConfigKey = body.configKey;
    const targetVersion: number = body.targetVersion;
    const reason: string | undefined = body.reason;

    if (!configKey || typeof configKey !== 'string') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'configKey is required and must be a string',
        }),
      };
    }

    if (!targetVersion || typeof targetVersion !== 'number') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'targetVersion is required and must be a number',
        }),
      };
    }

    // Get user info from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub || 'unknown';
    const userName = event.requestContext.authorizer?.claims?.['cognito:username'] || 'unknown';

    // Perform rollback
    try {
      const rolledBackConfig = await ConfigManager.rollbackConfig(
        configKey,
        targetVersion,
        userId,
        userName,
        reason
      );

      logger.info('Configuration rolled back successfully', {
        configKey,
        targetVersion,
        newVersion: rolledBackConfig.version,
        userId,
      });

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          message: `Configuration rolled back to version ${targetVersion}`,
          config: rolledBackConfig.value,
          version: rolledBackConfig.version,
          rolledBackFrom: targetVersion,
          updatedBy: rolledBackConfig.updatedBy,
          updatedAt: rolledBackConfig.updatedAt,
        }),
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Not Found',
            message: error.message,
          }),
        };
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error rolling back configuration', { error });

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
