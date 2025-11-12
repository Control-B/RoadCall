import {
  getEventPublisher,
  EventSources,
  EventTypes,
  OfferCreatedDetail,
  OfferAcceptedDetail,
  OfferDeclinedDetail,
  OfferExpiredDetail,
} from '@roadcall/events';

/**
 * Publish OfferCreated event
 */
export async function publishOfferCreated(detail: Omit<OfferCreatedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_CREATED,
    detail: detail as OfferCreatedDetail,
    resources: [`offer/${detail.offerId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish OfferAccepted event
 */
export async function publishOfferAccepted(detail: Omit<OfferAcceptedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_ACCEPTED,
    detail: detail as OfferAcceptedDetail,
    resources: [`offer/${detail.offerId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish OfferDeclined event
 */
export async function publishOfferDeclined(detail: Omit<OfferDeclinedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_DECLINED,
    detail: detail as OfferDeclinedDetail,
    resources: [`offer/${detail.offerId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish OfferExpired event
 */
export async function publishOfferExpired(detail: Omit<OfferExpiredDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_EXPIRED,
    detail: detail as OfferExpiredDetail,
    resources: [`offer/${detail.offerId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}
