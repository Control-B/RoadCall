import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const category = event.queryStringParameters?.category;
    const limit = event.queryStringParameters?.limit
      ? parseInt(event.queryStringParameters.limit, 10)
      : 50;

    const documents = await kbService.listDocuments(category, limit);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents,
        count: documents.length,
      }),
    };
  } catch (error) {
    logger.error('Error listing documents', error as Error);

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
