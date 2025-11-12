import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { exportToS3, ExportRequest, ExportFormat } from '../export-service';
import { logger } from '@roadcall/utils';

/**
 * POST /reports/export
 * Export data to S3 in CSV/Parquet format
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    logger.info('Export data request', {
      requestId,
      body: event.body,
    });

    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Validate request
    if (!body.type || !['incidents', 'vendors', 'drivers', 'kpis'].includes(body.type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid export type. Must be one of: incidents, vendors, drivers, kpis',
            requestId,
            timestamp: new Date().toISOString(),
          },
        }),
      };
    }

    if (!body.format || !['csv', 'parquet', 'json'].includes(body.format)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'Invalid format. Must be one of: csv, parquet, json',
            requestId,
            timestamp: new Date().toISOString(),
          },
        }),
      };
    }

    // Build export request
    const exportRequest: ExportRequest = {
      type: body.type,
      format: body.format as ExportFormat,
      filters: body.filters,
      s3Bucket: process.env.EXPORT_BUCKET || body.s3Bucket,
      s3KeyPrefix: body.s3KeyPrefix,
    };

    if (!exportRequest.s3Bucket) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: {
            type: 'VALIDATION_ERROR',
            message: 'S3 bucket is required',
            requestId,
            timestamp: new Date().toISOString(),
          },
        }),
      };
    }

    // Execute export
    const result = await exportToS3(exportRequest);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Failed to export data', error as Error, { requestId });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          type: 'INTERNAL_ERROR',
          message: 'Failed to export data',
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
