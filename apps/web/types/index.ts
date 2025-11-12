export type UserRole = 'driver' | 'vendor' | 'dispatcher' | 'admin'

export type IncidentType = 'tire' | 'engine' | 'tow'

export type IncidentStatus =
  | 'created'
  | 'vendor_assigned'
  | 'vendor_en_route'
  | 'vendor_arrived'
  | 'work_in_progress'
  | 'work_completed'
  | 'payment_pending'
  | 'closed'
  | 'cancelled'

export interface User {
  userId: string
  phone: string
  role: UserRole
  name: string
  email?: string
  companyId?: string
  companyName?: string
}

export interface Location {
  lat: number
  lon: number
  address?: string
}

export interface Incident {
  incidentId: string
  driverId: string
  driverName?: string
  type: IncidentType
  status: IncidentStatus
  location: Location
  weather?: {
    condition: string
    temperature: number
    visibility: number
  }
  assignedVendorId?: string
  assignedVendorName?: string
  createdAt: string
  updatedAt: string
  timeline: StateTransition[]
  media?: MediaArtifact[]
}

export interface StateTransition {
  from: IncidentStatus
  to: IncidentStatus
  timestamp: string
  actor: string
  reason?: string
}

export interface MediaArtifact {
  mediaId: string
  type: 'photo' | 'video' | 'document'
  s3Key: string
  uploadedBy: string
  uploadedAt: string
}

export interface Vendor {
  vendorId: string
  businessName: string
  contactName: string
  phone: string
  email: string
  capabilities: string[]
  location: Location
  availability: {
    status: 'available' | 'busy' | 'offline'
    currentIncidentId?: string
    lastUpdated: string
  }
  rating: {
    average: number
    count: number
  }
  metrics: {
    acceptanceRate: number
    avgResponseTime: number
    completionRate: number
    totalJobs: number
  }
}

export interface Offer {
  offerId: string
  incidentId: string
  vendorId: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  matchScore: number
  estimatedPayout: number
  expiresAt: number
  createdAt: string
  respondedAt?: string
  declineReason?: string
}

export interface TrackingSession {
  sessionId: string
  incidentId: string
  driverId: string
  vendorId: string
  status: 'ACTIVE' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED'
  driverLocation: LocationPoint
  vendorLocation: LocationPoint
  vendorRoute: LocationPoint[]
  eta: ETACalculation
  createdAt: string
  updatedAt: string
}

export interface LocationPoint {
  lat: number
  lon: number
  timestamp: string
  accuracy?: number
  speed?: number
  heading?: number
}

export interface ETACalculation {
  minutes: number
  distanceMiles: number
  arrivalTime: string
  confidence: number
  calculatedAt: string
}

export interface Payment {
  paymentId: string
  incidentId: string
  vendorId: string
  payerType: 'back_office' | 'driver_ic'
  amountCents: number
  currency: string
  status: string
  approvedBy?: string
  approvedAt?: string
  processedAt?: string
  createdAt: string
}

export interface AdminConfig {
  matchingWeights: {
    distance: number
    capability: number
    availability: number
    acceptanceRate: number
    rating: number
  }
  slaTiers: {
    [key: string]: {
      responseTimeMinutes: number
      pricingMultiplier: number
    }
  }
}
