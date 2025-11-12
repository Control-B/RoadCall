// Export all handlers
export { handler as sendNotificationHandler } from './handlers/send-notification';
export { handler as eventHandler } from './handlers/event-handler';
export { handler as getPreferencesHandler } from './handlers/get-preferences';
export { handler as updatePreferencesHandler } from './handlers/update-preferences';
export { handler as getHistoryHandler } from './handlers/get-history';
export { handler as sqsProcessorHandler } from './handlers/sqs-processor';

// Export services and types
export * from './notification-service';
export * from './templates';
export * from './types';
