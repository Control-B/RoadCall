/**
 * Generate Summary Handler
 * Lambda function to generate AI-powered call summaries using Amazon Q in Connect
 * Implements structured summary extraction with PII filtering and content safety
 */

import { Handler } from 'aws-lambda';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@roadcall/utils';
import { CallSummary, Transcript } from '../types';

const bedrock = new BedrockRuntimeClient({});
const dynamodb = new DynamoDBClient({});

const TRANSCRIPTS_TABLE = process.env.TRANSCRIPTS_TABLE_NAME || '';
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE_NAME || '';
const CALL_RECORDS_TABLE = process.env.CALL_RECORDS_TABLE_NAME || '';
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE_NAME || '';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
const BEDROCK_GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID || '';
const BEDROCK_GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT';

// Performance target: 30 seconds for summary generation
// const SUMMARY_TIMEOUT_MS = 28000; // Reserved for future timeout implementation

interface SummaryGenerationEvent {
  transcriptId: string;
  callId: string;
  incidentId?: string;
}

interface StructuredSummary {
  summary: string;
  incidentType?: 'tire' | 'engine' | 'tow';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPhrases: string[];
  driverConcern?: string;
  recommendedActions?: string[];
}

/**
 * Generate AI summary from call transcript
 * Performance target: Complete within 30 seconds
 */
export const handler: Handler<SummaryGenerationEvent> = async (event) => {
  const startTime = Date.now();

  logger.info('Summary generation started', {
    transcriptId: event.transcriptId,
    callId: event.callId,
  });

  try {
    // Fetch transcript from DynamoDB
    const transcript = await getTranscript(event.transcriptId);

    if (!transcript) {
      throw new Error(`Transcript not found: ${event.transcriptId}`);
    }

    logger.info('Transcript retrieved', {
      transcriptId: event.transcriptId,
      textLength: transcript.redactedText.length,
      confidence: transcript.confidence,
    });

    // Generate structured summary using Bedrock with guardrails
    const structuredSummary = await generateStructuredSummary(
      transcript.redactedText,
      event.callId
    );

    logger.info('Summary generated', {
      transcriptId: event.transcriptId,
      incidentType: structuredSummary.incidentType,
      urgency: structuredSummary.urgency,
      actionItemCount: structuredSummary.actionItems.length,
      elapsedMs: Date.now() - startTime,
    });

    // Create summary record
    const summaryId = uuidv4();
    const callSummary: CallSummary = {
      summaryId,
      callId: event.callId,
      incidentId: event.incidentId,
      summary: structuredSummary.summary,
      incidentType: structuredSummary.incidentType,
      urgency: structuredSummary.urgency,
      actionItems: structuredSummary.actionItems,
      sentiment: structuredSummary.sentiment,
      keyPhrases: structuredSummary.keyPhrases,
      generatedAt: new Date().toISOString(),
    };

    // Store summary and update references in parallel
    await Promise.all([
      storeSummary(callSummary),
      updateCallRecord(event.callId, summaryId),
      event.incidentId ? updateIncident(event.incidentId, summaryId) : Promise.resolve(),
    ]);

    const totalDuration = Date.now() - startTime;

    logger.info('Summary generation completed successfully', {
      transcriptId: event.transcriptId,
      summaryId,
      durationMs: totalDuration,
      withinSLA: totalDuration < 30000,
    });

    // Alert if approaching SLA limit
    if (totalDuration > 25000) {
      logger.warn('Summary generation time approaching SLA limit', {
        transcriptId: event.transcriptId,
        durationMs: totalDuration,
        slaMs: 30000,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        summaryId,
        incidentType: structuredSummary.incidentType,
        urgency: structuredSummary.urgency,
      }),
    };
  } catch (error) {
    logger.error(
      'Error generating summary',
      error instanceof Error ? error : new Error('Unknown error'),
      {
        transcriptId: event.transcriptId,
        callId: event.callId,
        elapsedMs: Date.now() - startTime,
      }
    );

    throw error;
  }
};

/**
 * Fetch transcript from DynamoDB
 */
async function getTranscript(transcriptId: string): Promise<Transcript | null> {
  const command = new GetItemCommand({
    TableName: TRANSCRIPTS_TABLE,
    Key: marshall({ transcriptId }),
  });

  const response = await dynamodb.send(command);

  if (!response.Item) {
    return null;
  }

  return unmarshall(response.Item) as Transcript;
}

/**
 * Generate structured summary using Amazon Bedrock with Claude
 * Implements prompt guardrails for PII filtering and content safety
 */
async function generateStructuredSummary(
  transcriptText: string,
  callId: string
): Promise<StructuredSummary> {
  // Build prompt for structured extraction
  const prompt = buildSummaryPrompt(transcriptText);

  // Invoke Bedrock with guardrails
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    temperature: 0.3, // Lower temperature for more consistent structured output
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
    guardrailIdentifier: BEDROCK_GUARDRAIL_ID || undefined,
    guardrailVersion: BEDROCK_GUARDRAIL_VERSION || undefined,
  });

  const response = await bedrock.send(command);

  if (!response.body) {
    throw new Error('Empty response from Bedrock');
  }

  // Parse response
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (responseBody.stop_reason === 'guardrail_intervened') {
    logger.warn('Bedrock guardrail intervened', {
      callId,
      reason: responseBody.stop_reason,
    });
    throw new Error('Content filtered by guardrails');
  }

  const content = responseBody.content?.[0]?.text;

  if (!content) {
    throw new Error('No content in Bedrock response');
  }

  // Parse structured JSON response
  const structuredSummary = parseStructuredSummary(content);

  return structuredSummary;
}

