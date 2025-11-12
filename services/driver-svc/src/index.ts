// Export all handlers
export { handler as getDriverHandler } from './handlers/get-driver';
export { handler as updateDriverHandler } from './handlers/update-driver';
export { handler as getIncidentsHandler } from './handlers/get-incidents';
export { handler as getPreferencesHandler } from './handlers/get-preferences';
export { handler as updatePreferencesHandler } from './handlers/update-preferences';

// Export services
export * from './driver-service';
