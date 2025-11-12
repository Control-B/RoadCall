import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, ValidationError, AuthorizationError } from '@roadcall/utils';
import { updateIncidentStatus, getIncidentById } from '../incident-service';
import { IncidentStatus } from '@roadcall/types';

interface UpdateStatusRequest {
  status: IncidentStatus;
  reason?: string;
}

/**
 * Lambda handler for updating incident status
 * PATCH /incidents/{id}/status
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) {
      throw new NotFoundError('Incident', 'undefined');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: UpdateStatusRequest = JSON.parse(event.body);

    if (!body.status) {
      throw new ValidationError('Status is required');
    }

    // Get user context
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Check authorization
    const incident = await getIncidentById(incidentId);
    if (!incident) {
      throw new NotFoundError('Incident', incidentId);
    }

    // Only vendors can update status (except cancellation)
    if (body.status !== 'cancelled' && role !== 'vendor' && role !== 'admin') {
      throw new AuthorizationError('Only vendors can update incident status');
    }

    // Vendors can only update their assigned incidents
    if (role === 'vendor' && incident.assignedVendorId !== userId) {
      throw new AuthorizationError('You can only update incidents assigned to you');
    }

    // Drivers can only cancel their own incidents
    if (body.status === 'cancelled' && role === 'driver' && incident.driverId !== userId) {
      throw new AuthorizationError('You can only cancel your own incidents');
    }

    logger.info('Updating incident status', { incidentId, status: body.status });

    const updatedIncident = await updateIncidentStatus(
      incidentId,
      body.status,
      userId,
      body.reason
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        incident: updatedIncident,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Update incident status failed', error as Error, { requestId });

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
