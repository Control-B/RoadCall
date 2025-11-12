// Export all handlers for Lambda functions
export { handler as startTracking } from './handlers/start-tracking';
export { handler as updateVendorLocation } from './handlers/update-vendor-location';
export { handler as stopTracking } from './handlers/stop-tracking';
export { handler as getTrackingSession } from './handlers/get-tracking-session';
export { handler as getActiveSessionByIncident } from './handlers/get-active-session-by-incident';

// Export service for testing
export { TrackingService } from './tracking-service';
