import { v4 as uuidv4 } from 'uuid';
import {
  Incident,
  IncidentType,
  IncidentStatus,
  StateTransition,
  MediaArtifact,
} from '@roadcall/types';
import { dynamodb, eventBridge, EventSources, EventTypes, s3 } from '@roadcall/aws-clients';
import { logger, NotFoundError, ValidationError, ConflictError } from '@roadcall/utils';
import { enrichIncidentLocation } from './location-service';

const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE || '';
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || '';

/**
 * Get incident by ID
 */
export async function getIncidentById(incidentId: string): Promise<Incident | null> {
  return dynamodb.get<Incident>(INCIDENTS_TABLE, { incidentId });
}

/**
 * Create new incident
 */
export async function createIncident(
  driverId: string,
  type: IncidentType,
  lat: number,
  lon: number,
  callRecordingUrl?: string,
  transcriptId?: string
): Promise<Incident> {
  // Enrich location with geocoding, road snapping, and weather
  const { location, weather } = await enrichIncidentLocation(lat, lon);

  const incident: Incident = {
    incidentId: uuidv4(),
    driverId,
    type,
    status: 'created',
    location,
    weather,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [
      {
        from: 'created' as IncidentStatus,
        to: 'created',
        timestamp: new Date().toISOString(),
        actor: driverId,
      },
    ],
    media: [],
    callRecordingUrl,
    transcriptId,
  };

  // Store in DynamoDB
  await dynamodb.put(INCIDENTS_TABLE, incident);

  // Publish IncidentCreated event
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_CREATED,
    detail: {
      incidentId: incident.incidentId,
      driverId: incident.driverId,
      type: incident.type,
      location: incident.location,
      createdAt: incident.createdAt,
    },
  });

  logger.info('Incident created', { incidentId: incident.incidentId, driverId, type });

  return incident;
}

/**
 * Update incident status
 */
export async function updateIncidentStatus(
  incidentId: string,
  newStatus: IncidentStatus,
  actor: string,
  reason?: string
): Promise<Incident> {
  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  // Validate status transition
  validateStatusTransition(incident.status, newStatus);

  // Create state transition record
  const transition: StateTransition = {
    from: incident.status,
    to: newStatus,
    timestamp: new Date().toISOString(),
    actor,
    reason,
  };

  // Update incident
  await dynamodb.update(INCIDENTS_TABLE, { incidentId }, {
    status: newStatus,
    updatedAt: new Date().toISOString(),
    timeline: [...incident.timeline, transition],
  });

  // Publish IncidentStatusChanged event
  await eventBridge.publishEvent({
    source: EventSources.INCIDENT_SERVICE,
    detailType: EventTypes.INCIDENT_STATUS_CHANGED,
    detail: {
      incidentId,
      previousStatus: incident.status,
      newStatus,
      actor,
      timestamp: transition.timestamp,
    },
  });

  logger.info('Incident status updated', { incidentId, from: incident.status, to: newStatus });

  const updatedIncident = await getIncidentById(incidentId);
  if (!updatedIncident) {
    throw new Error('Incident not found after update');
  }

  return updatedIncident;
}

/**
 * Validate status transition
 */
function validateStatusTransition(from: IncidentStatus, to: IncidentStatus): void {
  const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
    created: ['vendor_assigned', 'cancelled'],
    vendor_assigned: ['vendor_en_route', 'cancelled'],
    vendor_en_route: ['vendor_arrived', 'cancelled'],
    vendor_arrived: ['work_in_progress', 'cancelled'],
    work_in_progress: ['work_completed', 'cancelled'],
    work_completed: ['payment_pending'],
    payment_pending: ['closed'],
    closed: [],
    cancelled: [],
  };

  if (!validTransitions[from].includes(to)) {
    throw new ValidationError(`Invalid status transition from ${from} to ${to}`);
  }
}

/**
 * Assign vendor to incident
 */
export async function assignVendor(
  incidentId: string,
  vendorId: string,
  actor: string
): Promise<Incident> {
  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  if (incident.assignedVendorId) {
    throw new ConflictError('Incident already has an assigned vendor');
  }

  // Update incident with vendor assignment
  await dynamodb.update(INCIDENTS_TABLE, { incidentId }, {
    assignedVendorId: vendorId,
    updatedAt: new Date().toISOString(),
  });

  // Update status to vendor_assigned
  await updateIncidentStatus(incidentId, 'vendor_assigned', actor, 'Vendor assigned to incident');

  logger.info('Vendor assigned to incident', { incidentId, vendorId });

  const updatedIncident = await getIncidentById(incidentId);
  if (!updatedIncident) {
    throw new Error('Incident not found after update');
  }

  return updatedIncident;
}

