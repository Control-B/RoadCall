import { DynamoDBStreamEvent } from 'aws-lambda';
import { processDynamoDBStream } from '../etl-service';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for processing DynamoDB Streams
 * Triggered by changes to Incidents, Vendors, Drivers, and Payments tables
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('ETL processor invoked', {
    recordCount: event.Records.length,
  });

  try {
    await processDynamoDBStream(event);
    logger.info('ETL processing completed successfully');
  } catch (error) {
    logger.error('ETL processing failed', error as Error);
    throw error; // Let Lambda retry
  }
}
