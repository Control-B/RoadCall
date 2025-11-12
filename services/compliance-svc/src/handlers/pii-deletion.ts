import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';

const logger = new Logger({ serviceName: 'compliance-svc' });
const tracer = new Tracer({ serviceName: 'compliance-svc' });
const metrics = new Metrics({ namespace: 'RoadcallAssistant', serviceName: 'compliance-svc' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rdsClient = tracer.captureAWSv3Client(new RDSDataClient({}));

const INACTIVITY_THRESHOLD_DAYS = 3 * 365; // 3 years
const USERS_TABLE = process.env.USERS_TABLE!;
const DRIVERS_TABLE = process.env.DRIVERS_TABLE!;
const VENDORS_TABLE = process.env.VENDORS_TABLE!;
const CALL_RECORDS_TABLE = process.env.CALL_RECORDS_TABLE!;
const AURORA_CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN!;
const AURORA_SECRET_ARN = process.env.AURORA_SECRET_ARN!;
const DATABASE_NAME = process.env.DATABASE_NAME!;

interface User {
  userId: string;
  phone: string;
  email?: string;
  name: string;
  lastLoginAt?: string;
  createdAt: string;
  status: string;
}

/**
 * Lambda handler for automated PII deletion after 3 years of inactivity
 * Triggered by EventBridge scheduled rule (daily)
 */
export const handler = async (event: any): Promise<void> => {
  logger.info('Starting PII deletion job', { event });

  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - INACTIVITY_THRESHOLD_DAYS);
    const thresholdTimestamp = thresholdDate.toISOString();

    logger.info('Scanning for inactive users', { thresholdTimestamp });

    // Find inactive users
    const inactiveUsers = await findInactiveUsers(thresholdTimestamp);
    logger.info(`Found ${inactiveUsers.length} inactive users`);

    metrics.addMetric('InactiveUsersFound', MetricUnits.Count, inactiveUsers.length);

    let deletedCount = 0;
    let errorCount = 0;

    // Process each inactive user
    for (const user of inactiveUsers) {
      try {
        await deletePIIForUser(user);
        deletedCount++;
        logger.info('PII deleted for user', { userId: user.userId });
      } catch (error) {
        errorCount++;
        logger.error('Failed to delete PII for user', { userId: user.userId, error });
      }
    }

    metrics.addMetric('PIIRecordsDeleted', MetricUnits.Count, deletedCount);
    metrics.addMetric('PIIDeletionErrors', MetricUnits.Count, errorCount);

    logger.info('PII deletion job completed', { deletedCount, errorCount });
  } catch (error) {
    logger.error('PII deletion job failed', { error });
    metrics.addMetric('PIIDeletionJobFailures', MetricUnits.Count, 1);
    throw error;
  } finally {
    metrics.publishStoredMetrics();
  }
};

/**
 * Find users who have been inactive for more than the threshold
 */
async function findInactiveUsers(thresholdTimestamp: string): Promise<User[]> {
  const inactiveUsers: User[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'attribute_not_exists(lastLoginAt) OR lastLoginAt < :threshold',
      ExpressionAttributeValues: {
        ':threshold': thresholdTimestamp,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);
    
    if (response.Items) {
      inactiveUsers.push(...(response.Items as User[]));
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return inactiveUsers;
}

/**
 * Delete or anonymize PII for a specific user
 */
async function deletePIIForUser(user: User): Promise<void> {
  logger.info('Deleting PII for user', { userId: user.userId });

  // Anonymize user record (keep userId for referential integrity)
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId: user.userId },
    UpdateExpression: 'SET #phone = :anon, #email = :anon, #name = :anon, #status = :deleted, #deletedAt = :now',
    ExpressionAttributeNames: {
      '#phone': 'phone',
      '#email': 'email',
      '#name': 'name',
      '#status': 'status',
      '#deletedAt': 'deletedAt',
    },
    ExpressionAttributeValues: {
      ':anon': '[DELETED]',
      ':deleted': 'deleted',
      ':now': new Date().toISOString(),
    },
  }));

  // Anonymize driver record if exists
  try {
    await docClient.send(new UpdateCommand({
      TableName: DRIVERS_TABLE,
      Key: { driverId: user.userId },
      UpdateExpression: 'SET #phone = :anon, #email = :anon, #name = :anon, #licenseNumber = :anon',
      ExpressionAttributeNames: {
        '#phone': 'phone',
        '#email': 'email',
        '#name': 'name',
        '#licenseNumber': 'licenseNumber',
      },
      ExpressionAttributeValues: {
        ':anon': '[DELETED]',
      },
    }));
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  // Anonymize vendor record if exists
  try {
    await docClient.send(new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { vendorId: user.userId },
      UpdateExpression: 'SET #phone = :anon, #email = :anon, #contactName = :anon',
      ExpressionAttributeNames: {
        '#phone': 'phone',
        '#email': 'email',
        '#contactName': 'contactName',
      },
      ExpressionAttributeValues: {
        ':anon': '[DELETED]',
      },
    }));
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  // Anonymize call records
  await anonymizeCallRecords(user.userId);

  // Anonymize payment records in Aurora
  await anonymizePaymentRecords(user.userId);

  logger.info('PII deletion completed for user', { userId: user.userId });
}

/**
 * Anonymize call records for a user
 */
async function anonymizeCallRecords(userId: string): Promise<void> {
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new ScanCommand({
      TableName: CALL_RECORDS_TABLE,
      FilterExpression: 'driverId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);

    if (response.Items) {
      for (const record of response.Items) {
        await docClient.send(new UpdateCommand({
          TableName: CALL_RECORDS_TABLE,
          Key: { callId: record.callId },
          UpdateExpression: 'SET #phone = :anon REMOVE transcriptId, summaryId',
          ExpressionAttributeNames: {
            '#phone': 'phone',
          },
          ExpressionAttributeValues: {
            ':anon': '[DELETED]',
          },
        }));
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

/**
 * Anonymize payment records in Aurora Postgres
 */
async function anonymizePaymentRecords(userId: string): Promise<void> {
  const sql = `
    UPDATE payment_audit_log
    SET notes = '[PII DELETED]'
    WHERE actor_id = :userId
      AND notes IS NOT NULL
  `;

  await rdsClient.send(new ExecuteStatementCommand({
    resourceArn: AURORA_CLUSTER_ARN,
    secretArn: AURORA_SECRET_ARN,
    database: DATABASE_NAME,
    sql,
    parameters: [
      { name: 'userId', value: { stringValue: userId } },
    ],
  }));
}
