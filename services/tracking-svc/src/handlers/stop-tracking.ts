import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { TrackingService } from '../tracking-service';
import type { TrackingSession } from '@roadcall/types';

const logger = new Logger({ serviceName: 'stop-tracking-handler' });

const trackingService = new TrackingService();

interface StopTrackingArgs {
  sessionId: string;
}

/**
 * AppSync resolver for stopTracking mutation
 */
export const handler = async (
  event: AppSyncResolverEvent<StopTrackingArgs>
): Promise<TrackingSession> => {
  logger.info('Stop tracking mutation', { arguments: event.arguments });

  const { sessionId } = event.arguments;

  try {
    const session = await trackingService.stopTracking(sessionId);

    logger.info('Tracking session stopped', { sessionId, status: session.status });
    return session;
  } catch (error) {
    logger.error('Failed to stop tracking', { error, sessionId });
    throw error;
  }
};
