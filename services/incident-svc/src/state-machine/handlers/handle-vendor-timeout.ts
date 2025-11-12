import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import { updateIncidentStatus, getIncidentById } from '../../incident-service';

/**
 * Handle vendor arrival timeout - reassign to new vendor
 */
export const handler: Handler = async (event: {
  incidentId: string;
  vendorId: string;
  elapsedMinutes: number;
}) => {
  const { incidentId, vendorId, elapsedMinutes } = event;

  logger.warn('Handling vendor arrival timeout', { incidentId, vendorId, elapsedMinutes });

  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // Reset incident to created status to trigger new vendor matching
  await updateIncidentStatus(
    incidentId,
    'created',
    'system',
    `Vendor ${vendorId} failed to arrive within 30 minutes`
  );

  // Clear vendor assignment
  const { dynamodb } = await import('@roadcall/aws-clients');
  const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE || '';
  
  await dynamodb.update(INCIDENTS_TABLE, { incidentId }, {
    assignedVendorId: null,
    updatedAt: new Date().toISOString(),
  });

  // Publish vendor timeout event
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.VENDOR_TIMEOUT,
    detail: {
      incidentId,
      vendorId,
      timeoutType: 'arrival',
      elapsedMinutes,
      timestamp: new Date().toISOString(),
    },
  });

  // Trigger new vendor matching by publishing incident created event
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_CREATED,
    detail: {
      incidentId: incident.incidentId,
      driverId: incident.driverId,
      type: incident.type,
      location: incident.location,
      createdAt: incident.createdAt,
      isRetry: true,
      previousVendorId: vendorId,
    },
  });

  logger.info('Vendor timeout handled, triggering new match', { incidentId, vendorId });

  return {
    incidentId,
    timeoutHandled: true,
    previousVendorId: vendorId,
    retriggeredMatching: true,
  };
};
