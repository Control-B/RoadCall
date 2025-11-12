/**
 * Post-Call Processor Handler
 * Lambda function triggered after call ends to process recording and transcription
 * Implements PII detection, redaction, and encrypted storage with audit logging
 */

import { Handler, S3Event } from 'aws-lambda';
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';
import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  PiiEntityType,
} from '@aws-sdk/client-comprehend';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { 
  DynamoDBClient, 
  PutItemCommand, 
  UpdateItemCommand,
  GetItemCommand
} from '@aws-sdk/client-dynamodb';
import { KMSClient, EncryptCommand } from '@aws-sdk/client-kms';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@roadcall/utils';
import { Transcript, PIIEntity, PIIMapping } from '../types';

const transcribe = new TranscribeClient({});
const comprehend = new ComprehendClient({});
const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});
const kms = new KMSClient({});
const lambda = new LambdaClient({});

const TRANSCRIPTS_TABLE = process.env.TRANSCRIPTS_TABLE_NAME || '';
const CALL_RECORDS_TABLE = process.env.CALL_RECORDS_TABLE_NAME || '';
const PII_MAPPING_TABLE = process.env.PII_MAPPING_TABLE_NAME || '';
const TRANSCRIPTION_BUCKET = process.env.TRANSCRIPTION_BUCKET_NAME || '';
const KMS_KEY_ID = process.env.KMS_KEY_ID || '';
const SUMMARY_FUNCTION_NAME = process.env.SUMMARY_FUNCTION_NAME || '';

// Performance target: 30 seconds from call end to completion
const TRANSCRIPTION_TIMEOUT_MS = 25000; // 25 seconds for transcription
const MAX_POLL_ATTEMPTS = 12; // Poll every 2 seconds for 24 seconds max

/**
 * Process call recording after call ends
 * Triggered by S3 event when recording is uploaded
 * Performance target: Complete within 30 seconds
 */
