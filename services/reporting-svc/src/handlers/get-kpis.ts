import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { calculateKPIs, KPIFilters } from '../kpi-service';
import { logger } from '@roadcall/utils';

/**
 * GET /reports/kpis
 * Get KPI summary for a given period
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    logger.info('Get KPIs request', {
      requestId,
      queryParams: event.queryStringParameters,
    });

    // Parse query parameters
    const filters: KPIFilters = {
      startDate: event.queryStringParameters?.startDate,
      endDate: event.queryStringParameters?.endDate,
      region: event.queryStringParameters?.region,
      incidentType: event.queryStringParameters?.incidentType,
      companyId: event.queryStringParameters?.companyId,
    };

    // Calculate KPIs
    const kpis = await calculateKPIs(filters);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: kpis,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Failed to get KPIs', error as Error, { requestId });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to calculate KPIs',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
