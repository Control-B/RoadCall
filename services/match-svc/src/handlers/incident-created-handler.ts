import { EventBridgeEvent } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { executeVendorMatching } from '../match-service';

interface IncidentCreatedDetail {
  incidentId: string;
  driverId: string;
  type: string;
  location: {
    lat: number;
    lon: number;
  };
  createdAt: string;
}

/**
 * Lambda handler for IncidentCreated EventBridge event
 * Triggers vendor matching process
 */
export async function handler(
  event: EventBridgeEvent<'IncidentCreated', IncidentCreatedDetail>
): Promise<void> {
  logger.info('IncidentCreated event received', {
    incidentId: event.detail.incidentId,
    eventId: event.id,
  });

  try {
    const { incidentId } = event.detail;

    // Execute vendor matching with radius expansion
    const result = await executeVendorMatching(incidentId);

    logger.info('Vendor matching completed', {
      incidentId,
      offersCreated: result.offers.length,
      attempt: result.attempt,
      radiusUsed: result.radiusUsed,
    });

    if (result.offers.length === 0) {
      logger.warn('No offers created for incident', {
        incidentId,
        attempts: result.attempt,
      });
    }
  } catch (error) {
    logger.error('Error processing IncidentCreated event', error as Error, {
      incidentId: event.detail.incidentId,
    });

    // Send to DLQ for manual review
    throw error;
  }
}
