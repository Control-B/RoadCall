import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';
import { RAGQueryRequest } from '../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as RAGQueryRequest;

    if (!body.query) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required field: query',
        }),
      };
    }

    const response = await kbService.ragQuery(body);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Error processing RAG query', error as Error);

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
