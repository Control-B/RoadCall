import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { ConfigManager } from '../utils/config-manager';
import { ConfigValidator, ConfigValidationError } from '../utils/validators';
import { CONFIG_KEYS, PricingConfig } from '../types/config';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Updating pricing configuration', { event });

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
    const config: PricingConfig = body.config;
    const reason: string | undefined = body.reason;

    // Get user info from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub || 'unknown';
    const userName = event.requestContext.authorizer?.claims?.['cognito:username'] || 'unknown';

    // Validate configuration
    try {
      ConfigValidator.validatePricingConfig(config);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: 'Validation Error',
            message: error.message,
          }),
        };
      }
      throw error;
    }

    // Update configuration
    const updatedConfig = await ConfigManager.updateConfig(
      CONFIG_KEYS.PRICING,
      config,
      userId,
      userName,
      reason
    );

    logger.info('Pricing configuration updated successfully', {
      version: updatedConfig.version,
      userId,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Configuration updated successfully',
        config: updatedConfig.value,
        version: updatedConfig.version,
        updatedBy: updatedConfig.updatedBy,
        updatedAt: updatedConfig.updatedAt,
      }),
    };
  } catch (error) {
    logger.error('Error updating pricing configuration', { error });

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
