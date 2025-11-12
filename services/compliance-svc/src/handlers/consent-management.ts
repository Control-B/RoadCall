import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';

const logger = new Logger({ serviceName: 'compliance-svc' });
const tracer = new Tracer({ serviceName: 'compliance-svc' });

const dynamoClient = tracer.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CONSENT_TABLE = process.env.CONSENT_TABLE!;

interface ConsentRecord {
  userId: string;
  consentType: string;
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  version: string;
}

/**
 * Lambda handler for consent management
 * POST /compliance/consent - Record consent
 * GET /compliance/consent?userId={userId} - Get consent status
 * PUT /compliance/consent - Update consent
 */
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  logger.info('Consent management request received', { event });

  try {
    const method = event.httpMethod;

    switch (method) {
      case 'POST':
        return await recordConsent(event);
      case 'GET':
        return await getConsent(event);
      case 'PUT':
        return await updateConsent(event);
      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    logger.error('Consent management failed', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process consent request' }),
    };
  }
};

/**
 * Record initial consent during registration
 */
async function recordConsent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId;
  const consents = body.consents || [];

  if (!userId || !Array.isArray(consents)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userId and consents array are required' }),
    };
  }

  const ipAddress = event.requestContext.identity?.sourceIp;
  const userAgent = event.headers['User-Agent'];
  const timestamp = new Date().toISOString();

  // Record each consent type
  for (const consent of consents) {
    const consentRecord: ConsentRecord = {
      userId,
      consentType: consent.type,
      granted: consent.granted,
      grantedAt: consent.granted ? timestamp : undefined,
      ipAddress,
      userAgent,
      version: consent.version || '1.0',
    };

    await docClient.send(new PutCommand({
      TableName: CONSENT_TABLE,
      Item: consentRecord,
    }));
  }

  logger.info('Consent recorded', { userId, consents: consents.length });

  return {
    statusCode: 201,
    body: JSON.stringify({
      message: 'Consent recorded successfully',
      userId,
      recordedAt: timestamp,
    }),
  };
}

/**
 * Get consent status for a user
 */
async function getConsent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const requestingUserId = event.requestContext.authorizer?.claims?.sub;

  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userId is required' }),
    };
  }

  // Verify user can only view their own consent (unless admin)
  const userRole = event.requestContext.authorizer?.claims?.['custom:role'];
  if (userRole !== 'admin' && userId !== requestingUserId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized to view consent for this user' }),
    };
  }

  // Get all consent types for user
  const consentTypes = [
    'data_processing',
    'marketing_communications',
    'location_tracking',
    'call_recording',
    'data_sharing',
  ];

  const consents: any[] = [];

  for (const consentType of consentTypes) {
    const response = await docClient.send(new GetCommand({
      TableName: CONSENT_TABLE,
      Key: {
        userId,
        consentType,
      },
    }));

    if (response.Item) {
      consents.push(response.Item);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      userId,
      consents,
    }),
  };
}

/**
 * Update consent (revoke or grant)
 */
async function updateConsent(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId;
  const consentType = body.consentType;
  const granted = body.granted;
  const requestingUserId = event.requestContext.authorizer?.claims?.sub;

  if (!userId || !consentType || typeof granted !== 'boolean') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userId, consentType, and granted are required' }),
    };
  }

  // Verify user can only update their own consent (unless admin)
  const userRole = event.requestContext.authorizer?.claims?.['custom:role'];
  if (userRole !== 'admin' && userId !== requestingUserId) {
    return {
      statusCode: 403,
      body: JSON.stringify({ error: 'Unauthorized to update consent for this user' }),
    };
  }

  const timestamp = new Date().toISOString();
  const ipAddress = event.requestContext.identity?.sourceIp;
  const userAgent = event.headers['User-Agent'];

  // Update consent record
  await docClient.send(new UpdateCommand({
    TableName: CONSENT_TABLE,
    Key: {
      userId,
      consentType,
    },
    UpdateExpression: granted
      ? 'SET granted = :granted, grantedAt = :timestamp, ipAddress = :ip, userAgent = :ua REMOVE revokedAt'
      : 'SET granted = :granted, revokedAt = :timestamp, ipAddress = :ip, userAgent = :ua',
    ExpressionAttributeValues: {
      ':granted': granted,
      ':timestamp': timestamp,
      ':ip': ipAddress,
      ':ua': userAgent,
    },
  }));

  logger.info('Consent updated', { userId, consentType, granted });

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Consent updated successfully',
      userId,
      consentType,
      granted,
      updatedAt: timestamp,
    }),
  };
}
