# Amazon Q in Connect Integration

This document describes the Amazon Q in Connect integration for AI-powered call summarization and real-time agent assist in the AI Roadcall Assistant platform.

## Overview

The telephony service integrates with Amazon Q in Connect to provide:

1. **AI-Powered Call Summarization**: Automatic generation of structured summaries from call transcripts
2. **Real-Time Agent Assist**: Knowledge base queries during live calls to help agents provide accurate information
3. **PII Filtering**: Bedrock guardrails ensure no personally identifiable information leaks into summaries
4. **Content Safety**: Guardrails filter harmful or inappropriate content

## Architecture

```
Call Recording → Transcription → PII Redaction → Summary Generation
                                                        ↓
                                                  Bedrock + Guardrails
                                                        ↓
                                                  Structured Summary
                                                        ↓
                                                  DynamoDB Storage
```

### Components

1. **Post-Call Processor** (`post-call-processor.ts`)
   - Triggers transcription via Amazon Transcribe
   - Detects and redacts PII using Amazon Comprehend
   - Stores redacted transcript in DynamoDB
   - Triggers async summary generation

2. **Summary Generator** (`generate-summary.ts`)
   - Fetches redacted transcript from DynamoDB
   - Invokes Bedrock Claude model with structured prompt
   - Applies Bedrock guardrails for PII filtering and content safety
   - Extracts structured information:
     - Incident type (tire/engine/tow)
     - Urgency level (low/medium/high/critical)
     - Action items for dispatcher
     - Driver sentiment
     - Key phrases
   - Stores summary in DynamoDB
   - Links summary to call record and incident

3. **Agent Assist** (`agent-assist.ts`)
   - Receives real-time queries from agents during calls
   - Searches Amazon Kendra knowledge base
   - Generates RAG responses using Bedrock
   - Returns concise, actionable answers within 2 seconds

## Data Models

### CallSummary

```typescript
interface CallSummary {
  summaryId: string;
  callId: string;
  incidentId?: string;
  summary: string;
  incidentType?: 'tire' | 'engine' | 'tow';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPhrases: string[];
  generatedAt: string;
}
```

### AgentAssistResponse

```typescript
interface AgentAssistResponse {
  answer: string;
  sources: KnowledgeSource[];
  confidence: number;
  responseTime: number;
}
```

## Performance Targets

- **Summary Generation**: Complete within 30 seconds of call end
- **Agent Assist**: Respond within 2 seconds for real-time use

## Bedrock Guardrails Configuration

The integration uses Bedrock Guardrails to ensure:

1. **PII Filtering**: Prevents leakage of names, addresses, phone numbers, SSN, credit cards
2. **Content Filters**:
   - Hate speech: BLOCKED
   - Violence: BLOCKED
   - Sexual content: BLOCKED
   - Misconduct: BLOCKED
3. **Topic Filters**: Restricts responses to roadside assistance domain
4. **Word Filters**: Blocks profanity and inappropriate language

### Creating Guardrails

```bash
# Create guardrail via AWS CLI
aws bedrock create-guardrail \
  --name roadcall-assistant-guardrail \
  --description "Content safety and PII filtering for roadcall assistant" \
  --content-policy-config '{
    "filtersConfig": [
      {"type": "HATE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "VIOLENCE", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "SEXUAL", "inputStrength": "HIGH", "outputStrength": "HIGH"},
      {"type": "MISCONDUCT", "inputStrength": "MEDIUM", "outputStrength": "MEDIUM"}
    ]
  }' \
  --sensitive-information-policy-config '{
    "piiEntitiesConfig": [
      {"type": "NAME", "action": "BLOCK"},
      {"type": "ADDRESS", "action": "BLOCK"},
      {"type": "PHONE", "action": "BLOCK"},
      {"type": "EMAIL", "action": "BLOCK"},
      {"type": "SSN", "action": "BLOCK"},
      {"type": "CREDIT_DEBIT_CARD_NUMBER", "action": "BLOCK"}
    ]
  }' \
  --topic-policy-config '{
    "topicsConfig": [
      {
        "name": "RoadsideAssistance",
        "definition": "Roadside assistance, vehicle breakdowns, tire issues, engine problems, towing services",
        "type": "ALLOW"
      }
    ]
  }'
```

## Amazon Kendra Knowledge Base

The agent assist feature requires an Amazon Kendra index populated with:

1. **Standard Operating Procedures (SOPs)**
   - Incident handling procedures
   - Safety protocols
   - Escalation guidelines

2. **Vendor Information**
   - Service capabilities
   - Coverage areas
   - SLA commitments

3. **Troubleshooting Guides**
   - Common issues and solutions
   - Diagnostic procedures
   - Safety warnings

### Kendra Index Configuration

```typescript
// Custom attributes for filtering
{
  "incidentType": "tire" | "engine" | "tow",
  "category": "sop" | "vendor_sla" | "troubleshooting",
  "tags": string[],
  "effectiveDate": string
}
```

