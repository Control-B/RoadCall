import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';
import { SearchRequest } from '../types';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const body = JSON.parse(event.body || '{}') as SearchRequest;

    if (!body.query) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required field: query',
        }),
      };
    }

    const results = await kbService.search(body);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results,
        count: results.length,
      }),
    };
  } catch (error) {
    logger.error('Error searching documents', error as Error);

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
