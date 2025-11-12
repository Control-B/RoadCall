// Core domain types for the AI Roadcall Assistant platform

// ============================================================================
// User Types
// ============================================================================

export type UserRole = 'driver' | 'vendor' | 'dispatcher' | 'admin';

export interface User {
  userId: string;
  phone: string;
  role: UserRole;
  name: string;
  email?: string;
  companyId?: string;
  truckNumber?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface OTPSession {
  phone: string;
  otp: string;
  expiresAt: number;
  attempts: number;
}

// ============================================================================
// Incident Types
// ============================================================================

export type IncidentType = 'tire' | 'engine' | 'tow';

export type IncidentStatus =
  | 'created'
  | 'vendor_assigned'
  | 'vendor_en_route'
  | 'vendor_arrived'
  | 'work_in_progress'
  | 'work_completed'
  | 'payment_pending'
  | 'closed'
  | 'cancelled';

export interface Location {
  lat: number;
  lon: number;
  timestamp?: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
}

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

export interface IncidentLocation {
  lat: number;
  lon: number;
  address: string;
  roadSnapped: { lat: number; lon: number };
}

export interface WeatherCondition {
  condition: string;
  temperature: number;
  visibility: number;
}

export interface StateTransition {
  from: IncidentStatus;
  to: IncidentStatus;
  timestamp: string;
  actor: string;
  reason?: string;
}

export interface MediaArtifact {
  mediaId: string;
  type: 'photo' | 'video' | 'document';
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Incident {
  incidentId: string;
  driverId: string;
  type: IncidentType;
  status: IncidentStatus;
  location: IncidentLocation;
  weather?: WeatherCondition;
  assignedVendorId?: string;
  createdAt: string;
  updatedAt: string;
  timeline: StateTransition[];
  media: MediaArtifact[];
  callRecordingUrl?: string;
  transcriptId?: string;
  summaryId?: string;
}

// ============================================================================
// Vendor Types
// ============================================================================

export type ServiceCapability =
  | 'tire_repair'
  | 'tire_replacement'
  | 'engine_repair'
  | 'towing'
  | 'jumpstart'
  | 'fuel_delivery';

export type VendorAvailabilityStatus = 'available' | 'busy' | 'offline';

export interface VendorCoverageArea {
  center: { lat: number; lon: number };
  radiusMiles: number;
  geofenceIds: string[];
}

export interface VendorAvailability {
  status: VendorAvailabilityStatus;
  currentIncidentId?: string;
  lastUpdated: string;
}

export interface VendorRating {
  average: number;
  count: number;
}

export interface VendorMetrics {
  acceptanceRate: number;
  avgResponseTime: number;
  completionRate: number;
  totalJobs: number;
}

export interface VendorPricing {
  [serviceType: string]: {
    basePrice: number;
    perMileRate: number;
  };
}

export interface Vendor {
  vendorId: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  capabilities: ServiceCapability[];
  coverageArea: VendorCoverageArea;
  availability: VendorAvailability;
  operatingHours: {
    [day: string]: { open: string; close: string };
  };
  rating: VendorRating;
  metrics: VendorMetrics;
  pricing: VendorPricing;
  certifications: string[];
  insuranceExpiry: string;
  backgroundCheckStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  verifiedAt?: string;
}

// ============================================================================
// Offer Types
// ============================================================================

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface MatchScoreBreakdown {
  distance: number;
  capability: number;
  availability: number;
  acceptanceRate: number;
  rating: number;
}

export interface Offer {
  offerId: string;
  incidentId: string;
  vendorId: string;
  status: OfferStatus;
  matchScore: number;
  scoreBreakdown: MatchScoreBreakdown;
  estimatedPayout: number;
  expiresAt: number;
  createdAt: string;
  respondedAt?: string;
  declineReason?: string;
}

// ============================================================================
// Tracking Types
// ============================================================================

export type TrackingStatus = 'active' | 'arrived' | 'completed' | 'cancelled';

export interface RouteSegment {
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  distance: number;
  duration: number;
}

export interface ETACalculation {
  minutes: number;
  distanceMiles: number;
  arrivalTime: string;
  confidence: number;
  calculatedAt: string;
}

export interface TrackingSession {
  sessionId: string;
  incidentId: string;
  driverId: string;
  vendorId: string;
  status: TrackingStatus;
  driverLocation: Location;
  vendorLocation: Location;
  vendorPath: Location[];
  route: RouteSegment[];
  eta: ETACalculation;
  geofenceId: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentStatus =
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

export type PayerType = 'back_office' | 'driver_ic';

export interface PaymentLineItem {
  lineItemId: string;
  paymentId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface Payment {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  payerType: PayerType;
  payerId?: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  fraudScore?: number;
  fraudStatus?: string;
  approvedBy?: string;
  approvedAt?: string;
  processedAt?: string;
  failedReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType =
  | 'offer_received'
  | 'offer_accepted'
  | 'vendor_en_route'
  | 'vendor_arrived'
  | 'work_started'
  | 'work_completed'
  | 'payment_approved'
  | 'incident_cancelled'
  | 'otp_code'
  | 'system_alert';

export type NotificationChannel = 'push' | 'sms' | 'email';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationRequest {
  type: NotificationType;
  recipientId: string;
  recipientType: UserRole;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  data: Record<string, unknown>;
  templateId?: string;
  scheduledFor?: string;
}

// ============================================================================
// Call/Telephony Types
// ============================================================================

export type CallDirection = 'inbound' | 'outbound';

export interface CallRecord {
  callId: string;
  incidentId?: string;
  driverId?: string;
  phone: string;
  direction: CallDirection;
  duration: number;
  recordingUrl: string;
  transcriptId?: string;
  summaryId?: string;
  startTime: string;
  endTime: string;
  disposition: string;
}

export interface PIIEntity {
  type: string;
  text: string;
  score: number;
  beginOffset: number;
  endOffset: number;
}

export interface Transcript {
  transcriptId: string;
  callId: string;
  incidentId?: string;
  rawText: string;
  redactedText: string;
  piiEntities: PIIEntity[];
  confidence: number;
  createdAt: string;
}

export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface CallSummary {
  summaryId: string;
  callId: string;
  incidentId?: string;
  summary: string;
  incidentType?: IncidentType;
  urgency: UrgencyLevel;
  actionItems: string[];
  sentiment: Sentiment;
  keyPhrases: string[];
  generatedAt: string;
}

// ============================================================================
// Knowledge Base Types
// ============================================================================

export type KBDocumentCategory = 'sop' | 'vendor_sla' | 'troubleshooting' | 'policy';

export type KBIndexStatus = 'pending' | 'indexed' | 'failed';

export interface KBDocumentMetadata {
  tags: string[];
  version: string;
  effectiveDate?: string;
  expiryDate?: string;
}

export interface KBDocument {
  documentId: string;
  title: string;
  category: KBDocumentCategory;
  s3Key: string;
  s3Bucket: string;
  fileType: string;
  fileSize: number;
  kendraDocumentId?: string;
  indexStatus: KBIndexStatus;
  uploadedBy: string;
  uploadedAt: string;
  lastIndexedAt?: string;
  metadata: KBDocumentMetadata;
}

// ============================================================================
// Driver Types
// ============================================================================

export type DriverStatus = 'active' | 'inactive' | 'suspended';

export interface DriverPreferences {
  language: string;
  autoShareLocation: boolean;
}

export interface DriverStats {
  totalIncidents: number;
  avgRating: number;
  lastIncidentAt?: string;
}

export interface Driver {
  driverId: string;
  userId: string;
  phone: string;
  name: string;
  email?: string;
  companyId: string;
  companyName: string;
  truckNumber: string;
  licenseNumber?: string;
  licenseState?: string;
  paymentType: 'company' | 'independent_contractor';
  preferences: DriverPreferences;
  stats: DriverStats;
  status: DriverStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  // Client errors (4xx)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  DEPENDENCY_ERROR = 'DEPENDENCY_ERROR',

  // Business errors
  INCIDENT_ALREADY_ASSIGNED = 'INCIDENT_ALREADY_ASSIGNED',
  VENDOR_NOT_AVAILABLE = 'VENDOR_NOT_AVAILABLE',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  FRAUD_DETECTED = 'FRAUD_DETECTED',
}

export interface ErrorResponse {
  error: {
    type: ErrorType;
    message: string;
    code: string;
    details?: Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PaginationParams {
  limit?: number;
  nextToken?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  total?: number;
}

export interface APIResponse<T> {
  data: T;
  requestId: string;
  timestamp: string;
}
