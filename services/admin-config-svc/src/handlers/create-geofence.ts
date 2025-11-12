import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { v4 as uuidv4 } from 'uuid';
import { ConfigManager } from '../utils/config-manager';
import { ConfigValidator, ConfigValidationError } from '../utils/validators';
import { CONFIG_KEYS, GeofenceConfig } from '../types/config';

const logger = new Logger({ serviceName: 'admin-config-svc' });
const tracer = new Tracer({ serviceName: 'admin-config-svc' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    logger.info('Creating geofence configuration', { event });

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
    
    // Get user info from Cognito authorizer
    const userId = event.requestContext.authorizer?.claims?.sub || 'unknown';
    const userName = event.requestContext.authorizer?.claims?.['cognito:username'] || 'unknown';

    // Create geofence config
    const timestamp = new Date().toISOString();
    const geofenceConfig: GeofenceConfig = {
      geofenceId: body.geofenceId || uuidv4(),
      name: body.name,
      description: body.description,
      polygon: body.polygon,
      region: body.region,
      active: body.active !== undefined ? body.active : true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Validate configuration
    try {
      ConfigValidator.validateGeofenceConfig(geofenceConfig);
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

    // Get existing geofences
    const existingConfig = await ConfigManager.getLatestConfig(CONFIG_KEYS.GEOFENCES);
    const geofences = existingConfig?.value?.geofences || [];

    // Check for duplicate geofence ID
    if (geofences.some((g: GeofenceConfig) => g.geofenceId === geofenceConfig.geofenceId)) {
      return {
        statusCode: 409,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Conflict',
          message: `Geofence with ID ${geofenceConfig.geofenceId} already exists`,
        }),
      };
    }

    // Add new geofence to the list
    geofences.push(geofenceConfig);

    // Update configuration
    const updatedConfig = await ConfigManager.updateConfig(
      CONFIG_KEYS.GEOFENCES,
      { geofences },
      userId,
      userName,
      `Created geofence: ${geofenceConfig.name}`
    );

    logger.info('Geofence created successfully', {
      geofenceId: geofenceConfig.geofenceId,
      version: updatedConfig.version,
      userId,
    });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Geofence created successfully',
        geofence: geofenceConfig,
        version: updatedConfig.version,
      }),
    };
  } catch (error) {
    logger.error('Error creating geofence', { error });

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
