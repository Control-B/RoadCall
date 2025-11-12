import { ScheduledEvent } from 'aws-lambda';
import { calculateKPIs, publishKPIsToCloudWatch } from '../kpi-service';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for publishing KPIs to CloudWatch
 * Triggered by CloudWatch Events (scheduled every 5 minutes)
 */
export async function handler(event: ScheduledEvent): Promise<void> {
  logger.info('Publish metrics invoked', {
    time: event.time,
  });

  try {
    // Calculate KPIs for the last hour
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // 1 hour ago

    const kpis = await calculateKPIs({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Publish to CloudWatch
    await publishKPIsToCloudWatch(kpis);

    logger.info('Metrics published successfully', { kpis });
  } catch (error) {
    logger.error('Failed to publish metrics', error as Error);
    throw error;
  }
}
