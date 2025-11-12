import {
  getEventPublisher,
  EventSources,
  EventTypes,
  IncidentCreatedDetail,
  IncidentStatusChangedDetail,
  IncidentAssignedDetail,
  IncidentCancelledDetail,
  IncidentEscalatedDetail,
  WorkStartedDetail,
  WorkCompletedDetail,
} from '@roadcall/events';

/**
 * Publish IncidentCreated event
 */
export async function publishIncidentCreated(detail: Omit<IncidentCreatedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_CREATED,
    detail: detail as IncidentCreatedDetail,
    resources: [`incident/${detail.incidentId}`],
  });
}

/**
 * Publish IncidentStatusChanged event
 */
export async function publishIncidentStatusChanged(
  detail: Omit<IncidentStatusChangedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_STATUS_CHANGED,
    detail: detail as IncidentStatusChangedDetail,
    resources: [`incident/${detail.incidentId}`],
  });
}

/**
 * Publish IncidentAssigned event
 */
export async function publishIncidentAssigned(
  detail: Omit<IncidentAssignedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_ASSIGNED,
    detail: detail as IncidentAssignedDetail,
    resources: [`incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish IncidentCancelled event
 */
export async function publishIncidentCancelled(
  detail: Omit<IncidentCancelledDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_CANCELLED,
    detail: detail as IncidentCancelledDetail,
    resources: [`incident/${detail.incidentId}`],
  });
}

/**
 * Publish IncidentEscalated event
 */
export async function publishIncidentEscalated(
  detail: Omit<IncidentEscalatedDetail, 'eventId' | 'timestamp' | 'version'>
): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_ESCALATED,
    detail: detail as IncidentEscalatedDetail,
    resources: [`incident/${detail.incidentId}`],
  });
}

/**
 * Publish WorkStarted event
 */
export async function publishWorkStarted(detail: Omit<WorkStartedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.WORK_STARTED,
    detail: detail as WorkStartedDetail,
    resources: [`incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}

/**
 * Publish WorkCompleted event
 */
export async function publishWorkCompleted(detail: Omit<WorkCompletedDetail, 'eventId' | 'timestamp' | 'version'>): Promise<void> {
  const publisher = getEventPublisher();
  await publisher.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.WORK_COMPLETED,
    detail: detail as WorkCompletedDetail,
    resources: [`incident/${detail.incidentId}`, `vendor/${detail.vendorId}`],
  });
}
