import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import { updateIncidentStatus } from '../../incident-service';

/**
 * Escalate incident to dispatcher when no vendor found after max attempts
 */
export const handler: Handler = async (event: {
  incidentId: string;
  attempt: number;
  reason: string;
}) => {
  const { incidentId, attempt, reason } = event;

  logger.warn('Escalating incident to dispatcher', { incidentId, attempt, reason });

  // Update incident status to indicate escalation needed
  await updateIncidentStatus(
    incidentId,
    'created', // Keep as created but mark for manual intervention
    'system',
    `Escalated: ${reason} after ${attempt} attempts`
  );

  // Publish escalation event for dispatcher notification
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_ESCALATED,
    detail: {
      incidentId,
      reason,
      attempts: attempt,
      escalatedAt: new Date().toISOString(),
      requiresManualIntervention: true,
    },
  });

  logger.info('Incident escalated successfully', { incidentId });

  return {
    incidentId,
    escalated: true,
    reason,
    attempts: attempt,
  };
};
