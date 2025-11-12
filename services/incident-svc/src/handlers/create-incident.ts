import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { createIncident } from '../incident-service';
import { IncidentType } from '@roadcall/types';

interface CreateIncidentRequest {
  type: IncidentType;
  lat: number;
  lon: number;
}

/**
 * Lambda handler for creating incident
 * POST /incidents
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: CreateIncidentRequest = JSON.parse(event.body);

    // Validate required fields
    if (!body.type || body.lat === undefined || body.lon === undefined) {
      throw new ValidationError('Missing required fields: type, lat, lon');
    }

    // Get driver ID from authorizer context
    const driverId = event.requestContext.authorizer?.userId;
    if (!driverId) {
      throw new ValidationError('Driver ID not found in request context');
    }

    logger.info('Creating incident', { driverId, type: body.type, lat: body.lat, lon: body.lon });

    const incident = await createIncident(driverId, body.type, body.lat, body.lon);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        incident,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Create incident failed', error as Error, { requestId });

    const statusCode = (error as any).statusCode || 500;
    const message = (error as Error).message || 'Internal server error';

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
