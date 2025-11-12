import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, AuthorizationError } from '@roadcall/utils';
import { getIncidentById } from '../incident-service';

/**
 * Lambda handler for getting incident
 * GET /incidents/{id}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) {
      throw new NotFoundError('Incident', 'undefined');
    }

    logger.info('Getting incident', { incidentId });

    const incident = await getIncidentById(incidentId);
    if (!incident) {
      throw new NotFoundError('Incident', incidentId);
    }

    // Check authorization
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Drivers can only view their own incidents, vendors can view assigned incidents
    if (role === 'driver' && incident.driverId !== userId) {
      throw new AuthorizationError('You can only view your own incidents');
    }
    if (role === 'vendor' && incident.assignedVendorId !== userId) {
      throw new AuthorizationError('You can only view incidents assigned to you');
    }

    return {
      statusCode: 200,
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
    logger.error('Get incident failed', error as Error, { requestId });

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
