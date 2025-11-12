import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const documentId = event.pathParameters?.id;

    if (!documentId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing document ID',
        }),
      };
    }

    const document = await kbService.getDocument(documentId);

    if (!document) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Document not found',
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(document),
    };
  } catch (error) {
    logger.error('Error getting document', error as Error);

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
