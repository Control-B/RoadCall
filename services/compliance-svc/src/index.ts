/**
 * Compliance Service
 * 
 * Handles data retention, GDPR compliance, and user privacy features.
 * 
 * Features:
 * - Automated PII deletion after 3 years of inactivity
 * - Data export (GDPR Article 15)
 * - Right to be forgotten (GDPR Article 17)
 * - Consent management (GDPR Article 7)
 * - Temporary data cleanup (GPS tracks, recordings)
 * - S3 lifecycle policies for cost optimization
 * - Audit logging for compliance tracking
 */

export { handler as piiDeletionHandler } from './handlers/pii-deletion';
export { handler as dataExportHandler } from './handlers/data-export';
export { handler as rightToBeForgottenHandler } from './handlers/right-to-be-forgotten';
export { handler as consentManagementHandler } from './handlers/consent-management';
export { handler as temporaryDataCleanupHandler } from './handlers/temporary-data-cleanup';
