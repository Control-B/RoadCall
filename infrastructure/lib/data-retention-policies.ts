import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface DataRetentionPoliciesProps {
  callRecordingsBucket: s3.IBucket;
  incidentMediaBucket: s3.IBucket;
  kbDocumentsBucket: s3.IBucket;
  logBucket?: s3.IBucket;
}

/**
 * Configure data retention and lifecycle policies for S3 buckets
 * Implements requirements 11.3, 11.5, 20.5
 */
export class DataRetentionPolicies extends Construct {
  constructor(scope: Construct, id: string, props: DataRetentionPoliciesProps) {
    super(scope, id);

    // Configure lifecycle policies for call recordings bucket
    // - Delete call recordings after 90 days (data minimization)
    // - Transition to Glacier after 30 days for cost optimization
    this.configureCallRecordingsLifecycle(props.callRecordingsBucket);

    // Configure lifecycle policies for incident media bucket
    // - Delete incident media after 90 days (data minimization)
    // - Transition to Glacier after 30 days
    this.configureIncidentMediaLifecycle(props.incidentMediaBucket);

    // Configure lifecycle policies for knowledge base documents
    // - Keep indefinitely but transition to Glacier after 90 days
    this.configureKBDocumentsLifecycle(props.kbDocumentsBucket);

    // Configure lifecycle policies for logs bucket if provided
    if (props.logBucket) {
      this.configureLogBucketLifecycle(props.logBucket);
    }
  }

  /**
   * Configure lifecycle policy for call recordings
   * - Transition to Glacier after 30 days
   * - Delete after 90 days (compliance requirement)
   */
  private configureCallRecordingsLifecycle(bucket: s3.IBucket): void {
    if (bucket instanceof s3.Bucket) {
      bucket.addLifecycleRule({
        id: 'CallRecordingsRetention',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(30),
          },
        ],
        expiration: cdk.Duration.days(90),
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
      });

      // Add lifecycle rule for transcripts (separate prefix)
      bucket.addLifecycleRule({
        id: 'TranscriptsRetention',
        enabled: true,
        prefix: 'transcripts/',
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(30),
          },
        ],
        expiration: cdk.Duration.days(90),
      });
    }
  }

  /**
   * Configure lifecycle policy for incident media
   * - Transition to Glacier after 30 days
   * - Delete after 90 days (data minimization)
   */
  private configureIncidentMediaLifecycle(bucket: s3.IBucket): void {
    if (bucket instanceof s3.Bucket) {
      bucket.addLifecycleRule({
        id: 'IncidentMediaRetention',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(30),
          },
        ],
        expiration: cdk.Duration.days(90),
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
      });
    }
  }

  /**
   * Configure lifecycle policy for knowledge base documents
   * - Transition to Glacier after 90 days
   * - Keep indefinitely (no expiration)
   */
  private configureKBDocumentsLifecycle(bucket: s3.IBucket): void {
    if (bucket instanceof s3.Bucket) {
      bucket.addLifecycleRule({
        id: 'KBDocumentsArchival',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(90),
          },
        ],
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
      });
    }
  }

  /**
   * Configure lifecycle policy for log bucket
   * - Transition to Glacier after 90 days
   * - Keep for 7 years (audit requirement)
   */
  private configureLogBucketLifecycle(bucket: s3.IBucket): void {
    if (bucket instanceof s3.Bucket) {
      bucket.addLifecycleRule({
        id: 'AuditLogsRetention',
        enabled: true,
        transitions: [
          {
            storageClass: s3.StorageClass.GLACIER,
            transitionAfter: cdk.Duration.days(90),
          },
          {
            storageClass: s3.StorageClass.DEEP_ARCHIVE,
            transitionAfter: cdk.Duration.days(365),
          },
        ],
        expiration: cdk.Duration.days(7 * 365), // 7 years
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
      });
    }
  }
}

/**
 * Configure CloudWatch Logs retention policies
 * - Application logs: 1 year
 * - Audit logs: 7 years
 */
export function configureCloudWatchLogsRetention(
  scope: Construct,
  logGroups: { name: string; isAuditLog: boolean }[]
): void {
  logGroups.forEach(({ name, isAuditLog }) => {
    const retention = isAuditLog
      ? logs.RetentionDays.TEN_YEARS // Closest to 7 years
      : logs.RetentionDays.ONE_YEAR;

    new logs.LogGroup(scope, `LogGroup-${name}`, {
      logGroupName: name,
      retention,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  });
}
