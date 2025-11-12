import { Handler } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { getIncidentById } from '../../incident-service';

/**
 * Check if vendor has responded to the incident
 * Used for timeout handling in Step Functions
 */
export const handler: Handler = async (event: {
  incidentId: string;
  attempt: number;
  radiusMiles: number;
}) => {
  const { incidentId, attempt, radiusMiles } = event;

  logger.info('Checking vendor response', { incidentId, attempt });

  const incident = await getIncidentById(incidentId);

  if (!incident) {
    throw new Error(`Incident ${incidentId} not found`);
  }

  // Check if vendor has been assigned
  const hasVendor = incident.status === 'vendor_assigned' || incident.assignedVendorId;

  if (hasVendor) {
    logger.info('Vendor assigned to incident', { incidentId, vendorId: incident.assignedVendorId });
    return {
      hasVendor: true,
      incidentId,
      vendorId: incident.assignedVendorId,
      status: incident.status,
    };
  }

  // No vendor assigned - check if we should expand radius or escalate
  const maxAttempts = 3;
  const shouldEscalate = attempt >= maxAttempts;

  if (shouldEscalate) {
    logger.warn('Max vendor matching attempts reached, escalating', { incidentId, attempt });
    return {
      hasVendor: false,
      shouldEscalate: true,
      incidentId,
      attempt,
    };
  }

  // Expand radius by 25%
  const newRadius = radiusMiles * 1.25;
  logger.info('Expanding search radius', { incidentId, attempt, oldRadius: radiusMiles, newRadius });

  return {
    hasVendor: false,
    shouldEscalate: false,
    incidentId,
    attempt: attempt + 1,
    radiusMiles: newRadius,
  };
};
