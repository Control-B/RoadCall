// EventBridge client wrapper

import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { logger } from '@roadcall/utils';

export interface DomainEvent {
  detailType: string;
  source: string;
  detail: Record<string, unknown>;
}

export class EventBridgeWrapper {
  private client: EventBridgeClient;
  private eventBusName: string;

  constructor(eventBusName?: string, region?: string) {
    this.client = new EventBridgeClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
    this.eventBusName = eventBusName || process.env.EVENT_BUS_NAME || 'default';
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    try {
      await this.client.send(
        new PutEventsCommand({
          Entries: [
            {
              EventBusName: this.eventBusName,
              Source: event.source,
              DetailType: event.detailType,
              Detail: JSON.stringify(event.detail),
              Time: new Date(),
            },
          ],
        })
      );

      logger.info('EventBridge event published', {
        detailType: event.detailType,
        source: event.source,
      });
    } catch (error) {
      logger.error('EventBridge publish error', error as Error, {
        detailType: event.detailType,
      });
      throw error;
    }
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    try {
      await this.client.send(
        new PutEventsCommand({
          Entries: events.map((event) => ({
            EventBusName: this.eventBusName,
            Source: event.source,
            DetailType: event.detailType,
            Detail: JSON.stringify(event.detail),
            Time: new Date(),
          })),
        })
      );

      logger.info('EventBridge events published', { count: events.length });
    } catch (error) {
      logger.error('EventBridge batch publish error', error as Error);
      throw error;
    }
  }
}

// Singleton instance
export const eventBridge = new EventBridgeWrapper();

// Event type helpers
export const EventSources = {
  INCIDENT_SERVICE: 'roadcall.incident-service',
  MATCH_SERVICE: 'roadcall.match-service',
  TRACKING_SERVICE: 'roadcall.tracking-service',
  PAYMENT_SERVICE: 'roadcall.payment-service',
  AUTH_SERVICE: 'roadcall.auth-service',
  VENDOR_SERVICE: 'roadcall.vendor-service',
  DRIVER_SERVICE: 'roadcall.driver-service',
} as const;

export const EventTypes = {
  INCIDENT_CREATED: 'IncidentCreated',
  INCIDENT_STATUS_CHANGED: 'IncidentStatusChanged',
  INCIDENT_ESCALATED: 'IncidentEscalated',
  MATCH_REQUESTED: 'MatchRequested',
  OFFER_CREATED: 'OfferCreated',
  OFFER_ACCEPTED: 'OfferAccepted',
  OFFER_DECLINED: 'OfferDeclined',
  VENDOR_ASSIGNED: 'VendorAssigned',
  VENDOR_ARRIVED: 'VendorArrived',
  VENDOR_TIMEOUT: 'VendorTimeout',
  TRACKING_STARTED: 'TrackingStarted',
  TRACKING_UPDATED: 'TrackingUpdated',
  PAYMENT_CREATED: 'PaymentCreated',
  PAYMENT_APPROVED: 'PaymentApproved',
  PAYMENT_COMPLETED: 'PaymentCompleted',
  PAYMENT_FAILED: 'PaymentFailed',
  FRAUD_DETECTED: 'FraudDetected',
  USER_REGISTERED: 'UserRegistered',
  USER_VERIFIED: 'UserVerified',
  WORK_COMPLETED: 'WorkCompleted',
} as const;
