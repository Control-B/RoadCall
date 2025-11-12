import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { getIncidentById } from '../../incident-service';

/**
 * Check if vendor has arrived at incident location
 * Used for timeout handling in Step Functions
 */
export const handler: Handler = async (event: {
  incidentId: string;
  vendorId: string;
  assignedAt: string;
}) => {
  const { incidentId, vendorId, assignedAt } = event;

  logger.info('Checking vendor arrival', { incidentId, vendorId });

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // Check if vendor has arrived
  const hasArrived = incident.status === 'vendor_arrived' || 
                     incident.status === 'work_in_progress' ||
                     incident.status === 'work_completed';

  if (hasArrived) {
    logger.info('Vendor has arrived', { incidentId, vendorId, status: incident.status });
    return {
      hasArrived: true,
      incidentId,
      vendorId,
      status: incident.status,
    };
  }

  // Calculate time elapsed since assignment
  const assignedTime = new Date(assignedAt).getTime();
  const currentTime = Date.now();
  const elapsedMinutes = (currentTime - assignedTime) / (1000 * 60);

  // 30-minute timeout for arrival
  const arrivalTimeoutMinutes = 30;
  const isTimeout = elapsedMinutes >= arrivalTimeoutMinutes;

  if (isTimeout) {
    logger.warn('Vendor arrival timeout', { 
      incidentId, 
      vendorId, 
      elapsedMinutes,
      timeoutMinutes: arrivalTimeoutMinutes 
    });
    return {
      hasArrived: false,
      isTimeout: true,
      incidentId,
      vendorId,
      elapsedMinutes,
    };
  }

  logger.info('Vendor still en route', { incidentId, vendorId, elapsedMinutes });
  return {
    hasArrived: false,
    isTimeout: false,
    incidentId,
    vendorId,
    elapsedMinutes,
  };
};
