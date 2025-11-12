import { AppSyncResolverEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { TrackingService } from '../tracking-service';
import type { TrackingSession, Location } from '@roadcall/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const logger = new Logger({ serviceName: 'start-tracking-handler' });
const tracer = new Tracer({ serviceName: 'start-tracking-handler' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const trackingService = new TrackingService();
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME!;

interface StartTrackingArgs {
  incidentId: string;
}

/**
 * AppSync resolver for startTracking mutation
 */
export const handler = async (
  event: AppSyncResolverEvent<StartTrackingArgs>
): Promise<TrackingSession> => {
  logger.info('Start tracking mutation', { arguments: event.arguments });

  const { incidentId } = event.arguments;

  try {
    // Get incident details to extract driver, vendor, and locations
    const incidentResult = await docClient.send(
      new GetCommand({
        TableName: INCIDENTS_TABLE,
        Key: { incidentId },
      })
    );

    if (!incidentResult.Item) {
      throw new Error(`Incident not found: ${incidentId}`);
    }

    const incident = incidentResult.Item;

    // Validate incident has assigned vendor
    if (!incident.assignedVendorId) {
      throw new Error(`Incident ${incidentId} does not have an assigned vendor`);
    }

    // Extract locations
    const driverLocation: Location = {
      lat: incident.location.lat,
      lon: incident.location.lon,
      timestamp: new Date().toISOString(),
    };

    // For initial vendor location, we'll use the incident location
    // In a real scenario, this would come from the vendor's current GPS position
    const vendorLocation: Location = {
      lat: incident.location.lat,
      lon: incident.location.lon,
      timestamp: new Date().toISOString(),
    };

    // Start tracking session
    const session = await trackingService.startTracking(
      incidentId,
      incident.driverId,
      incident.assignedVendorId,
      driverLocation,
      vendorLocation
    );

    logger.info('Tracking session started', { sessionId: session.sessionId });
    return session;
  } catch (error) {
    logger.error('Failed to start tracking', { error, incidentId });
    throw error;
  }
};
