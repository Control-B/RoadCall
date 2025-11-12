import {
  getEventPublisher,
  EventSources,
  EventTypes,
  PaymentCreatedDetail,
  PaymentApprovedDetail,
  PaymentCompletedDetail,
  PaymentFailedDetail,
  PaymentFlaggedDetail,
} from '@roadcall/events';

/**
 * Publish PaymentCreated event
 */
export async function publishPaymentCreated(detail: Omit<PaymentCreatedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: EventTypes.PAYMENT_CREATED,
    detail: detail as PaymentCreatedDetail,
    resources: [`payment/${detail.paymentId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish PaymentApproved event
 */
export async function publishPaymentApproved(
  detail: Omit<PaymentApprovedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: EventTypes.PAYMENT_APPROVED,
    detail: detail as PaymentApprovedDetail,
    resources: [`payment/${detail.paymentId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish PaymentCompleted event
 */
export async function publishPaymentCompleted(
  detail: Omit<PaymentCompletedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: EventTypes.PAYMENT_COMPLETED,
    detail: detail as PaymentCompletedDetail,
    resources: [`payment/${detail.paymentId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish PaymentFailed event
 */
export async function publishPaymentFailed(detail: Omit<PaymentFailedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: EventTypes.PAYMENT_FAILED,
    detail: detail as PaymentFailedDetail,
    resources: [`payment/${detail.paymentId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish PaymentFlagged event
 */
export async function publishPaymentFlagged(detail: Omit<PaymentFlaggedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.PAYMENT_SERVICE,
    detailType: EventTypes.PAYMENT_FLAGGED,
    detail: detail as PaymentFlaggedDetail,
    resources: [`payment/${detail.paymentId}`, `incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}
