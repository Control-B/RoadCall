import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';

const logger = new Logger({ serviceName: 'compliance-svc' });
const tracer = new Tracer({ serviceName: 'compliance-svc' });
const metrics = new Metrics({ namespace: 'RoadcallAssistant', serviceName: 'compliance-svc' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rdsClient = tracer.captureAWSv3Client(new RDSDataClient({}));
const s3Client = tracer.captureAWSv3Client(new S3Client({}));
const eventBridgeClient = tracer.captureAWSv3Client(new EventBridgeClient({}));

const USERS_TABLE = process.env.USERS_TABLE!;
const DRIVERS_TABLE = process.env.DRIVERS_TABLE!;
const VENDORS_TABLE = process.env.VENDORS_TABLE!;
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE!;
const CALL_RECORDS_TABLE = process.env.CALL_RECORDS_TABLE!;
const TRACKING_SESSIONS_TABLE = process.env.TRACKING_SESSIONS_TABLE!;
const AURORA_CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN!;
const AURORA_SECRET_ARN = process.env.AURORA_SECRET_ARN!;
const DATABASE_NAME = process.env.DATABASE_NAME!;
const CALL_RECORDINGS_BUCKET = process.env.CALL_RECORDINGS_BUCKET!;
const INCIDENT_MEDIA_BUCKET = process.env.INCIDENT_MEDIA_BUCKET!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

/**
 * Lambda handler for right-to-be-forgotten workflow
 * POST /compliance/forget
 * Body: { userId: string, reason?: string }
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Right-to-be-forgotten request received', { event });

  try {
    const body = JSON.parse(event.body || '{}');
    const userId = body.userId;
    const reason = body.reason || 'User requested deletion';
    const requestingUserId = event.requestContext.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    // Verify user can only delete their own data (unless admin)
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];
    if (userRole !== 'admin' && userId !== requestingUserId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized to delete data for this user' }),
      };
    }

    // Verify user exists
    const userResponse = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    }));

    if (!userResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    logger.info('Processing right-to-be-forgotten request', { userId, reason });

    // Execute deletion workflow
    await executeForgetWorkflow(userId, reason);

    // Publish event
    await eventBridgeClient.send(new PutEventsCommand({
      Entries: [{
        Source: 'compliance-svc',
        DetailType: 'UserDataDeleted',
        Detail: JSON.stringify({
          userId,
          reason,
          deletedAt: new Date().toISOString(),
          requestedBy: requestingUserId,
        }),
        EventBusName: EVENT_BUS_NAME,
      }],
    }));

    metrics.addMetric('RightToBeForgottenRequests', MetricUnits.Count, 1);
    metrics.publishStoredMetrics();

    logger.info('Right-to-be-forgotten completed', { userId });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'User data has been anonymized and deleted',
        userId,
        completedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Right-to-be-forgotten failed', { error });
    metrics.addMetric('RightToBeForgottenErrors', MetricUnits.Count, 1);
    metrics.publishStoredMetrics();
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process deletion request' }),
    };
  }
};

/**
 * Execute the complete forget workflow
 */
async function executeForgetWorkflow(userId: string, reason: string): Promise<void> {
  // 1. Anonymize user profile
  await anonymizeUserProfile(userId);

  // 2. Anonymize driver/vendor profiles
  await anonymizeDriverProfile(userId);
  await anonymizeVendorProfile(userId);

  // 3. Anonymize incidents (keep for analytics but remove PII)
  await anonymizeIncidents(userId);

  // 4. Delete call recordings and anonymize records
  await deleteCallRecordings(userId);
  await anonymizeCallRecords(userId);

  // 5. Delete tracking data
  await deleteTrackingData(userId);

  // 6. Delete incident media
  await deleteIncidentMedia(userId);

  // 7. Anonymize payment records
  await anonymizePaymentData(userId);

  // 8. Create audit log entry
  await createAuditLog(userId, reason);
}

/**
 * Anonymize user profile
 */
async function anonymizeUserProfile(userId: string): Promise<void> {
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
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
}

/**
 * Anonymize driver profile
 */
async function anonymizeDriverProfile(userId: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: DRIVERS_TABLE,
      Key: { driverId: userId },
      UpdateExpression: 'SET #phone = :anon, #email = :anon, #name = :anon, #licenseNumber = :anon, #truckNumber = :anon',
      ExpressionAttributeNames: {
        '#phone': 'phone',
        '#email': 'email',
        '#name': 'name',
        '#licenseNumber': 'licenseNumber',
        '#truckNumber': 'truckNumber',
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
}

/**
 * Anonymize vendor profile
 */
async function anonymizeVendorProfile(userId: string): Promise<void> {
  try {
    await docClient.send(new UpdateCommand({
      TableName: VENDORS_TABLE,
      Key: { vendorId: userId },
      UpdateExpression: 'SET #phone = :anon, #email = :anon, #contactName = :anon, #businessName = :anon',
      ExpressionAttributeNames: {
        '#phone': 'phone',
        '#email': 'email',
        '#contactName': 'contactName',
        '#businessName': 'businessName',
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
}

/**
 * Anonymize incidents (keep for analytics)
 */
async function anonymizeIncidents(userId: string): Promise<void> {
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new QueryCommand({
      TableName: INCIDENTS_TABLE,
      IndexName: 'driverId-status-index',
      KeyConditionExpression: 'driverId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);

    if (response.Items) {
      for (const incident of response.Items) {
        await docClient.send(new UpdateCommand({
          TableName: INCIDENTS_TABLE,
          Key: { incidentId: incident.incidentId },
          UpdateExpression: 'REMOVE callRecordingUrl, transcriptId, summaryId, media',
          ConditionExpression: 'attribute_exists(incidentId)',
        }));
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

/**
 * Delete call recordings from S3
 */
async function deleteCallRecordings(userId: string): Promise<void> {
  // List all call recordings for user
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: CALL_RECORDINGS_BUCKET,
    Prefix: `recordings/${userId}/`,
  }));

  if (listResponse.Contents) {
    for (const object of listResponse.Contents) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: CALL_RECORDINGS_BUCKET,
        Key: object.Key!,
      }));
    }
  }
}

/**
 * Anonymize call records
 */
async function anonymizeCallRecords(userId: string): Promise<void> {
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new QueryCommand({
      TableName: CALL_RECORDS_TABLE,
      IndexName: 'driverId-startTime-index',
      KeyConditionExpression: 'driverId = :userId',
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
          UpdateExpression: 'SET #phone = :anon REMOVE recordingUrl, transcriptId, summaryId',
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
 * Delete tracking data
 */
async function deleteTrackingData(userId: string): Promise<void> {
  let lastEvaluatedKey: any = undefined;

  do {
    const command = new QueryCommand({
      TableName: TRACKING_SESSIONS_TABLE,
      IndexName: 'vendorId-status-index',
      KeyConditionExpression: 'vendorId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    });

    const response = await docClient.send(command);

    if (response.Items) {
      for (const session of response.Items) {
        await docClient.send(new UpdateCommand({
          TableName: TRACKING_SESSIONS_TABLE,
          Key: { sessionId: session.sessionId },
          UpdateExpression: 'REMOVE vendorPath, vendorLocation, route',
          ConditionExpression: 'attribute_exists(sessionId)',
        }));
      }
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
}

/**
 * Delete incident media from S3
 */
async function deleteIncidentMedia(userId: string): Promise<void> {
  const listResponse = await s3Client.send(new ListObjectsV2Command({
    Bucket: INCIDENT_MEDIA_BUCKET,
    Prefix: `media/${userId}/`,
  }));

  if (listResponse.Contents) {
    for (const object of listResponse.Contents) {
      await s3Client.send(new DeleteObjectCommand({
        Bucket: INCIDENT_MEDIA_BUCKET,
        Key: object.Key!,
      }));
    }
  }
}

/**
 * Anonymize payment data in Aurora
 */
async function anonymizePaymentData(userId: string): Promise<void> {
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

/**
 * Create audit log entry for deletion
 */
async function createAuditLog(userId: string, reason: string): Promise<void> {
  const sql = `
    INSERT INTO compliance_audit_log (
      log_id,
      user_id,
      action,
      reason,
      timestamp
    ) VALUES (
      gen_random_uuid(),
      :userId,
      'RIGHT_TO_BE_FORGOTTEN',
      :reason,
      NOW()
    )
  `;

  await rdsClient.send(new ExecuteStatementCommand({
    resourceArn: AURORA_CLUSTER_ARN,
    secretArn: AURORA_SECRET_ARN,
    database: DATABASE_NAME,
    sql,
    parameters: [
      { name: 'userId', value: { stringValue: userId } },
      { name: 'reason', value: { stringValue: reason } },
    ],
  }));
}
