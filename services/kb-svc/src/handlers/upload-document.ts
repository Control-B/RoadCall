import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';
import { DocumentUploadRequest } from '../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as DocumentUploadRequest;

    // Validate request
    if (!body.title || !body.category || !body.fileType || !body.uploadedBy) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required fields: title, category, fileType, uploadedBy',
        }),
      };
    }

    // Validate file size (max 50MB)
    if (body.fileSize > 50 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'File size exceeds maximum limit of 50MB',
        }),
      };
    }

    // Validate category
    const validCategories = ['sop', 'vendor_sla', 'troubleshooting', 'policy'];
    if (!validCategories.includes(body.category)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
        }),
      };
    }

    const result = await kbService.createDocument(body);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    logger.error('Error uploading document', error as Error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
