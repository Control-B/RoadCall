/**
 * Agent Assist Handler
 * Real-time knowledge base queries during calls using Amazon Q in Connect
 * Provides agents with relevant SOPs, vendor information, and troubleshooting guides
 */

import { Handler } from 'aws-lambda';
import {
  KendraClient,
  QueryCommand,
} from '@aws-sdk/client-kendra';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '@roadcall/utils';

const kendra = new KendraClient({});
const bedrock = new BedrockRuntimeClient({});

const KENDRA_INDEX_ID = process.env.KENDRA_INDEX_ID || '';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
const BEDROCK_GUARDRAIL_ID = process.env.BEDROCK_GUARDRAIL_ID || '';
const BEDROCK_GUARDRAIL_VERSION = process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT';

// Performance target: 2 seconds for agent assist response
const AGENT_ASSIST_TIMEOUT_MS = 2000;

interface AgentAssistEvent {
  query: string;
  contactId: string;
  incidentType?: 'tire' | 'engine' | 'tow';
  context?: {
    driverLocation?: string;
    weatherCondition?: string;
    urgency?: string;
  };
}

interface AgentAssistResponse {
  answer: string;
  sources: KnowledgeSource[];
  confidence: number;
  responseTime: number;
}

interface KnowledgeSource {
  title: string;
  excerpt: string;
  documentId: string;
  confidence: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT_AVAILABLE';
  uri?: string;
}

/**
 * Handle real-time agent assist queries during calls
 * Performance target: Respond within 2 seconds
 */
export const handler: Handler<AgentAssistEvent, AgentAssistResponse> = async (event) => {
  const startTime = Date.now();

  logger.info('Agent assist query received', {
    contactId: event.contactId,
    query: event.query,
    incidentType: event.incidentType,
  });

  try {
    // Search knowledge base with Kendra
    const kendraResults = await searchKnowledgeBase(
      event.query,
      event.incidentType,
      event.context
    );

    logger.info('Kendra search completed', {
      contactId: event.contactId,
      resultCount: kendraResults.length,
      elapsedMs: Date.now() - startTime,
    });

    // If no results found, return early
    if (kendraResults.length === 0) {
      return {
        answer: 'I could not find relevant information in the knowledge base for your query. Please consult with a supervisor or refer to the standard operating procedures.',
        sources: [],
        confidence: 0,
        responseTime: Date.now() - startTime,
      };
    }

    // Generate RAG response using Bedrock
    const ragResponse = await generateRAGResponse(
      event.query,
      kendraResults,
      event.context
    );

    const totalDuration = Date.now() - startTime;

    logger.info('Agent assist response generated', {
      contactId: event.contactId,
      sourceCount: kendraResults.length,
      confidence: ragResponse.confidence,
      durationMs: totalDuration,
      withinSLA: totalDuration < AGENT_ASSIST_TIMEOUT_MS,
    });

    // Alert if approaching SLA limit
    if (totalDuration > 1800) {
      logger.warn('Agent assist response time approaching SLA limit', {
        contactId: event.contactId,
        durationMs: totalDuration,
        slaMs: AGENT_ASSIST_TIMEOUT_MS,
      });
    }

    return {
      answer: ragResponse.answer,
      sources: kendraResults,
      confidence: ragResponse.confidence,
      responseTime: totalDuration,
    };
  } catch (error) {
    logger.error(
      'Error processing agent assist query',
      error instanceof Error ? error : new Error('Unknown error'),
      {
        contactId: event.contactId,
        query: event.query,
        elapsedMs: Date.now() - startTime,
      }
    );

    // Return fallback response
    return {
      answer: 'An error occurred while searching the knowledge base. Please proceed with standard protocols.',
      sources: [],
      confidence: 0,
      responseTime: Date.now() - startTime,
    };
  }
};

/**
 * Search knowledge base using Amazon Kendra
 */
