/**
 * Vendor Data Pipeline Types
 * 
 * Types for web scraping, data collection, and vendor data management
 */

export interface ScrapingTarget {
  targetId: string;
  url: string;
  sourceType: 'directory' | 'listing' | 'profile';
  selectors: {
    businessName?: string;
    phone?: string;
    address?: string;
    services?: string;
    hours?: string;
  };
  metadata: {
    region?: string;
    category?: string;
    priority?: number;
  };
}

export interface ScrapingResult {
  targetId: string;
  url: string;
  timestamp: string;
  success: boolean;
  data?: VendorData;
  error?: string;
  provenanceInfo: DataProvenance;
}

export interface VendorData {
  businessName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  services: string[];
  operatingHours?: Record<string, { open: string; close: string }>;
  website?: string;
  description?: string;
}

export interface DataProvenance {
  sourceUrl: string;
  collectedAt: string;
  collectorId: string;
  ipAddress: string;
  userAgent: string;
  method: 'scraping' | 'api' | 'manual';
  robotsTxtCompliant: boolean;
  legalFlags: string[];
}

export interface VerificationQueueItem {
  itemId: string;
  vendorData: VendorData;
  provenance: DataProvenance;
  status: 'pending' | 'approved' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

export interface ProxyConfig {
  proxyUrl: string;
  username?: string;
  password?: string;
  region?: string;
  lastUsed?: number;
  failureCount: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  delayBetweenRequests: number;
}

export interface AuditLogEntry {
  logId: string;
  timestamp: string;
  action: 'scrape_started' | 'scrape_completed' | 'scrape_failed' | 'robots_check' | 'rate_limit' | 'circuit_breaker_opened' | 'circuit_breaker_closed' | 'proxy_rotated';
  targetUrl: string;
  success: boolean;
  details: Record<string, any>;
  errorMessage?: string;
}
