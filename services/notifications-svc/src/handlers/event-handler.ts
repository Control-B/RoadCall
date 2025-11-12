import { EventBridgeEvent } from 'aws-lambda';
import { NotificationRequest } from '@roadcall/types';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';

/**
 * Lambda handler for processing EventBridge events and sending notifications
 */
export async function handler(event: EventBridgeEvent<string, any>): Promise<void> {
  logger.info('Processing EventBridge event', { detailType: event['detail-type'] });

  try {
    const notificationRequest = mapEventToNotification(event);

    if (!notificationRequest) {
      logger.warn('No notification mapping for event', { detailType: event['detail-type'] });
      return;
    }

    await notificationService.sendNotification(notificationRequest);
    logger.info('Notification sent successfully', { type: notificationRequest.type });
  } catch (error) {
    logger.error('Failed to process event', error instanceof Error ? error : new Error(String(error)), { detailType: event['detail-type'] });
    throw error; // Let Lambda retry
  }
}

/**
 * Map EventBridge events to notification requests
 */
function mapEventToNotification(event: EventBridgeEvent<string, any>): NotificationRequest | null {
  const detail = event.detail;

  switch (event['detail-type']) {
    case 'OfferCreated':
      return {
        type: 'offer_received',
        recipientId: detail.vendorId,
        recipientType: 'vendor',
        channels: ['push', 'sms'],
        priority: 'urgent',
        data: {
          incidentId: detail.incidentId,
          offerId: detail.offerId,
          incidentType: detail.incidentType,
          distance: detail.distance,
          payout: detail.estimatedPayout,
          acceptUrl: `https://app.roadcall.example.com/offers/${detail.offerId}`,
        },
      };

    case 'OfferAccepted':
      return {
        type: 'offer_accepted',
        recipientId: detail.driverId,
        recipientType: 'driver',
        channels: ['push', 'sms', 'email'],
        priority: 'high',
        data: {
          incidentId: detail.incidentId,
          vendorId: detail.vendorId,
          vendorName: detail.vendorName,
          eta: detail.eta,
          trackingUrl: `https://app.roadcall.example.com/incidents/${detail.incidentId}/track`,
        },
      };

    case 'TrackingStarted':
      return {
        type: 'vendor_en_route',
        recipientId: detail.driverId,
        recipientType: 'driver',
        channels: ['push', 'sms'],
        priority: 'high',
        data: {
          incidentId: detail.incidentId,
          sessionId: detail.sessionId,
          vendorName: detail.vendorName,
          eta: detail.eta,
          trackingUrl: `https://app.roadcall.example.com/incidents/${detail.incidentId}/track`,
        },
      };

    case 'VendorArrived':
      return {
        type: 'vendor_arrived',
        recipientId: detail.driverId,
        recipientType: 'driver',
        channels: ['push', 'sms'],
        priority: 'high',
        data: {
          incidentId: detail.incidentId,
          vendorName: detail.vendorName,
        },
      };

    case 'WorkStarted':
      return {
        type: 'work_started',
        recipientId: detail.driverId,
        recipientType: 'driver',
        channels: ['push'],
        priority: 'normal',
        data: {
          incidentId: detail.incidentId,
          vendorName: detail.vendorName,
          incidentType: detail.incidentType,
        },
      };

    case 'WorkCompleted':
      return {
        type: 'work_completed',
        recipientId: detail.driverId,
        recipientType: 'driver',
        channels: ['push', 'sms', 'email'],
        priority: 'normal',
        data: {
          incidentId: detail.incidentId,
          vendorName: detail.vendorName,
          incidentType: detail.incidentType,
          ratingUrl: `https://app.roadcall.example.com/incidents/${detail.incidentId}/rate`,
        },
      };

    case 'PaymentApproved':
      return {
        type: 'payment_approved',
        recipientId: detail.vendorId,
        recipientType: 'vendor',
        channels: ['push', 'sms', 'email'],
        priority: 'normal',
        data: {
          paymentId: detail.paymentId,
          incidentId: detail.incidentId,
          amount: (detail.amountCents / 100).toFixed(2),
          date: new Date(detail.approvedAt).toLocaleDateString(),
        },
      };

    case 'IncidentCancelled':
      if (detail.assignedVendorId) {
        return {
          type: 'incident_cancelled',
          recipientId: detail.assignedVendorId,
          recipientType: 'vendor',
          channels: ['push', 'sms'],
          priority: 'high',
          data: {
            incidentId: detail.incidentId,
          },
        };
      }
      return null;

    default:
      return null;
  }
}
