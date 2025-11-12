import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RDSDataClient, ExecuteStatementCommand } from '@aws-sdk/client-rds-data';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

const logger = new Logger({ serviceName: 'compliance-svc' });
const tracer = new Tracer({ serviceName: 'compliance-svc' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const rdsClient = tracer.captureAWSv3Client(new RDSDataClient({}));
const s3Client = tracer.captureAWSv3Client(new S3Client({}));

const USERS_TABLE = process.env.USERS_TABLE!;
const DRIVERS_TABLE = process.env.DRIVERS_TABLE!;
const VENDORS_TABLE = process.env.VENDORS_TABLE!;
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE!;
const CALL_RECORDS_TABLE = process.env.CALL_RECORDS_TABLE!;
const AURORA_CLUSTER_ARN = process.env.AURORA_CLUSTER_ARN!;
const AURORA_SECRET_ARN = process.env.AURORA_SECRET_ARN!;
const DATABASE_NAME = process.env.DATABASE_NAME!;
const EXPORT_BUCKET = process.env.EXPORT_BUCKET!;

/**
 * Lambda handler for user data export (GDPR compliance)
 * GET /compliance/export?userId={userId}
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Data export request received', { event });

  try {
    const userId = event.queryStringParameters?.userId;
    const requestingUserId = event.requestContext.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'userId is required' }),
      };
    }

    // Verify user can only export their own data (unless admin)
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];
    if (userRole !== 'admin' && userId !== requestingUserId) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Unauthorized to export data for this user' }),
      };
    }

    logger.info('Exporting data for user', { userId });

    // Collect all user data
    const userData = await collectUserData(userId);

    // Generate export file
    const exportKey = `exports/${userId}/${Date.now()}.json`;
    await s3Client.send(new PutObjectCommand({
      Bucket: EXPORT_BUCKET,
      Key: exportKey,
      Body: JSON.stringify(userData, null, 2),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms',
    }));

    // Generate presigned URL (valid for 1 hour)
    const downloadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: EXPORT_BUCKET,
        Key: exportKey,
      }),
      { expiresIn: 3600 }
    );

    logger.info('Data export completed', { userId, exportKey });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Data export completed',
        downloadUrl,
        expiresIn: 3600,
      }),
    };
  } catch (error) {
    logger.error('Data export failed', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to export data' }),
    };
  }
};

/**
 * Collect all data for a user from various sources
 */
async function collectUserData(userId: string): Promise<any> {
  const userData: any = {
    exportDate: new Date().toISOString(),
    userId,
    profile: {},
    incidents: [],
    callRecords: [],
    payments: [],
  };

  // Get user profile
  const userResponse = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId },
  }));
  userData.profile.user = userResponse.Item;

  // Get driver profile if exists
  try {
    const driverResponse = await docClient.send(new GetCommand({
      TableName: DRIVERS_TABLE,
      Key: { driverId: userId },
    }));
    if (driverResponse.Item) {
      userData.profile.driver = driverResponse.Item;
    }
  } catch (error) {
    // Driver profile doesn't exist
  }

  // Get vendor profile if exists
  try {
    const vendorResponse = await docClient.send(new GetCommand({
      TableName: VENDORS_TABLE,
      Key: { vendorId: userId },
    }));
    if (vendorResponse.Item) {
      userData.profile.vendor = vendorResponse.Item;
    }
  } catch (error) {
    // Vendor profile doesn't exist
  }

  // Get incidents
  userData.incidents = await getIncidents(userId);

  // Get call records
  userData.callRecords = await getCallRecords(userId);

  // Get payment records
  userData.payments = await getPaymentRecords(userId);

  return userData;
}

/**
 * Get all incidents for a user
 */
async function getIncidents(userId: string): Promise<any[]> {
  const incidents: any[] = [];
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
      incidents.push(...response.Items);
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return incidents;
}

/**
 * Get all call records for a user
 */
async function getCallRecords(userId: string): Promise<any[]> {
  const callRecords: any[] = [];
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
      callRecords.push(...response.Items);
    }

    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return callRecords;
}

/**
 * Get all payment records for a user from Aurora
 */
async function getPaymentRecords(userId: string): Promise<any[]> {
  const sql = `
    SELECT 
      p.payment_id,
      p.incident_id,
      p.amount_cents,
      p.currency,
      p.status,
      p.created_at,
      p.processed_at
    FROM payments p
    WHERE p.payer_id = :userId OR p.vendor_id = :userId
    ORDER BY p.created_at DESC
  `;

  const response = await rdsClient.send(new ExecuteStatementCommand({
    resourceArn: AURORA_CLUSTER_ARN,
    secretArn: AURORA_SECRET_ARN,
    database: DATABASE_NAME,
    sql,
    parameters: [
      { name: 'userId', value: { stringValue: userId } },
    ],
  }));

  return response.records || [];
}
