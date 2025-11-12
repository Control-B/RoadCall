/**
 * Vendor Data Pipeline Service
 * 
 * Main exports for the vendor data collection pipeline
 */

// Core pipeline
export { VendorDataPipeline } from './data-pipeline';
export { WebScraper } from './web-scraper';

// Components
export { RobotsChecker } from './robots-checker';
export { RateLimiter } from './rate-limiter';
export { ProxyManager } from './proxy-manager';
export { AuditLogger } from './audit-logger';
export { DataCollectionCircuitBreaker } from './circuit-breaker';
export { VerificationQueue } from './verification-queue';

// Types
export * from './types';

// Handlers
export * from './handlers/scrape-handler';
export * from './handlers/verification-handler';