export const handler: Handler<S3Event> = async (event) => {
  const startTime = Date.now();
  
  logger.info('Post-call processing started', {
    recordCount: event.Records.length,
  });

  // Process records in parallel for better performance
  const results = await Promise.allSettled(
    event.Records.map(record => processCallRecording(record, startTime))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logger.info('Post-call processing completed', {
    total: event.Records.length,
    successful,
    failed,
    durationMs: Date.now() - startTime,
  });
};

/**
 * Process a single call recording
 */
async function processCallRecording(
  record: S3Event['Records'][0],
  startTime: number
): Promise<void> {
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  // Extract contact ID from recording key
  const contactId = extractContactIdFromKey(key);

  if (!contactId) {
    logger.warn('Could not extract contact ID from key', { key });
    throw new Error(`Invalid key format: ${key}`);
  }

  logger.info('Processing call recording', { contactId, bucket, key });

  try {
    // Start transcription job
    const transcriptionJobName = `call-${contactId}-${Date.now()}`;
    const transcriptionCommand = new StartTranscriptionJobCommand({
      TranscriptionJobName: transcriptionJobName,
      LanguageCode: 'en-US',
      MediaFormat: detectMediaFormat(key),
      Media: {
        MediaFileUri: `s3://${bucket}/${key}`,
      },
      OutputBucketName: TRANSCRIPTION_BUCKET,
      Settings: {
        ShowSpeakerLabels: true,
        MaxSpeakerLabels: 2, // Driver and agent
      },
    });

    await transcribe.send(transcriptionCommand);

    logger.info('Transcription job started', {
      contactId,
      jobName: transcriptionJobName,
    });

    // Poll for transcription completion with timeout
    const remainingTime = TRANSCRIPTION_TIMEOUT_MS - (Date.now() - startTime);
    const transcriptResult = await waitForTranscription(
      transcriptionJobName, 
      Math.max(1, Math.floor(remainingTime / 2000))
    );

    if (!transcriptResult) {
      throw new Error('Transcription failed or timed out');
    }

    const { text: transcriptText, confidence } = transcriptResult;

    logger.info('Transcription completed', {
      contactId,
      textLength: transcriptText.length,
      confidence,
      elapsedMs: Date.now() - startTime,
    });

    // Detect and redact PII in parallel with transcript storage prep
    const [piiResult] = await Promise.all([
      detectAndRedactPII(transcriptText),
    ]);

    const { redactedText, piiEntities } = piiResult;

    logger.info('PII detection completed', {
      contactId,
      piiCount: piiEntities.length,
      piiTypes: [...new Set(piiEntities.map(e => e.type))],
    });

    // Generate IDs
    const transcriptId = uuidv4();
    const mappingId = uuidv4();

    // Prepare transcript record (without raw PII text in entities)
    const transcript: Transcript = {
      transcriptId,
      callId: contactId,
      rawText: transcriptText,
      redactedText,
      piiEntities: piiEntities.map(e => ({
        ...e,
        text: '[REDACTED]', // Don't store actual PII text in transcript table
      })),
      confidence,
      createdAt: new Date().toISOString(),
    };

    // Encrypt PII entities for secure storage
    const encryptedPII = await encryptPIIEntities(piiEntities, transcriptId);

    // Prepare PII mapping record
    const piiMapping: PIIMapping = {
      mappingId,
      transcriptId,
      callId: contactId,
      encryptedPII,
      createdAt: new Date().toISOString(),
      expiresAt: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90 days TTL
    };

    // Store transcript and PII mapping in parallel
    await Promise.all([
      dynamodb.send(new PutItemCommand({
        TableName: TRANSCRIPTS_TABLE,
        Item: marshall(transcript),
      })),
      dynamodb.send(new PutItemCommand({
        TableName: PII_MAPPING_TABLE,
        Item: marshall(piiMapping),
      })),
      dynamodb.send(new UpdateItemCommand({
        TableName: CALL_RECORDS_TABLE,
        Key: marshall({ callId: contactId }),
        UpdateExpression: 'SET transcriptId = :tid, updatedAt = :now',
        ExpressionAttributeValues: marshall({
          ':tid': transcriptId,
          ':now': new Date().toISOString(),
        }),
      })),
    ]);

    const totalDuration = Date.now() - startTime;
    
    logger.info('Call processing completed successfully', {
      contactId,
      transcriptId,
      durationMs: totalDuration,
      withinSLA: totalDuration < 30000,
    });

    // Alert if we're approaching the 30-second SLA
    if (totalDuration > 25000) {
      logger.warn('Processing time approaching SLA limit', {
        contactId,
        durationMs: totalDuration,
        slaMs: 30000,
      });
    }

    // Trigger async summary generation (don't wait for completion)
    await triggerSummaryGeneration(contactId, transcriptId);
  } catch (error) {
    logger.error(
      'Error processing call recording',
      error instanceof Error ? error : new Error('Unknown error'),
      { contactId, elapsedMs: Date.now() - startTime }
    );
    throw error;
  }
}

/**
 * Trigger async summary generation
 * Invokes the summary Lambda function asynchronously
 */
async function triggerSummaryGeneration(
  callId: string,
  transcriptId: string
): Promise<void> {
  try {
    // Get incident ID from call record if available
    const callRecord = await getCallRecord(callId);
    const incidentId = callRecord?.incidentId;

    const payload = {
      transcriptId,
      callId,
      incidentId,
    };

    const command = new InvokeCommand({
      FunctionName: SUMMARY_FUNCTION_NAME,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload),
    });

    await lambda.send(command);

    logger.info('Summary generation triggered', {
      callId,
      transcriptId,
      incidentId,
    });
  } catch (error) {
    // Log error but don't fail the main processing
    logger.error(
      'Error triggering summary generation',
      error instanceof Error ? error : new Error('Unknown error'),
      { callId, transcriptId }
    );
  }
}

/**
 * Get call record from DynamoDB
 */
async function getCallRecord(callId: string): Promise<any | null> {
  try {
    const command = new GetItemCommand({
      TableName: CALL_RECORDS_TABLE,
      Key: marshall({ callId }),
    });

    const response = await dynamodb.send(command);

    if (!response.Item) {
      return null;
    }

    return unmarshall(response.Item);
  } catch (error) {
    logger.error(
      'Error fetching call record',
      error instanceof Error ? error : new Error('Unknown error'),
      { callId }
    );
    return null;
  }
}

/**
 * Extract contact ID from S3 key
 */
function extractContactIdFromKey(key: string): string | null {
  // Handle various key formats
  // recordings/{contactId}.wav
  // connect/recordings/{instanceId}/{date}/{contactId}.wav
  const match = key.match(/([a-f0-9-]{36})/i);
  return match ? match[1] : null;
}

/**
 * Wait for transcription job to complete with optimized polling
 */
async function waitForTranscription(
  jobName: string, 
  maxAttempts: number = MAX_POLL_ATTEMPTS
): Promise<{ text: string; confidence: number } | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Exponential backoff: start with 1s, then 2s
    const delay = attempt === 0 ? 1000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const command = new GetTranscriptionJobCommand({
      TranscriptionJobName: jobName,
    });

    const response = await transcribe.send(command);
    const status = response.TranscriptionJob?.TranscriptionJobStatus;

    if (status === 'COMPLETED') {
      const transcriptUri = response.TranscriptionJob?.Transcript?.TranscriptFileUri;
      if (!transcriptUri) {
        return null;
      }

      // Fetch transcript from S3
      const result = await fetchTranscriptFromUri(transcriptUri);
      return result;
    } else if (status === 'FAILED') {
      logger.error('Transcription job failed', undefined, {
        jobName,
        failureReason: response.TranscriptionJob?.FailureReason,
      });
      return null;
    }

    // Still in progress, continue polling
  }

  logger.warn('Transcription job timed out', { 
    jobName, 
    attempts: maxAttempts 
  });
  return null;
}