async function searchKnowledgeBase(
  query: string,
  incidentType?: string,
  _context?: AgentAssistEvent['context']
): Promise<KnowledgeSource[]> {
  // Build attribute filter for incident type
  const attributeFilter = incidentType
    ? {
        EqualsTo: {
          Key: 'incidentType',
          Value: { StringValue: incidentType },
        },
      }
    : undefined;

  const command = new QueryCommand({
    IndexId: KENDRA_INDEX_ID,
    QueryText: query,
    AttributeFilter: attributeFilter,
    PageSize: 5, // Top 5 results for agent assist
  });

  const response = await kendra.send(command);

  if (!response.ResultItems || response.ResultItems.length === 0) {
    return [];
  }

  // Filter and map results
  const sources: KnowledgeSource[] = response.ResultItems
    .filter((item) => {
      // Only include high-confidence results
      const confidence = item.ScoreAttributes?.ScoreConfidence;
      return (
        confidence === 'VERY_HIGH' ||
        confidence === 'HIGH' ||
        confidence === 'MEDIUM'
      );
    })
    .slice(0, 3) // Top 3 sources for RAG
    .map((item) => ({
      title: item.DocumentTitle?.Text || 'Untitled Document',
      excerpt: item.DocumentExcerpt?.Text || '',
      documentId: item.DocumentId || '',
      confidence: item.ScoreAttributes?.ScoreConfidence || 'NOT_AVAILABLE',
      uri: item.DocumentURI,
    }));

  return sources;
}

/**
 * Generate RAG response using Bedrock with knowledge base context
 */
async function generateRAGResponse(
  query: string,
  sources: KnowledgeSource[],
  context?: AgentAssistEvent['context']
): Promise<{ answer: string; confidence: number }> {
  // Build context from knowledge base sources
  const contextText = sources
    .map(
      (source, index) =>
        `Source ${index + 1} (${source.title}):\n${source.excerpt}\n`
    )
    .join('\n');

  // Build prompt with context
  const prompt = buildAgentAssistPrompt(query, contextText, context);

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 500,
    temperature: 0.2, // Low temperature for factual responses
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

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (responseBody.stop_reason === 'guardrail_intervened') {
    logger.warn('Bedrock guardrail intervened in agent assist', {
      reason: responseBody.stop_reason,
    });
    return {
      answer: 'I cannot provide that information. Please consult with a supervisor.',
      confidence: 0,
    };
  }

  const answer = responseBody.content?.[0]?.text || 'No response generated';

  // Calculate confidence based on source confidence
  const avgConfidence = calculateAverageConfidence(sources);

  return {
    answer,
    confidence: avgConfidence,
  };
}

/**
 * Build prompt for agent assist RAG
 */
function buildAgentAssistPrompt(
  query: string,
  contextText: string,
  context?: AgentAssistEvent['context']
): string {
  const contextInfo = context
    ? `
Additional Context:
- Location: ${context.driverLocation || 'Unknown'}
- Weather: ${context.weatherCondition || 'Unknown'}
- Urgency: ${context.urgency || 'Normal'}
`
    : '';

  return `You are an AI assistant helping a roadside assistance agent during a live call with a driver. Provide a clear, concise, and actionable answer based on the knowledge base information provided.

Guidelines:
- Be direct and concise (2-3 sentences maximum)
- Focus on actionable information the agent can communicate to the driver
- If the context doesn't contain relevant information, say so clearly
- Do NOT make up information not present in the context
- Do NOT include any personally identifiable information
- Prioritize safety and standard operating procedures

Knowledge Base Context:
${contextText}
${contextInfo}

Agent's Question: ${query}

Provide a clear answer the agent can use immediately:`;
}

/**
 * Calculate average confidence from sources
 */
function calculateAverageConfidence(sources: KnowledgeSource[]): number {
  if (sources.length === 0) {
    return 0;
  }

  const confidenceMap: Record<string, number> = {
    VERY_HIGH: 0.95,
    HIGH: 0.85,
    MEDIUM: 0.70,
    LOW: 0.50,
    NOT_AVAILABLE: 0.30,
  };

  const total = sources.reduce(
    (sum, source) => sum + (confidenceMap[source.confidence] || 0.5),
    0
  );

  return total / sources.length;
}
