import {
  getEventPublisher,
  EventSources,
  EventTypes,
  TrackingStartedDetail,
  TrackingUpdatedDetail,
  TrackingStoppedDetail,
  VendorArrivedDetail,
} from '@roadcall/events';

/**
 * Publish TrackingStarted event
 */
export async function publishTrackingStarted(
  detail: Omit<TrackingStartedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.TRACKING_SERVICE,
    detailType: EventTypes.TRACKING_STARTED,
    detail: detail as TrackingStartedDetail,
    resources: [`tracking/${detail.sessionId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish TrackingUpdated event
 */
export async function publishTrackingUpdated(
  detail: Omit<TrackingUpdatedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.TRACKING_SERVICE,
    detailType: EventTypes.TRACKING_UPDATED,
    detail: detail as TrackingUpdatedDetail,
    resources: [`tracking/${detail.sessionId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish TrackingStopped event
 */
export async function publishTrackingStopped(
  detail: Omit<TrackingStoppedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.TRACKING_SERVICE,
    detailType: EventTypes.TRACKING_STOPPED,
    detail: detail as TrackingStoppedDetail,
    resources: [`tracking/${detail.sessionId}`, `incident/${detail.incidentId}`],
  });
}

/**
 * Publish VendorArrived event
 */
export async function publishVendorArrived(detail: Omit<VendorArrivedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.TRACKING_SERVICE,
    detailType: EventTypes.VENDOR_ARRIVED,
    detail: detail as VendorArrivedDetail,
    resources: [`incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}
