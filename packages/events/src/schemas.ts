/**
 * EventBridge Event Schemas for Roadcall Platform
 * 
 * All domain events follow a consistent structure:
 * - Source: roadcall.{service}
 * - DetailType: {EventName}
 * - Detail: Event-specific payload
 */

// ============================================================================
// Base Event Types
// ============================================================================

export interface BaseEventDetail {
  eventId: string;
  timestamp: string;
  version: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Incident Events
// ============================================================================

export interface IncidentCreatedDetail extends BaseEventDetail {
  incidentId: string;
  driverId: string;
  type: 'tire' | 'engine' | 'tow';
  location: {
    lat: number;
    lon: number;
    address?: string;
  };
  phone: string;
  companyId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface IncidentStatusChangedDetail extends BaseEventDetail {
  incidentId: string;
  driverId: string;
  previousStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
}

export interface IncidentAssignedDetail extends BaseEventDetail {
  incidentId: string;
  driverId: string;
  vendorId: string;
  offerId: string;
  assignedAt: string;
}

export interface IncidentCancelledDetail extends BaseEventDetail {
  incidentId: string;
  driverId: string;
  vendorId?: string;
  reason: string;
  cancelledBy: string;
}

export interface IncidentEscalatedDetail extends BaseEventDetail {
  incidentId: string;
  driverId: string;
  reason: string;
  attempts: number;
  escalatedTo: string;
}

// ============================================================================
// Vendor Events
// ============================================================================

export interface VendorRegisteredDetail extends BaseEventDetail {
  vendorId: string;
  businessName: string;
  capabilities: string[];
  location: {
    lat: number;
    lon: number;
  };
  coverageRadiusMiles: number;
}

export interface VendorStatusChangedDetail extends BaseEventDetail {
  vendorId: string;
  previousStatus: 'available' | 'busy' | 'offline';
  newStatus: 'available' | 'busy' | 'offline';
  incidentId?: string;
}

export interface VendorLocationUpdatedDetail extends BaseEventDetail {
  vendorId: string;
  location: {
    lat: number;
    lon: number;
    accuracy?: number;
    timestamp: string;
  };
  incidentId?: string;
}

export interface VendorArrivedDetail extends BaseEventDetail {
  vendorId: string;
  incidentId: string;
  driverId: string;
  arrivedAt: string;
  location: {
    lat: number;
    lon: number;
  };
}

// ============================================================================
// Offer Events
// ============================================================================

export interface OfferCreatedDetail extends BaseEventDetail {
  offerId: string;
  incidentId: string;
  vendorId: string;
  matchScore: number;
  estimatedPayout: number;
  expiresAt: string;
  attempt: number;
}

export interface OfferAcceptedDetail extends BaseEventDetail {
  offerId: string;
  incidentId: string;
  vendorId: string;
  driverId: string;
  acceptedAt: string;
}

export interface OfferDeclinedDetail extends BaseEventDetail {
  offerId: string;
  incidentId: string;
  vendorId: string;
  reason?: string;
  declinedAt: string;
}

export interface OfferExpiredDetail extends BaseEventDetail {
  offerId: string;
  incidentId: string;
  vendorId: string;
  expiredAt: string;
}

// ============================================================================
// Tracking Events
// ============================================================================

export interface TrackingStartedDetail extends BaseEventDetail {
  sessionId: string;
  incidentId: string;
  driverId: string;
  vendorId: string;
  driverLocation: {
    lat: number;
    lon: number;
  };
  vendorLocation: {
    lat: number;
    lon: number;
  };
}

export interface TrackingUpdatedDetail extends BaseEventDetail {
  sessionId: string;
  incidentId: string;
  vendorId: string;
  location: {
    lat: number;
    lon: number;
  };
  eta: {
    minutes: number;
    distance: number;
  };
}

export interface TrackingStoppedDetail extends BaseEventDetail {
  sessionId: string;
  incidentId: string;
  reason: string;
  stoppedAt: string;
}

// ============================================================================
// Work Events
// ============================================================================

export interface WorkStartedDetail extends BaseEventDetail {
  incidentId: string;
  vendorId: string;
  driverId: string;
  startedAt: string;
}

export interface WorkCompletedDetail extends BaseEventDetail {
  incidentId: string;
  vendorId: string;
  driverId: string;
  completedAt: string;
  duration: number;
  notes?: string;
  mediaUrls?: string[];
}

// ============================================================================
// Payment Events
// ============================================================================

export interface PaymentCreatedDetail extends BaseEventDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  driverId: string;
  amountCents: number;
  currency: string;
  payerType: 'back_office' | 'driver_ic';
}

export interface PaymentApprovedDetail extends BaseEventDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  approvedBy: string;
  approvedAt: string;
  amountCents: number;
}