/**
 * Build prompt for structured summary extraction
 */
function buildSummaryPrompt(transcriptText: string): string {
  return `You are an AI assistant analyzing roadside assistance call transcripts. Your task is to extract structured information from the call.

Analyze this roadside assistance call transcript and provide a structured JSON response with the following fields:

1. summary: A brief 2-3 sentence summary of the call
2. incidentType: The type of incident (must be one of: "tire", "engine", "tow", or null if unclear)
3. urgency: The urgency level (must be one of: "low", "medium", "high", "critical")
4. actionItems: An array of specific action items for the dispatcher (2-5 items)
5. sentiment: The driver's sentiment (must be one of: "positive", "neutral", "negative")
6. keyPhrases: An array of important phrases or keywords from the call (3-5 phrases)
7. driverConcern: The main concern expressed by the driver (1 sentence)
8. recommendedActions: Recommended next steps based on the situation (2-3 items)

Guidelines:
- Focus on factual information from the transcript
- Do NOT include any personally identifiable information (PII) in your response
- If the transcript contains [REDACTED] or [NAME] or similar markers, acknowledge them but don't try to guess the information
- Be concise and actionable
- Urgency should be based on: safety risk, location (highway vs parking lot), weather conditions, time of day
- Incident type should only be set if clearly stated; use null if ambiguous

Transcript:
${transcriptText}

Respond ONLY with valid JSON in this exact format:
{
  "summary": "string",
  "incidentType": "tire" | "engine" | "tow" | null,
  "urgency": "low" | "medium" | "high" | "critical",
  "actionItems": ["string"],
  "sentiment": "positive" | "neutral" | "negative",
  "keyPhrases": ["string"],
  "driverConcern": "string",
  "recommendedActions": ["string"]
}`;
}

/**
 * Parse structured summary from LLM response
 */
function parseStructuredSummary(content: string): StructuredSummary {
  try {
    // Extract JSON from response (handle cases where LLM adds extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    return {
      summary: String(parsed.summary || 'No summary available'),
      incidentType: validateIncidentType(parsed.incidentType),
      urgency: validateUrgency(parsed.urgency),
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.map(String).slice(0, 10)
        : [],
      sentiment: validateSentiment(parsed.sentiment),
      keyPhrases: Array.isArray(parsed.keyPhrases)
        ? parsed.keyPhrases.map(String).slice(0, 10)
        : [],
      driverConcern: parsed.driverConcern ? String(parsed.driverConcern) : undefined,
      recommendedActions: Array.isArray(parsed.recommendedActions)
        ? parsed.recommendedActions.map(String).slice(0, 10)
        : undefined,
    };
  } catch (error) {
    logger.error(
      'Error parsing structured summary',
      error instanceof Error ? error : new Error('Unknown error'),
      { content: content.substring(0, 200) }
    );

    // Return fallback summary
    return {
      summary: 'Unable to generate structured summary',
      urgency: 'medium',
      actionItems: ['Review call recording', 'Contact driver for clarification'],
      sentiment: 'neutral',
      keyPhrases: [],
    };
  }
}

/**
 * Validate incident type
 */
function validateIncidentType(
  value: any
): 'tire' | 'engine' | 'tow' | undefined {
  const validTypes = ['tire', 'engine', 'tow'];
  return validTypes.includes(value) ? value : undefined;
}

/**
 * Validate urgency level
 */
function validateUrgency(value: any): 'low' | 'medium' | 'high' | 'critical' {
  const validLevels = ['low', 'medium', 'high', 'critical'];
  return validLevels.includes(value) ? value : 'medium';
}

/**
 * Validate sentiment
 */
function validateSentiment(value: any): 'positive' | 'neutral' | 'negative' {
  const validSentiments = ['positive', 'neutral', 'negative'];
  return validSentiments.includes(value) ? value : 'neutral';
}

/**
 * Store summary in DynamoDB
 */
async function storeSummary(summary: CallSummary): Promise<void> {
  const command = new PutItemCommand({
    TableName: SUMMARIES_TABLE,
    Item: marshall(summary),
  });

  await dynamodb.send(command);
}

/**
 * Update call record with summary ID
 */
async function updateCallRecord(callId: string, summaryId: string): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: CALL_RECORDS_TABLE,
    Key: marshall({ callId }),
    UpdateExpression: 'SET summaryId = :sid, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':sid': summaryId,
      ':now': new Date().toISOString(),
    }),
  });

  await dynamodb.send(command);
}

/**
 * Update incident with summary ID
 */
async function updateIncident(incidentId: string, summaryId: string): Promise<void> {
  const command = new UpdateItemCommand({
    TableName: INCIDENTS_TABLE,
    Key: marshall({ incidentId }),
    UpdateExpression: 'SET summaryId = :sid, updatedAt = :now',
    ExpressionAttributeValues: marshall({
      ':sid': summaryId,
      ':now': new Date().toISOString(),
    }),
  });

  await dynamodb.send(command);
}
