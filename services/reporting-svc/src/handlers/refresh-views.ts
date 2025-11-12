import { ScheduledEvent } from 'aws-lambda';
import { refreshMaterializedViews } from '../etl-service';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for refreshing materialized views
 * Triggered by CloudWatch Events (scheduled every 5 minutes)
 */
export async function handler(event: ScheduledEvent): Promise<void> {
  logger.info('Refresh materialized views invoked', {
    time: event.time,
  });

  try {
    await refreshMaterializedViews();
    logger.info('Materialized views refreshed successfully');
  } catch (error) {
    logger.error('Failed to refresh materialized views', error as Error);
    throw error;
  }
}
