import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import { getIncidentById } from '../../incident-service';

/**
 * Trigger vendor matching by publishing event to EventBridge
 * This will be picked up by the match service
 */
export const handler: Handler = async (event: {
  incidentId: string;
  attempt: number;
  radiusMiles: number;
}) => {
  const { incidentId, attempt, radiusMiles } = event;

  logger.info('Triggering vendor matching', { incidentId, attempt, radiusMiles });

  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // Publish match request event
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.MATCH_REQUESTED,
    detail: {
      incidentId: incident.incidentId,
      driverId: incident.driverId,
      type: incident.type,
      location: incident.location,
      radiusMiles,
      attempt,
      requestedAt: new Date().toISOString(),
    },
  });

  logger.info('Vendor matching triggered', { incidentId, attempt, radiusMiles });

  return {
    incidentId,
    matchRequested: true,
    attempt,
    radiusMiles,
  };
};
