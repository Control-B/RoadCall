import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { TrackingService } from '../tracking-service';
import type { TrackingSession } from '@roadcall/types';

const logger = new Logger({ serviceName: 'get-active-session-by-incident-handler' });

const trackingService = new TrackingService();

interface GetActiveSessionByIncidentArgs {
  incidentId: string;
}

/**
 * AppSync resolver for getActiveSessionByIncident query
 */
export const handler = async (
  event: AppSyncResolverEvent<GetActiveSessionByIncidentArgs>
): Promise<TrackingSession | null> => {
  logger.info('Get active session by incident query', { arguments: event.arguments });

  const { incidentId } = event.arguments;

  try {
    const session = await trackingService.getActiveSessionByIncident(incidentId);

    if (!session) {
      logger.info('No active tracking session found for incident', { incidentId });
      return null;
    }

    logger.info('Active tracking session retrieved', {
      incidentId,
      sessionId: session.sessionId,
      status: session.status,
    });

    return session;
  } catch (error) {
    logger.error('Failed to get active session by incident', { error, incidentId });
    throw error;
  }
};
