import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getVendorPerformance, KPIFilters } from '../kpi-service';
import { logger } from '@roadcall/utils';

/**
 * GET /reports/vendors/{id}/performance
 * Get vendor performance report
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const vendorId = event.pathParameters?.id;

    logger.info('Get vendor performance request', {
      requestId,
      vendorId,
      queryParams: event.queryStringParameters,
    });

    // Parse query parameters
    const filters: KPIFilters = {
      startDate: event.queryStringParameters?.startDate,
      endDate: event.queryStringParameters?.endDate,
      region: event.queryStringParameters?.region,
    };

    // Get vendor performance
    const performance = await getVendorPerformance(vendorId, filters);

    // If specific vendor requested, return single object
    if (vendorId) {
      const vendorPerformance = performance.find((v) => v.vendorId === vendorId);

      if (!vendorPerformance) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            error: {
              type: 'NOT_FOUND',
              message: `Vendor not found: ${vendorId}`,
              requestId,
              timestamp: new Date().toISOString(),
            },
          }),
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          data: vendorPerformance,
          requestId,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Return all vendors
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: performance,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Failed to get vendor performance', error as Error, { requestId });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to get vendor performance',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
