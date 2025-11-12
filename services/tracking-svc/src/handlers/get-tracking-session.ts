import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { TrackingService } from '../tracking-service';
import type { TrackingSession } from '@roadcall/types';

const logger = new Logger({ serviceName: 'get-tracking-session-handler' });

const trackingService = new TrackingService();

interface GetTrackingSessionArgs {
  sessionId: string;
}

/**
 * AppSync resolver for getTrackingSession query
 */
export const handler = async (
  event: AppSyncResolverEvent<GetTrackingSessionArgs>
): Promise<TrackingSession | null> => {
  logger.info('Get tracking session query', { arguments: event.arguments });

  const { sessionId } = event.arguments;

  try {
    const session = await trackingService.getSession(sessionId);

    if (!session) {
      logger.info('Tracking session not found', { sessionId });
      return null;
    }

    logger.info('Tracking session retrieved', { sessionId, status: session.status });
    return session;
  } catch (error) {
    logger.error('Failed to get tracking session', { error, sessionId });
    throw error;
  }
};