## Usage Examples

### Generating Summary

```typescript
// Triggered automatically after call transcription
const event = {
  transcriptId: 'transcript-123',
  callId: 'contact-456',
  incidentId: 'incident-789'
};

const result = await generateSummaryHandler(event);
// Returns: { summaryId, incidentType, urgency }
```

### Agent Assist Query

```typescript
// Called during live call
const event = {
  query: 'What is the SLA for tire replacement?',
  contactId: 'contact-456',
  incidentType: 'tire',
  context: {
    driverLocation: 'Highway I-95',
    weatherCondition: 'Clear',
    urgency: 'high'
  }
};

const response = await agentAssistHandler(event);
// Returns: { answer, sources, confidence, responseTime }
```

## Monitoring and Observability

### CloudWatch Metrics

- `SummaryGenerationDuration`: Time to generate summary (target: <30s)
- `AgentAssistResponseTime`: Time to respond to agent query (target: <2s)
- `GuardrailInterventions`: Count of guardrail blocks
- `KendraQueryLatency`: Kendra search performance

### CloudWatch Alarms

- Alert if summary generation exceeds 25 seconds (approaching SLA)
- Alert if agent assist exceeds 1.8 seconds (approaching SLA)
- Alert on high guardrail intervention rate (>5%)

### X-Ray Tracing

All Lambda functions are instrumented with X-Ray for distributed tracing:
- Bedrock invocation latency
- Kendra query performance
- DynamoDB read/write times

## Security Considerations

1. **PII Protection**:
   - Transcripts are redacted before summary generation
   - Original PII stored encrypted in separate table with TTL
   - Access to PII requires authorization and is audit logged

2. **Guardrails**:
   - All Bedrock invocations use guardrails
   - Guardrail interventions are logged for review
   - Failed guardrail checks return safe fallback responses

3. **IAM Permissions**:
   - Lambda functions use least-privilege IAM roles
   - Bedrock access limited to specific models
   - Kendra access limited to specific index

4. **Encryption**:
   - All data encrypted at rest with KMS
   - All data encrypted in transit with TLS 1.3

## Testing

### Unit Tests

```bash
cd services/telephony-svc
pnpm test
```

### Integration Tests

```bash
# Test summary generation with sample transcript
aws lambda invoke \
  --function-name roadcall-generate-summary \
  --payload '{"transcriptId":"test-123","callId":"test-456"}' \
  response.json

# Test agent assist with sample query
aws lambda invoke \
  --function-name roadcall-agent-assist \
  --payload '{"query":"What is the tire replacement SLA?","contactId":"test-456"}' \
  response.json
```

### Load Testing

```bash
# Test concurrent summary generation
artillery run load-tests/summary-generation.yml

# Test agent assist response time under load
artillery run load-tests/agent-assist.yml
```

## Troubleshooting

### Summary Generation Timeout

**Symptom**: Summary generation exceeds 30 seconds

**Possible Causes**:
- Bedrock throttling
- Large transcript size
- Network latency

**Solutions**:
- Request Bedrock quota increase
- Implement transcript chunking for large calls
- Use provisioned throughput for Bedrock

### Agent Assist Slow Response

**Symptom**: Agent assist exceeds 2 seconds

**Possible Causes**:
- Kendra index not optimized
- Too many search results
- Bedrock cold start

**Solutions**:
- Optimize Kendra index with relevance tuning
- Limit search results to top 3
- Use Lambda provisioned concurrency

### Guardrail Interventions

**Symptom**: High rate of guardrail blocks

**Possible Causes**:
- Overly aggressive guardrail configuration
- Legitimate content being blocked
- PII in redacted transcripts

**Solutions**:
- Review and adjust guardrail thresholds
- Add exceptions for domain-specific terms
- Verify PII redaction is working correctly

## Cost Optimization

1. **Bedrock**: Use Claude Sonnet (balanced cost/performance) instead of Opus
2. **Kendra**: Use Developer edition for testing, Enterprise for production
3. **Lambda**: Use ARM64 architecture for 20% cost savings
4. **DynamoDB**: Use on-demand billing for variable workloads

## Future Enhancements

1. **Multi-language Support**: Extend to Spanish, French for international operations
2. **Custom Models**: Fine-tune models on roadside assistance domain
3. **Streaming Responses**: Real-time summary generation during calls
4. **Voice Synthesis**: Convert summaries to audio for accessibility
5. **Sentiment Trends**: Track driver sentiment over time for quality improvement

## References

- [Amazon Q in Connect Documentation](https://docs.aws.amazon.com/connect/latest/adminguide/amazon-q-connect.html)
- [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Amazon Kendra Developer Guide](https://docs.aws.amazon.com/kendra/latest/dg/what-is-kendra.html)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
