/**
 * Access PII Handler
 * Provides authorized access to PII with comprehensive audit logging
 */

import { APIGatewayProxyHandler, APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@roadcall/utils';
import { PIIMapping, PIIAccessLog, PIIEntity } from '../types';

const dynamodb = new DynamoDBClient({});
const kms = new KMSClient({});

const PII_MAPPING_TABLE = process.env.PII_MAPPING_TABLE_NAME || '';
const PII_ACCESS_LOG_TABLE = process.env.PII_ACCESS_LOG_TABLE_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';

interface AccessPIIRequest {
  transcriptId: string;
  purpose: string; // Required: reason for accessing PII
}

interface AccessPIIResponse {
  transcriptId: string;
  piiEntities: PIIEntity[];
  accessLogId: string;
  warning: string;
}

/**
 * Handler for accessing PII data with authorization and audit logging
 * 
 * Authorization: Requires admin or dispatcher role
 * Audit: Logs all access attempts with user ID, purpose, and timestamp
 */
export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent) => {
  try {
    // Extract user context from authorizer
    const userContext = event.requestContext.authorizer;
    if (!userContext) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized - No user context' }),
      };
    }

    const userId = userContext.claims?.sub || userContext.principalId;
    const userRole = userContext.claims?.['custom:role'] || 'unknown';

    // Authorization check - only admin and dispatcher can access PII
    if (!['admin', 'dispatcher'].includes(userRole)) {
      logger.warn('Unauthorized PII access attempt', {
        userId,
        userRole,
      });

      return {
        statusCode: 403,
        body: JSON.stringify({ 
          error: 'Forbidden - Insufficient permissions to access PII' 
        }),
      };
    }

    // Parse request
    const request: AccessPIIRequest = JSON.parse(event.body || '{}');

    if (!request.transcriptId || !request.purpose) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Bad Request - transcriptId and purpose are required' 
        }),
      };
    }

    // Validate purpose is meaningful (not just placeholder text)
    if (request.purpose.length < 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Bad Request - purpose must be at least 10 characters describing the reason for access' 
        }),
      };
    }

    logger.info('PII access requested', {
      transcriptId: request.transcriptId,
      userId,
      userRole,
      purpose: request.purpose,
    });

    // Retrieve PII mapping
    const piiMapping = await getPIIMapping(request.transcriptId);

    if (!piiMapping) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          error: 'Not Found - No PII mapping found for transcript' 
        }),
      };
    }

    // Decrypt PII entities
    const piiEntities = await decryptPIIEntities(
      piiMapping.encryptedPII,
      request.transcriptId
    );

    // Log access
    const accessLogId = await logPIIAccess({
      transcriptId: request.transcriptId,
      userId,
      userRole,
      purpose: request.purpose,
      ipAddress: event.requestContext.identity?.sourceIp,
      piiTypes: [...new Set(piiEntities.map(e => e.type))],
    });

    logger.info('PII access granted and logged', {
      transcriptId: request.transcriptId,
      userId,
      accessLogId,
      piiCount: piiEntities.length,
    });

    const response: AccessPIIResponse = {
      transcriptId: request.transcriptId,
      piiEntities,
      accessLogId,
      warning: 'This data contains sensitive PII. Handle according to data protection policies.',
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    };
  } catch (error) {
    logger.error(
      'Error accessing PII',
      error instanceof Error ? error : new Error('Unknown error')
    );

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * Retrieve PII mapping from DynamoDB
 */
async function getPIIMapping(transcriptId: string): Promise<PIIMapping | null> {
  const command = new QueryCommand({
    TableName: PII_MAPPING_TABLE,
    IndexName: 'transcript-index',
    KeyConditionExpression: 'transcriptId = :tid',
    ExpressionAttributeValues: marshall({
      ':tid': transcriptId,
    }),
    Limit: 1,
  });

  const response = await dynamodb.send(command);

  if (!response.Items || response.Items.length === 0) {
    return null;
  }

  return unmarshall(response.Items[0]) as PIIMapping;
}

/**
 * Decrypt PII entities using KMS
 */
async function decryptPIIEntities(
  encryptedPII: string,
  transcriptId: string
): Promise<PIIEntity[]> {
  const ciphertext = Buffer.from(encryptedPII, 'base64');

  const command = new DecryptCommand({
    CiphertextBlob: ciphertext,
    KeyId: KMS_KEY_ID,
    EncryptionContext: {
      transcriptId,
      purpose: 'pii-storage',
    },
  });

  const response = await kms.send(command);

  if (!response.Plaintext) {
    throw new Error('KMS decryption failed - no plaintext returned');
  }

  const plaintext = Buffer.from(response.Plaintext).toString('utf-8');
  const piiData = JSON.parse(plaintext);

  return piiData.entities as PIIEntity[];
}

/**
 * Log PII access to audit table
 */
async function logPIIAccess(params: {
  transcriptId: string;
  userId: string;
  userRole: string;
  purpose: string;
  ipAddress?: string;
  piiTypes: string[];
}): Promise<string> {
  const logId = uuidv4();
  const accessedAt = new Date().toISOString();

  const accessLog: PIIAccessLog = {
    logId,
    transcriptId: params.transcriptId,
    userId: params.userId,
    userRole: params.userRole,
    purpose: params.purpose,
    accessedAt,
    ipAddress: params.ipAddress,
    piiTypes: params.piiTypes,
  };

  const command = new PutItemCommand({
    TableName: PII_ACCESS_LOG_TABLE,
    Item: marshall(accessLog),
  });

  await dynamodb.send(command);

  return logId;
}
