import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { IncidentStatus } from '@roadcall/types';
import { updateIncidentStatus } from '../../incident-service';

/**
 * Handle automatic state transitions based on vendor actions
 */
export const handler: Handler = async (event: {
  incidentId: string;
  newStatus: IncidentStatus;
  actor: string;
  reason?: string;
}) => {
  const { incidentId, newStatus, actor, reason } = event;

  logger.info('Handling state transition', { incidentId, newStatus, actor });

  const incident = await updateIncidentStatus(incidentId, newStatus, actor, reason);

  logger.info('State transition completed', { 
    incidentId, 
    status: incident.status,
    previousStatus: event.newStatus 
  });

  return {
    incidentId,
    status: incident.status,
    updatedAt: incident.updatedAt,
    transitionCompleted: true,
  };
};