/**
 * Cancel incident
 */
export async function cancelIncident(
  incidentId: string,
  actor: string,
  reason: string
): Promise<Incident> {
  return updateIncidentStatus(incidentId, 'cancelled', actor, reason);
}

/**
 * Get incidents by driver
 */
export async function getIncidentsByDriver(
  driverId: string,
  status?: IncidentStatus
): Promise<Incident[]> {
  const keyCondition = status ? 'driverId = :driverId AND status = :status' : 'driverId = :driverId';
  const expressionValues = status
    ? { ':driverId': driverId, ':status': status }
    : { ':driverId': driverId };

  const incidents = await dynamodb.query<Incident>(
    INCIDENTS_TABLE,
    keyCondition,
    expressionValues,
    'driver-status-index'
  );

  logger.info('Incidents retrieved by driver', { driverId, status, count: incidents.length });

  return incidents;
}

/**
 * Get incidents by vendor
 */
export async function getIncidentsByVendor(
  vendorId: string,
  status?: IncidentStatus
): Promise<Incident[]> {
  const keyCondition = status
    ? 'assignedVendorId = :vendorId AND status = :status'
    : 'assignedVendorId = :vendorId';
  const expressionValues = status
    ? { ':vendorId': vendorId, ':status': status }
    : { ':vendorId': vendorId };

  const incidents = await dynamodb.query<Incident>(
    INCIDENTS_TABLE,
    keyCondition,
    expressionValues,
    'vendor-status-index'
  );

  logger.info('Incidents retrieved by vendor', { vendorId, status, count: incidents.length });

  return incidents;
}

/**
 * Get incidents by status
 */
export async function getIncidentsByStatus(status: IncidentStatus): Promise<Incident[]> {
  const incidents = await dynamodb.query<Incident>(
    INCIDENTS_TABLE,
    'status = :status',
    { ':status': status },
    'status-created-index'
  );

  logger.info('Incidents retrieved by status', { status, count: incidents.length });

  return incidents;
}

/**
 * Add media to incident
 */
export async function addMediaToIncident(
  incidentId: string,
  mediaType: 'photo' | 'video' | 'document',
  s3Key: string,
  uploadedBy: string,
  metadata?: Record<string, unknown>
): Promise<MediaArtifact> {
  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  const media: MediaArtifact = {
    mediaId: uuidv4(),
    type: mediaType,
    s3Key,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    metadata,
  };

  // Update incident with new media
  await dynamodb.update(INCIDENTS_TABLE, { incidentId }, {
    media: [...incident.media, media],
    updatedAt: new Date().toISOString(),
  });

  logger.info('Media added to incident', { incidentId, mediaId: media.mediaId, type: mediaType });

  return media;
}

/**
 * Generate presigned URL for media upload
 */
export async function generateMediaUploadUrl(
  incidentId: string,
  fileName: string,
  contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'video/mp4', 'video/quicktime', 'application/pdf'];
  if (!allowedTypes.includes(contentType)) {
    throw new ValidationError(`File type ${contentType} is not allowed`);
  }

  // Generate S3 key
  const timestamp = Date.now();
  const s3Key = `incidents/${incidentId}/${timestamp}-${fileName}`;

  // Generate presigned URL (valid for 15 minutes)
  const uploadUrl = await s3.getPresignedUploadUrl(MEDIA_BUCKET, s3Key, contentType, 900);

  logger.info('Media upload URL generated', { incidentId, s3Key });

  return { uploadUrl, s3Key };
}

/**
 * Update incident summary
 */
export async function updateIncidentSummary(
  incidentId: string,
  summaryId: string
): Promise<void> {
  const incident = await getIncidentById(incidentId);
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  await dynamodb.update(INCIDENTS_TABLE, { incidentId }, {
    summaryId,
    updatedAt: new Date().toISOString(),
  });

  logger.info('Incident summary updated', { incidentId, summaryId });
}
