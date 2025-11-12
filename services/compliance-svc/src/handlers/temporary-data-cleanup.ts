import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';

const logger = new Logger({ serviceName: 'compliance-svc' });
const tracer = new Tracer({ serviceName: 'compliance-svc' });
const metrics = new Metrics({ namespace: 'RoadcallAssistant', serviceName: 'compliance-svc' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = tracer.captureAWSv3Client(new S3Client({}));

const TRACKING_SESSIONS_TABLE = process.env.TRACKING_SESSIONS_TABLE!;
const CALL_RECORDINGS_BUCKET = process.env.CALL_RECORDINGS_BUCKET!;
const INCIDENT_MEDIA_BUCKET = process.env.INCIDENT_MEDIA_BUCKET!;
const RETENTION_DAYS = 90;

/**
 * Lambda handler for temporary data cleanup
 * Deletes GPS tracks, call recordings, and incident media older than 90 days
 * Triggered by EventBridge scheduled rule (daily)
 */
export const handler = async (event: any): Promise<void> => {
  logger.info('Starting temporary data cleanup job', { event });

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - RETENTION_DAYS);
    const thresholdTimestamp = thresholdDate.toISOString();

    logger.info('Cleaning up data older than', { thresholdTimestamp });

    // Clean up GPS tracking data
    const trackingSessionsDeleted = await cleanupTrackingSessions(thresholdTimestamp);
    logger.info('GPS tracking sessions cleaned', { count: trackingSessionsDeleted });
    metrics.addMetric('TrackingSessionsDeleted', MetricUnits.Count, trackingSessionsDeleted);

    // Clean up call recordings
    const callRecordingsDeleted = await cleanupCallRecordings(thresholdDate);
    logger.info('Call recordings cleaned', { count: callRecordingsDeleted });
    metrics.addMetric('CallRecordingsDeleted', MetricUnits.Count, callRecordingsDeleted);

    // Clean up incident media
    const incidentMediaDeleted = await cleanupIncidentMedia(thresholdDate);
    logger.info('Incident media cleaned', { count: incidentMediaDeleted });
    metrics.addMetric('IncidentMediaDeleted', MetricUnits.Count, incidentMediaDeleted);

    logger.info('Temporary data cleanup completed', {
      trackingSessionsDeleted,
      callRecordingsDeleted,
      incidentMediaDeleted,
    });
  } catch (error) {
    logger.error('Temporary data cleanup failed', { error });
    metrics.addMetric('CleanupJobFailures', MetricUnits.Count, 1);
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
};

/**
 * Clean up GPS tracking sessions older than retention period
 * Remove vendorPath and detailed location data
 */
async function cleanupTrackingSessions(thresholdTimestamp: string): Promise<number> {
  let deletedCount = 0;
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new ScanCommand({
      TableName: TRACKING_SESSIONS_TABLE,
      FilterExpression: 'createdAt < :threshold AND #status = :completed',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':threshold': thresholdTimestamp,
        ':completed': 'COMPLETED',
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);

    if (response.Items) {
      for (const session of response.Items) {
        try {
          // Remove detailed GPS path data but keep summary
          await docClient.send(new UpdateCommand({
            TableName: TRACKING_SESSIONS_TABLE,
            Key: { sessionId: session.sessionId },
            UpdateExpression: 'REMOVE vendorPath, route, vendorLocation, driverLocation',
            ConditionExpression: 'attribute_exists(sessionId)',
          }));
          deletedCount++;
        } catch (error) {
          logger.error('Failed to clean tracking session', { sessionId: session.sessionId, error });
        }
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return deletedCount;
}

/**
 * Clean up call recordings older than retention period
 */
async function cleanupCallRecordings(thresholdDate: Date): Promise<number> {
  let deletedCount = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const listResponse: any = await s3Client.send(new ListObjectsV2Command({
      Bucket: CALL_RECORDINGS_BUCKET,
      Prefix: 'recordings/',
      ContinuationToken: continuationToken,
    }));

    if (listResponse.Contents) {
      const objectsToDelete: { Key: string }[] = [];

      for (const object of listResponse.Contents) {
        if (object.LastModified && object.LastModified < thresholdDate) {
          objectsToDelete.push({ Key: object.Key! });
        }
      }

      if (objectsToDelete.length > 0) {
        // Delete in batches of 1000 (S3 limit)
        for (let i = 0; i < objectsToDelete.length; i += 1000) {
          const batch = objectsToDelete.slice(i, i + 1000);
          
          await s3Client.send(new DeleteObjectsCommand({
            Bucket: CALL_RECORDINGS_BUCKET,
            Delete: {
              Objects: batch,
              Quiet: true,
            },
          }));

          deletedCount += batch.length;
        }
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return deletedCount;
}

/**
 * Clean up incident media older than retention period
 */
async function cleanupIncidentMedia(thresholdDate: Date): Promise<number> {
  let deletedCount = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const listResponse: any = await s3Client.send(new ListObjectsV2Command({
      Bucket: INCIDENT_MEDIA_BUCKET,
      Prefix: 'media/',
      ContinuationToken: continuationToken,
    }));

    if (listResponse.Contents) {
      const objectsToDelete: { Key: string }[] = [];

      for (const object of listResponse.Contents) {
        if (object.LastModified && object.LastModified < thresholdDate) {
          objectsToDelete.push({ Key: object.Key! });
        }
      }

      if (objectsToDelete.length > 0) {
        // Delete in batches of 1000 (S3 limit)
        for (let i = 0; i < objectsToDelete.length; i += 1000) {
          const batch = objectsToDelete.slice(i, i + 1000);
          
          await s3Client.send(new DeleteObjectsCommand({
            Bucket: INCIDENT_MEDIA_BUCKET,
            Delete: {
              Objects: batch,
              Quiet: true,
            },
          }));

          deletedCount += batch.length;
        }
      }
    }

    continuationToken = listResponse.NextContinuationToken;
  } while (continuationToken);

  return deletedCount;
}
