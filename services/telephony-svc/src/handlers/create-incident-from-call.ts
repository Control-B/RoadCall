/**
 * Create Incident from Call Handler
 * Lambda function invoked by Amazon Connect to create incident during call
 */

import { Handler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { marshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@roadcall/utils';
import { ContactFlowEvent, IncidentCreationResult } from '../types';

const dynamodb = new DynamoDBClient({});
const eventbridge = new EventBridgeClient({});

const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME || '';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || '';

interface IncidentCreationEvent extends ContactFlowEvent {
  Details: ContactFlowEvent['Details'] & {
    Parameters: {
      driverId: string;
      incidentType: 'tire' | 'engine' | 'tow';
      latitude?: string;
      longitude?: string;
      description?: string;
    };
  };
}

/**
 * Create incident from phone call
 * Called by Amazon Connect contact flow after collecting incident details
 */
export const handler: Handler<IncidentCreationEvent, IncidentCreationResult> = async (event) => {
  const contactId = event.Details.ContactData.ContactId;
  const { driverId, incidentType, latitude, longitude, description } = event.Details.Parameters;

  logger.info('Creating incident from call', {
    contactId,
    driverId,
    incidentType,
    hasLocation: !!(latitude && longitude),
  });

  try {
    // Validate required parameters
    if (!driverId || !incidentType) {
      logger.error('Missing required parameters', undefined, {
        contactId,
        driverId,
        incidentType,
      });
      return {
        success: false,
        error: 'Missing required parameters',
      };
    }

    // Validate incident type
    if (!['tire', 'engine', 'tow'].includes(incidentType)) {
      logger.error('Invalid incident type', undefined, { contactId, incidentType });
      return {
        success: false,
        error: 'Invalid incident type',
      };
    }

    const incidentId = uuidv4();
    const now = new Date().toISOString();

    // Parse location if provided
    let location: { lat: number; lon: number } | undefined;
    if (latitude && longitude) {
      location = {
        lat: parseFloat(latitude),
        lon: parseFloat(longitude),
      };

      // Validate coordinates
      if (
        isNaN(location.lat) ||
        isNaN(location.lon) ||
        location.lat < -90 ||
        location.lat > 90 ||
        location.lon < -180 ||
        location.lon > 180
      ) {
        logger.warn('Invalid coordinates provided', { contactId, latitude, longitude });
        location = undefined;
      }
    }

    // Create incident record
    const incident = {
      incidentId,
      driverId,
      type: incidentType,
      status: 'created',
      location: location
        ? {
            lat: location.lat,
            lon: location.lon,
            address: '', // Will be enriched by location service
            roadSnapped: { lat: location.lat, lon: location.lon },
          }
        : undefined,
      callRecordingUrl: '', // Will be updated by post-call processing
      createdAt: now,
      updatedAt: now,
      timeline: [
        {
          from: null,
          to: 'created',
          timestamp: now,
          actor: `call:${contactId}`,
          reason: 'Created from phone call',
        },
      ],
      media: [],
      metadata: {
        source: 'phone_call',
        contactId,
        description: description || '',
      },
    };

    // Store incident in DynamoDB
    const putCommand = new PutItemCommand({
      TableName: INCIDENTS_TABLE,
      Item: marshall(incident, { removeUndefinedValues: true }),
    });

    await dynamodb.send(putCommand);

    logger.info('Incident created', { incidentId, contactId, driverId });

    // Publish IncidentCreated event to EventBridge
    const eventCommand = new PutEventsCommand({
      Entries: [
        {
          Source: 'roadcall.telephony',
          DetailType: 'IncidentCreated',
          Detail: JSON.stringify({
            incidentId,
            driverId,
            type: incidentType,
            location,
            source: 'phone_call',
            contactId,
            timestamp: now,
          }),
          EventBusName: EVENT_BUS_NAME,
        },
      ],
    });

    await eventbridge.send(eventCommand);

    logger.info('IncidentCreated event published', { incidentId, contactId });

    return {
      success: true,
      incidentId,
    };
  } catch (error) {
    logger.error(
      'Error creating incident from call',
      error instanceof Error ? error : new Error('Unknown error'),
      { contactId }
    );

    return {
      success: false,
      error: 'Failed to create incident',
    };
  }
};
