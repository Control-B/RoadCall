import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  LocationClient,
  CalculateRouteCommand,
  BatchUpdateDevicePositionCommand,
  BatchPutGeofenceCommand,
} from '@aws-sdk/client-location';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { v4 as uuidv4 } from 'uuid';
import type {
  TrackingSession,
  Location,
  ETACalculation,
  TrackingStatus,
} from '@roadcall/types';

const logger = new Logger({ serviceName: 'tracking-service' });
const tracer = new Tracer({ serviceName: 'tracking-service' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const locationClient = tracer.captureAWSv3Client(new LocationClient({}));
const eventBridgeClient = tracer.captureAWSv3Client(new EventBridgeClient({}));

const TABLE_NAME = process.env.TABLE_NAME!;
const LOCATION_CALCULATOR_NAME = process.env.LOCATION_CALCULATOR_NAME || 'roadcall-route-calculator';
const LOCATION_TRACKER_NAME = process.env.LOCATION_TRACKER_NAME || 'roadcall-vendor-tracker';
const GEOFENCE_COLLECTION_NAME = process.env.GEOFENCE_COLLECTION_NAME || 'roadcall-geofences';
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME || 'default';
const MAX_VENDOR_PATH_POINTS = 50;
const GEOFENCE_RADIUS_METERS = 100; // 100-meter radius for arrival detection

export class TrackingService {
  /**
   * Start a new tracking session for an incident
   */
  async startTracking(
    incidentId: string,
    driverId: string,
    vendorId: string,
    driverLocation: Location,
    vendorLocation: Location
  ): Promise<TrackingSession> {
    logger.info('Starting tracking session', { incidentId, driverId, vendorId });

    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Calculate initial ETA
    const eta = await this.calculateETA(vendorLocation, driverLocation);

    // Create geofence ID (100-meter radius around incident)
    const geofenceId = `incident-${incidentId}-arrival`;

    // Create geofence in AWS Location Service for arrival detection
    await this.createGeofence(geofenceId, driverLocation);

    // Register vendor device in tracker
    await this.updateTrackerPosition(vendorId, vendorLocation);

    const session: TrackingSession = {
      sessionId,
      incidentId,
      driverId,
      vendorId,
      status: 'active',
      driverLocation: {
        ...driverLocation,
        timestamp: driverLocation.timestamp || now,
      },
      vendorLocation: {
        ...vendorLocation,
        timestamp: vendorLocation.timestamp || now,
      },
      vendorPath: [
        {
          ...vendorLocation,
          timestamp: vendorLocation.timestamp || now,
        },
      ],
      route: [],
      eta,
      geofenceId,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: session,
      })
    );

    logger.info('Tracking session created', { sessionId });
    return session;
  }

  /**
   * Update vendor location and recalculate ETA
   */
  async updateVendorLocation(sessionId: string, location: Location): Promise<TrackingSession> {
    logger.info('Updating vendor location', { sessionId });

    // Get current session
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Tracking session not found: ${sessionId}`);
    }

    if (session.status !== 'active') {
      throw new Error(`Cannot update location for session with status: ${session.status}`);
    }

    const now = new Date().toISOString();
    const locationWithTimestamp: Location = {
      ...location,
      timestamp: location.timestamp || now,
    };

    // Update vendor path (circular buffer, max 50 points)
    const updatedPath = [...session.vendorPath, locationWithTimestamp];
    if (updatedPath.length > MAX_VENDOR_PATH_POINTS) {
      updatedPath.shift();
    }

    // Update vendor position in AWS Location Service Tracker
    // This enables automatic geofence arrival detection
    await this.updateTrackerPosition(session.vendorId, locationWithTimestamp);

    // Check if vendor has arrived (within 100 meters)
    const distanceToIncident = this.calculateDistance(location, session.driverLocation);
    const hasArrived = distanceToIncident <= 0.1; // 0.1 km = 100 meters

    // Recalculate ETA if not arrived
    let eta = session.eta;
    let status: TrackingStatus = session.status;

    if (hasArrived) {
      status = 'arrived';
      eta = {
        minutes: 0,
        distanceMiles: 0,
        arrivalTime: now,
        confidence: 1.0,
        calculatedAt: now,
      };

      // Publish VendorArrived event
      await this.publishVendorArrivedEvent(session, locationWithTimestamp);
    } else {
      // Only recalculate if significant movement (>0.1 miles) or 30 seconds elapsed
      const lastLocation = session.vendorPath[session.vendorPath.length - 1];
      const distanceMoved = this.calculateDistance(location, lastLocation);
      const timeSinceLastCalc = new Date().getTime() - new Date(session.eta.calculatedAt).getTime();

      if (distanceMoved > 0.1 || timeSinceLastCalc > 30000) {
        eta = await this.calculateETA(locationWithTimestamp, session.driverLocation);
      }
    }

    // Update session
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
        UpdateExpression:
          'SET vendorLocation = :vendorLocation, vendorPath = :vendorPath, eta = :eta, #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':vendorLocation': locationWithTimestamp,
          ':vendorPath': updatedPath,
          ':eta': eta,
          ':status': status,
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const updatedSession = result.Attributes as TrackingSession;
    logger.info('Vendor location updated', { sessionId, hasArrived, status });

    return updatedSession;
  }

  /**
   * Stop tracking session
   */
  async stopTracking(sessionId: string): Promise<TrackingSession> {
    logger.info('Stopping tracking session', { sessionId });

    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Tracking session not found: ${sessionId}`);
    }

    const now = new Date().toISOString();

    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'completed',
          ':updatedAt': now,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    logger.info('Tracking session stopped', { sessionId });
    return result.Attributes as TrackingSession;
  }

  /**
   * Get tracking session by ID
   */
  async getSession(sessionId: string): Promise<TrackingSession | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { sessionId },
      })
    );

    return (result.Item as TrackingSession) || null;
  }

  /**
   * Get active tracking session by incident ID
   */
  async getActiveSessionByIncident(incidentId: string): Promise<TrackingSession | null> {
    const result = await docClient.send(
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

    return result.Items && result.Items.length > 0 ? (result.Items[0] as TrackingSession) : null;
  }

  /**
   * Calculate ETA using AWS Location Service with real-time traffic data
   * Uses HERE Technologies data source which includes live traffic conditions
   */
  private async calculateETA(from: Location, to: Location): Promise<ETACalculation> {
    try {
      const command = new CalculateRouteCommand({
        CalculatorName: LOCATION_CALCULATOR_NAME,
        DeparturePosition: [from.lon, from.lat],
        DestinationPosition: [to.lon, to.lat],
        TravelMode: 'Car',
        IncludeLegGeometry: false,
        DepartNow: true, // Use current time for traffic-aware routing
        // Traffic-aware routing is automatically enabled with HERE data source
        OptimizeFor: 'FastestRoute', // Optimize for fastest route considering traffic
      });

      const response = await locationClient.send(command);

      if (!response.Summary) {
        throw new Error('No route summary returned from Location Service');
      }

      const distanceKm = response.Summary.Distance || 0;
      const distanceMiles = distanceKm * 0.621371;
      const durationSeconds = response.Summary.DurationSeconds || 0;
      const minutes = Math.ceil(durationSeconds / 60);

      const now = new Date();
      const arrivalTime = new Date(now.getTime() + durationSeconds * 1000).toISOString();

      // Calculate confidence based on route quality
      // Higher confidence when using real-time traffic data
      const confidence = response.Summary.DurationSeconds ? 0.9 : 0.75;

      logger.debug('ETA calculated with traffic data', {
        distanceMiles,
        minutes,
        confidence,
      });

      return {
        minutes,
        distanceMiles,
        arrivalTime,
        confidence,
        calculatedAt: now.toISOString(),
      };
    } catch (error) {
      logger.error('Failed to calculate ETA with traffic data', { error });

      // Fallback: use straight-line distance and average speed
      const distanceKm = this.calculateDistance(from, to);
      const distanceMiles = distanceKm * 0.621371;
      const avgSpeedMph = 45; // Assume 45 mph average
      const minutes = Math.ceil((distanceMiles / avgSpeedMph) * 60);

      const now = new Date();
      const arrivalTime = new Date(now.getTime() + minutes * 60 * 1000).toISOString();

      logger.warn('Using fallback ETA calculation', { distanceMiles, minutes });

      return {
        minutes,
        distanceMiles,
        arrivalTime,
        confidence: 0.5, // Lower confidence for fallback calculation
        calculatedAt: now.toISOString(),
      };
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  private calculateDistance(point1: Location, point2: Location): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLon = this.toRadians(point2.lon - point1.lon);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) *
        Math.cos(this.toRadians(point2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Create a circular geofence around incident location for arrival detection
   * Geofence radius: 100 meters
   */
  private async createGeofence(geofenceId: string, center: Location): Promise<void> {
    try {
      logger.info('Creating geofence', { geofenceId, center });

      await locationClient.send(
        new BatchPutGeofenceCommand({
          CollectionName: GEOFENCE_COLLECTION_NAME,
          Entries: [
            {
              GeofenceId: geofenceId,
              Geometry: {
                Circle: {
                  Center: [center.lon, center.lat],
                  Radius: GEOFENCE_RADIUS_METERS,
                },
              },
            },
          ],
        })
      );

      logger.info('Geofence created successfully', { geofenceId });
    } catch (error) {
      logger.error('Failed to create geofence', { error, geofenceId });
      // Don't throw - geofence creation is not critical for tracking
    }
  }

  /**
   * Update vendor position in AWS Location Service Tracker
   * Enables automatic geofence arrival detection
   * Updates are batched every 10 seconds by the tracker
   */
  private async updateTrackerPosition(deviceId: string, location: Location): Promise<void> {
    try {
      const timestamp = location.timestamp ? new Date(location.timestamp) : new Date();

      await locationClient.send(
        new BatchUpdateDevicePositionCommand({
          TrackerName: LOCATION_TRACKER_NAME,
          Updates: [
            {
              DeviceId: deviceId,
              Position: [location.lon, location.lat],
              SampleTime: timestamp,
              Accuracy: location.accuracy
                ? {
                    Horizontal: location.accuracy,
                  }
                : undefined,
            },
          ],
        })
      );

      logger.debug('Tracker position updated', { deviceId, location });
    } catch (error) {
      logger.error('Failed to update tracker position', { error, deviceId });
      // Don't throw - tracker update failure shouldn't break location updates
    }
  }

  /**
   * Publish VendorArrived event to EventBridge
   */
  private async publishVendorArrivedEvent(
    session: TrackingSession,
    location: Location
  ): Promise<void> {
    try {
      await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: [
            {
              Source: 'roadcall.tracking',
              DetailType: 'VendorArrived',
              Detail: JSON.stringify({
                incidentId: session.incidentId,
                sessionId: session.sessionId,
                vendorId: session.vendorId,
                driverId: session.driverId,
                arrivalTime: new Date().toISOString(),
                location: {
                  lat: location.lat,
                  lon: location.lon,
                },
              }),
              EventBusName: EVENT_BUS_NAME,
            },
          ],
        })
      );

      logger.info('VendorArrived event published', {
        incidentId: session.incidentId,
        sessionId: session.sessionId,
      });
    } catch (error) {
      logger.error('Failed to publish VendorArrived event', { error });
      // Don't throw - event publishing failure shouldn't break tracking
    }
  }
}