/**
 * Fetch transcript text and metadata from S3 URI
 */
async function fetchTranscriptFromUri(
  uri: string
): Promise<{ text: string; confidence: number }> {
  // Parse S3 URI: s3://bucket/key
  const match = uri.match(/s3:\/\/([^\/]+)\/(.+)/);
  if (!match) {
    throw new Error(`Invalid S3 URI: ${uri}`);
  }

  const [, bucket, key] = match;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3.send(command);
  const body = await response.Body?.transformToString();

  if (!body) {
    throw new Error('Empty transcript body');
  }

  // Parse JSON transcript
  const transcript = JSON.parse(body);
  const text = transcript.results?.transcripts?.[0]?.transcript || '';
  
  // Calculate average confidence from items
  const items = transcript.results?.items || [];
  const confidenceScores = items
    .filter((item: any) => item.alternatives?.[0]?.confidence)
    .map((item: any) => parseFloat(item.alternatives[0].confidence));
  
  const avgConfidence = confidenceScores.length > 0
    ? confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length
    : 0.95;

  return { text, confidence: avgConfidence };
}

/**
 * Detect PII entities and redact them from text
 */
async function detectAndRedactPII(
  text: string
): Promise<{ redactedText: string; piiEntities: PIIEntity[] }> {
  const command = new DetectPiiEntitiesCommand({
    Text: text,
    LanguageCode: 'en',
  });

  const response = await comprehend.send(command);
  const entities = response.Entities || [];

  // Sort entities by offset in reverse order to maintain correct positions during redaction
  const sortedEntities = [...entities].sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

  let redactedText = text;
  const piiEntities: PIIEntity[] = [];

  for (const entity of sortedEntities) {
    if (!entity.Type || entity.BeginOffset === undefined || entity.EndOffset === undefined) {
      continue;
    }

    const entityText = text.substring(entity.BeginOffset, entity.EndOffset);
    const redactionMask = getRedactionMask(entity.Type as PiiEntityType);

    // Redact the entity
    redactedText =
      redactedText.substring(0, entity.BeginOffset) +
      redactionMask +
      redactedText.substring(entity.EndOffset);

    piiEntities.push({
      type: entity.Type,
      text: entityText,
      beginOffset: entity.BeginOffset,
      endOffset: entity.EndOffset,
      score: entity.Score || 0,
    });
  }

  return { redactedText, piiEntities };
}

/**
 * Get redaction mask for PII entity type
 */
function getRedactionMask(type: PiiEntityType): string {
  const masks: Record<string, string> = {
    NAME: '[NAME]',
    ADDRESS: '[ADDRESS]',
    SSN: '[SSN]',
    CREDIT_DEBIT_NUMBER: '[CARD]',
    PHONE: '[PHONE]',
    EMAIL: '[EMAIL]',
    DATE_TIME: '[DATE]',
    DRIVER_ID: '[ID]',
    BANK_ACCOUNT_NUMBER: '[ACCOUNT]',
    BANK_ROUTING: '[ROUTING]',
  };

  return masks[type] || '[REDACTED]';
}

/**
 * Encrypt PII entities using KMS for secure storage
 */
async function encryptPIIEntities(
  piiEntities: PIIEntity[],
  transcriptId: string
): Promise<string> {
  // Prepare PII data for encryption
  const piiData = {
    transcriptId,
    entities: piiEntities,
    encryptedAt: new Date().toISOString(),
  };

  const plaintext = JSON.stringify(piiData);

  const command = new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf-8'),
    EncryptionContext: {
      transcriptId,
      purpose: 'pii-storage',
    },
  });

  const response = await kms.send(command);

  if (!response.CiphertextBlob) {
    throw new Error('KMS encryption failed - no ciphertext returned');
  }

  // Return base64-encoded ciphertext
  return Buffer.from(response.CiphertextBlob).toString('base64');
}

/**
 * Detect media format from file extension
 */
function detectMediaFormat(key: string): 'wav' | 'mp3' | 'mp4' | 'flac' | 'ogg' | 'webm' {
  const extension = key.split('.').pop()?.toLowerCase();
  
  const formatMap: Record<string, 'wav' | 'mp3' | 'mp4' | 'flac' | 'ogg' | 'webm'> = {
    'wav': 'wav',
    'mp3': 'mp3',
    'mp4': 'mp4',
    'flac': 'flac',
    'ogg': 'ogg',
    'webm': 'webm',
  };

  return formatMap[extension || ''] || 'wav';
}
