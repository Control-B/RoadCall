import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError, ValidationError, AuthorizationError } from '@roadcall/utils';
import { generateMediaUploadUrl, addMediaToIncident, getIncidentById } from '../incident-service';

interface GenerateUploadUrlRequest {
  fileName: string;
  contentType: string;
}

interface ConfirmUploadRequest {
  s3Key: string;
  mediaType: 'photo' | 'video' | 'document';
  metadata?: Record<string, unknown>;
}

/**
 * Lambda handler for media upload operations
 * POST /incidents/{id}/media/upload-url - Generate presigned URL
 * POST /incidents/{id}/media - Confirm upload
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

    // Get user context
    const userId = event.requestContext.authorizer?.userId;
    const role = event.requestContext.authorizer?.role;

    // Check authorization
    const incident = await getIncidentById(incidentId);
    if (!incident) {
      throw new NotFoundError('Incident', incidentId);
    }

    // Only driver or assigned vendor can upload media
    if (
      role === 'driver' && incident.driverId !== userId ||
      role === 'vendor' && incident.assignedVendorId !== userId
    ) {
      throw new AuthorizationError('You can only upload media to your own incidents');
    }

    // Check if this is upload URL generation or confirmation
    const path = event.path || event.resource;
    const isUploadUrl = path.includes('/upload-url');

    if (isUploadUrl) {
      // Generate presigned URL
      const body: GenerateUploadUrlRequest = JSON.parse(event.body);

      if (!body.fileName || !body.contentType) {
        throw new ValidationError('fileName and contentType are required');
      }

      logger.info('Generating media upload URL', { incidentId, fileName: body.fileName });

      const result = await generateMediaUploadUrl(incidentId, body.fileName, body.contentType);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          ...result,
          requestId,
          timestamp: new Date().toISOString(),
        }),
      };
    } else {
      // Confirm upload
      const body: ConfirmUploadRequest = JSON.parse(event.body);

      if (!body.s3Key || !body.mediaType) {
        throw new ValidationError('s3Key and mediaType are required');
      }

      logger.info('Confirming media upload', { incidentId, s3Key: body.s3Key });

      const media = await addMediaToIncident(
        incidentId,
        body.mediaType,
        body.s3Key,
        userId,
        body.metadata
      );

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          media,
          requestId,
          timestamp: new Date().toISOString(),
        }),
      };
    }
  } catch (error) {
    logger.error('Media upload operation failed', error as Error, { requestId });

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
