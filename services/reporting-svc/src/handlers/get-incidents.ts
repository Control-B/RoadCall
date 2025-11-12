import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getIncidentAnalytics, KPIFilters } from '../kpi-service';
import { logger } from '@roadcall/utils';

/**
 * GET /reports/incidents
 * Get incident analytics for a given period
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    logger.info('Get incident analytics request', {
      requestId,
      queryParams: event.queryStringParameters,
    });

    // Parse query parameters
    const filters: KPIFilters = {
      startDate: event.queryStringParameters?.from || event.queryStringParameters?.startDate,
      endDate: event.queryStringParameters?.to || event.queryStringParameters?.endDate,
      region: event.queryStringParameters?.region,
      incidentType: event.queryStringParameters?.type || event.queryStringParameters?.incidentType,
      companyId: event.queryStringParameters?.companyId,
    };

    // Get analytics
    const analytics = await getIncidentAnalytics(filters);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: analytics,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Failed to get incident analytics', error as Error, { requestId });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to get incident analytics',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
