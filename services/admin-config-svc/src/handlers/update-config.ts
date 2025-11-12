import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { ConfigManager } from '../utils/config-manager';
import { ConfigValidator, ConfigValidationError } from '../utils/validators';
import { CONFIG_KEYS, ConfigKey } from '../types/config';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });

/**
 * Generic configuration update handler
 * Supports updating any configuration type with validation
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Updating configuration', { event });

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
    const config: any = body.config;
    const reason: string | undefined = body.reason;

    // Validate config key
    if (!configKey || !Object.values(CONFIG_KEYS).includes(configKey)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: `Invalid config key. Must be one of: ${Object.values(CONFIG_KEYS).join(', ')}`,
        }),
      };
    }

    // Get user info from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub || 'unknown';
    const userName = event.requestContext.authorizer?.claims?.['cognito:username'] || 'unknown';

    // Validate configuration based on type
    try {
      switch (configKey) {
        case CONFIG_KEYS.MATCHING:
          ConfigValidator.validateMatchingConfig(config);
          break;
        case CONFIG_KEYS.SLA_TIERS:
          ConfigValidator.validateSLAConfig(config);
          break;
        case CONFIG_KEYS.PRICING:
          ConfigValidator.validatePricingConfig(config);
          break;
        case CONFIG_KEYS.GEOFENCES:
          ConfigValidator.validateGeofenceConfig(config);
          break;
        default:
          throw new Error(`Unsupported config key: ${configKey}`);
      }
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
      configKey,
      config,
      userId,
      userName,
      reason
    );

    logger.info('Configuration updated successfully', {
      configKey,
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
        configKey,
        config: updatedConfig.value,
        version: updatedConfig.version,
        updatedBy: updatedConfig.updatedBy,
        updatedAt: updatedConfig.updatedAt,
      }),
    };
  } catch (error) {
    logger.error('Error updating configuration', { error });

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
