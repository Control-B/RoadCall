import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { getIncidentsByDriver, getIncidentsByVendor, getIncidentsByStatus } from '../incident-service';
import { IncidentStatus } from '@roadcall/types';

/**
 * Lambda handler for listing incidents
 * GET /incidents?driverId={id}&status={status}
 * GET /incidents?vendorId={id}&status={status}
 * GET /incidents?status={status}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const params = event.queryStringParameters;

    // Get user context
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    let incidents;

    if (params?.driverId) {
      // List by driver
      // Drivers can only list their own incidents
      if (role === 'driver' && params.driverId !== userId) {
        throw new ValidationError('You can only list your own incidents');
      }

      const status = params.status as IncidentStatus | undefined;
      incidents = await getIncidentsByDriver(params.driverId, status);
    } else if (params?.vendorId) {
      // List by vendor
      // Vendors can only list their own incidents
      if (role === 'vendor' && params.vendorId !== userId) {
        throw new ValidationError('You can only list your own incidents');
      }

      const status = params.status as IncidentStatus | undefined;
      incidents = await getIncidentsByVendor(params.vendorId, status);
    } else if (params?.status) {
      // List by status (admin/dispatcher only)
      if (role !== 'admin' && role !== 'dispatcher') {
        throw new ValidationError('Only admins and dispatchers can list all incidents by status');
      }

      incidents = await getIncidentsByStatus(params.status as IncidentStatus);
    } else {
      throw new ValidationError('Must provide driverId, vendorId, or status parameter');
    }

    logger.info('Incidents listed', { count: incidents.length });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        incidents,
        count: incidents.length,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('List incidents failed', error as Error, { requestId });

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