export interface PaymentCompletedDetail extends BaseEventDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  stripePaymentIntentId: string;
  completedAt: string;
}

export interface PaymentFailedDetail extends BaseEventDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  reason: string;
  failedAt: string;
}

export interface PaymentFlaggedDetail extends BaseEventDetail {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  fraudScore: number;
  reasons: string[];
  flaggedAt: string;
}

// ============================================================================
// Call Events
// ============================================================================

export interface CallStartedDetail extends BaseEventDetail {
  callId: string;
  phone: string;
  driverId?: string;
  direction: 'inbound' | 'outbound';
  startedAt: string;
}

export interface CallEndedDetail extends BaseEventDetail {
  callId: string;
  phone: string;
  driverId?: string;
  incidentId?: string;
  duration: number;
  recordingUrl?: string;
  endedAt: string;
}

export interface TranscriptReadyDetail extends BaseEventDetail {
  callId: string;
  incidentId?: string;
  transcriptId: string;
  confidence: number;
  hasPII: boolean;
}

export interface CallSummaryGeneratedDetail extends BaseEventDetail {
  callId: string;
  incidentId?: string;
  summaryId: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  actionItems: string[];
}

// ============================================================================
// User Events
// ============================================================================

export interface UserRegisteredDetail extends BaseEventDetail {
  userId: string;
  phone: string;
  role: 'driver' | 'vendor' | 'dispatcher' | 'admin';
  companyId?: string;
}

export interface UserVerifiedDetail extends BaseEventDetail {
  userId: string;
  phone: string;
  verifiedAt: string;
}

// ============================================================================
// Knowledge Base Events
// ============================================================================

export interface DocumentUploadedDetail extends BaseEventDetail {
  documentId: string;
  title: string;
  category: string;
  s3Key: string;
  uploadedBy: string;
}

export interface DocumentIndexedDetail extends BaseEventDetail {
  documentId: string;
  kendraDocumentId: string;
  indexedAt: string;
}

// ============================================================================
// Event Type Definitions
// ============================================================================

export const EventTypes = {
  // Incident events
  INCIDENT_CREATED: 'IncidentCreated',
  INCIDENT_STATUS_CHANGED: 'IncidentStatusChanged',
  INCIDENT_ASSIGNED: 'IncidentAssigned',
  INCIDENT_CANCELLED: 'IncidentCancelled',
  INCIDENT_ESCALATED: 'IncidentEscalated',

  // Vendor events
  VENDOR_REGISTERED: 'VendorRegistered',
  VENDOR_STATUS_CHANGED: 'VendorStatusChanged',
  VENDOR_LOCATION_UPDATED: 'VendorLocationUpdated',
  VENDOR_ARRIVED: 'VendorArrived',

  // Offer events
  OFFER_CREATED: 'OfferCreated',
  OFFER_ACCEPTED: 'OfferAccepted',
  OFFER_DECLINED: 'OfferDeclined',
  OFFER_EXPIRED: 'OfferExpired',

  // Tracking events
  TRACKING_STARTED: 'TrackingStarted',
  TRACKING_UPDATED: 'TrackingUpdated',
  TRACKING_STOPPED: 'TrackingStopped',

  // Work events
  WORK_STARTED: 'WorkStarted',
  WORK_COMPLETED: 'WorkCompleted',

  // Payment events
  PAYMENT_CREATED: 'PaymentCreated',
  PAYMENT_APPROVED: 'PaymentApproved',
  PAYMENT_COMPLETED: 'PaymentCompleted',
  PAYMENT_FAILED: 'PaymentFailed',
  PAYMENT_FLAGGED: 'PaymentFlagged',

  // Call events
  CALL_STARTED: 'CallStarted',
  CALL_ENDED: 'CallEnded',
  TRANSCRIPT_READY: 'TranscriptReady',
  CALL_SUMMARY_GENERATED: 'CallSummaryGenerated',

  // User events
  USER_REGISTERED: 'UserRegistered',
  USER_VERIFIED: 'UserVerified',

  // Knowledge base events
  DOCUMENT_UPLOADED: 'DocumentUploaded',
  DOCUMENT_INDEXED: 'DocumentIndexed',
} as const;

export const EventSources = {
  INCIDENT_SERVICE: 'roadcall.incident',
  VENDOR_SERVICE: 'roadcall.vendor',
  MATCH_SERVICE: 'roadcall.match',
  TRACKING_SERVICE: 'roadcall.tracking',
  PAYMENT_SERVICE: 'roadcall.payment',
  TELEPHONY_SERVICE: 'roadcall.telephony',
  AUTH_SERVICE: 'roadcall.auth',
  KB_SERVICE: 'roadcall.kb',
} as const;
