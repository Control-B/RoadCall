export type UserRole = 'driver' | 'vendor' | 'dispatcher' | 'admin';

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

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export type TrackingStatus = 'ACTIVE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';

export interface Location {
  lat: number;
  lon: number;
  timestamp?: string;
  accuracy?: number;
}

export interface User {
  userId: string;
  phone: string;
  role: UserRole;
  name: string;
  email?: string;
  companyId?: string;
  truckNumber?: string;
}

export interface Incident {
  incidentId: string;
  driverId: string;
  type: IncidentType;
  status: IncidentStatus;
  location: {
    lat: number;
    lon: number;
    address: string;
    roadSnapped?: { lat: number; lon: number };
  };
  weather?: {
    condition: string;
    temperature: number;
    visibility: number;
  };
  assignedVendorId?: string;
  createdAt: string;
  updatedAt: string;
  media?: MediaArtifact[];
}

export interface MediaArtifact {
  mediaId: string;
  type: 'photo' | 'video' | 'document';
  s3Key: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Offer {
  offerId: string;
  incidentId: string;
  vendorId: string;
  status: OfferStatus;
  matchScore: number;
  estimatedPayout: number;
  expiresAt: number;
  createdAt: string;
  incident?: Incident;
}

export interface TrackingSession {
  sessionId: string;
  incidentId: string;
  driverId: string;
  vendorId: string;
  status: TrackingStatus;
  driverLocation: Location;
  vendorLocation: Location;
  vendorRoute: Location[];
  eta: {
    minutes: number;
    distance: number;
    arrivalTime: string;
    confidence: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  vendorId: string;
  businessName: string;
  contactName: string;
  phone: string;
  rating: {
    average: number;
    count: number;
  };
}

export interface Payment {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  status: string;
  createdAt: string;
}

export interface NotificationPreferences {
  push: boolean;
  sms: boolean;
  email: boolean;
}
