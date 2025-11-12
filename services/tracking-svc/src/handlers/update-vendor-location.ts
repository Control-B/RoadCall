import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { TrackingService } from '../tracking-service';
import type { TrackingSession, Location } from '@roadcall/types';

const logger = new Logger({ serviceName: 'update-vendor-location-handler' });

const trackingService = new TrackingService();

interface UpdateVendorLocationArgs {
  sessionId: string;
  location: Location;
}

/**
 * AppSync resolver for updateVendorLocation mutation
 */
export const handler = async (
  event: AppSyncResolverEvent<UpdateVendorLocationArgs>
): Promise<TrackingSession> => {
  logger.info('Update vendor location mutation', { arguments: event.arguments });

  const { sessionId, location } = event.arguments;

  try {
    // Validate location data
    if (!location.lat || !location.lon) {
      throw new Error('Invalid location: lat and lon are required');
    }

    if (location.lat < -90 || location.lat > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }

    if (location.lon < -180 || location.lon > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }

    // Update vendor location
    const session = await trackingService.updateVendorLocation(sessionId, location);

    logger.info('Vendor location updated', {
      sessionId,
      status: session.status,
      eta: session.eta.minutes,
    });

    return session;
  } catch (error) {
    logger.error('Failed to update vendor location', { error, sessionId });
    throw error;
  }
};
