import { EventBridgeEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

const logger = new Logger({ serviceName: 'geofence-event-handler' });
const tracer = new Tracer({ serviceName: 'geofence-event-handler' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const eventBridgeClient = tracer.captureAWSv3Client(new EventBridgeClient({}));

const TABLE_NAME = process.env.TABLE_NAME!;
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

interface GeofenceEventDetail {
  EventType: 'ENTER' | 'EXIT';
  GeofenceId: string;
  DeviceId: string;
  SampleTime: string;
  Position: [number, number]; // [lon, lat]
}

/**
 * Handle AWS Location Service geofence events
 * Triggered when vendor enters incident geofence (100m radius)
 */
export const handler = async (
  event: EventBridgeEvent<'Location Geofence Event', GeofenceEventDetail>
): Promise<void> => {
  logger.info('Geofence event received', { event });

  const { GeofenceId, DeviceId, EventType, Position, SampleTime } = event.detail;

  // Only process ENTER events
  if (EventType !== 'ENTER') {
    logger.info('Ignoring non-ENTER event', { EventType });
    return;
  }

  try {
    // Extract incident ID from geofence ID (format: incident-{incidentId}-arrival)
    const incidentId = GeofenceId.replace('incident-', '').replace('-arrival', '');

    logger.info('Processing vendor arrival', { incidentId, vendorDeviceId: DeviceId });

    // Find active tracking session for this incident
    const sessionResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'incident-index',
        KeyConditionExpression: 'incidentId = :incidentId',
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':incidentId': incidentId,
          ':status': 'active',
        },
        Limit: 1,
      })
    );

    if (!sessionResult.Items || sessionResult.Items.length === 0) {
      logger.warn('No active tracking session found for incident', { incidentId });
      return;
    }

    const session = sessionResult.Items[0];
    const sessionId = session.sessionId;

    // Update tracking session status to 'arrived'
    const now = new Date().toISOString();
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
        UpdateExpression:
          'SET #status = :status, vendorLocation = :location, eta = :eta, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'arrived',
          ':location': {
            lat: Position[1],
            lon: Position[0],
            timestamp: SampleTime,
          },
          ':eta': {
            minutes: 0,
            distanceMiles: 0,
            arrivalTime: now,
            confidence: 1.0,
            calculatedAt: now,
          },
          ':updatedAt': now,
        },
      })
    );

    logger.info('Tracking session updated to arrived', { sessionId });

    // Update incident status to 'vendor_arrived'
    await docClient.send(
      new UpdateCommand({
        TableName: INCIDENTS_TABLE,
        Key: { incidentId },
        UpdateExpression:
          'SET #status = :status, updatedAt = :updatedAt, timeline = list_append(timeline, :transition)',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'vendor_arrived',
          ':updatedAt': now,
          ':transition': [
            {
              from: 'vendor_en_route',
              to: 'vendor_arrived',
              timestamp: now,
              actor: 'system',
              reason: 'Geofence arrival detection',
            },
          ],
        },
      })
    );

    logger.info('Incident status updated to vendor_arrived', { incidentId });

    // Publish VendorArrived event to EventBridge
    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'roadcall.tracking',
            DetailType: 'VendorArrived',
            Detail: JSON.stringify({
              incidentId,
              sessionId,
              vendorId: session.vendorId,
              driverId: session.driverId,
              arrivalTime: now,
              location: {
                lat: Position[1],
                lon: Position[0],
              },
            }),
            EventBusName: EVENT_BUS_NAME,
          },
        ],
      })
    );

    logger.info('VendorArrived event published', { incidentId });
  } catch (error) {
    logger.error('Failed to process geofence event', { error, event });
    throw error;
  }
};
