# NTTS Data Integration Design

## Overview

This design document outlines the architecture for integrating NTTS (nttsbreakdown.com) mechanic data into the RoadCall platform. The solution leverages existing AWS services (Amazon Bedrock, Titan, Q, Connect) and enhances the vendor data pipeline, knowledge base, and matching services to provide comprehensive mechanic coverage.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NTTS Data Integration                     │
└─────────────────────────────────────────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Scraping   │        │  Knowledge   │        │   Matching   │
│   Pipeline   │───────▶│     Base     │───────▶│   Service    │
└──────────────┘        └──────────────┘        └──────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  DynamoDB    │        │    Titan     │        │   Bedrock    │
│  (Raw Data)  │        │ (Embeddings) │        │   (Claude)   │
└──────────────┘        └──────────────┘        └──────────────┘
```

### Detailed Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         EventBridge Scheduler                        │
│                      (Daily at 2 AM UTC)                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NTTS Scraping Orchestrator                        │
│  - Check robots.txt                                                  │
│  - Generate target URLs                                              │
│  - Queue scraping jobs                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SQS Queue                                    │
│                    (Scraping Jobs)                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Scraper Lambda (Parallel)                         │
│  - Playwright browser automation                                     │
│  - Extract: name, address, phone, services, hours                    │
│  - Rate limiting & proxy rotation                                    │
│  - Circuit breaker monitoring                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    DynamoDB: NTTSVendors                            │
│  PK: vendorId                                                        │
│  Attributes: businessName, address, phone, services[], hours,        │
│              sourceUrl, scrapedAt, verificationStatus               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Verification Queue                                │
│  - Manual review workflow                                            │
│  - Data quality checks                                               │
│  - Approval/rejection                                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Embedding Generator Lambda                        │
│  - Generate text description                                         │
│  - Call Amazon Titan Embeddings                                      │
│  - Store in vector database                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              OpenSearch / Pinecone (Vector DB)                       │
│  - Store embeddings                                                  │
│  - Semantic similarity search                                        │
│  - Geospatial + semantic hybrid search                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Enhanced Matching Service                         │
│  1. Geospatial query (DynamoDB + Redis)                             │
│  2. Semantic query (Vector DB)                                       │
│  3. Bedrock Claude scoring                                           │
│  4. Unified ranking                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. NTTS Scraping Orchestrator

**Purpose**: Coordinates daily scraping jobs and manages the scraping workflow.

**Interfaces**:
```typescript
interface ScrapingJob {
  jobId: string;
  targetUrl: string;
  targetType: 'listing' | 'detail';
  priority: number;
  retryCount: number;
  scheduledAt: string;
}

interface ScrapingResult {
  jobId: string;
  success: boolean;
  vendorData?: NTTSVendorData;
  error?: string;
  scrapedAt: string;
}
```

**Key Functions**:
- `checkRobotsTxt()`: Verify scraping is allowed
- `generateTargetUrls()`: Create list of pages to scrape
- `queueScrapingJobs()`: Send jobs to SQS
- `monitorCircuitBreaker()`: Check error rates

### 2. Scraper Lambda

**Purpose**: Executes web scraping using Playwright with rate limiting and proxy rotation.

**Interfaces**:
```typescript
interface NTTSVendorData {
  businessName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  };
  phone: string;
  services: string[]; // ['tire', 'engine', 'towing', 'electrical']
  hours: {
    [day: string]: { open: string; close: string } | 'closed';
  };
  specializations?: string[];
  sourceUrl: string;
  scrapedAt: string;
}
```

**Key Functions**:
- `scrapeListingPage()`: Extract vendor links from directory
- `scrapeDetailPage()`: Extract full vendor information
- `geocodeAddress()`: Convert address to coordinates using AWS Location
- `validateData()`: Ensure data quality before storage

### 3. Embedding Generator

**Purpose**: Generate semantic embeddings using Amazon Titan for similarity search.

**Interfaces**:
```typescript
interface VendorEmbedding {
  vendorId: string;
  embedding: number[]; // 1536-dimensional vector from Titan
  textDescription: string;
  services: string[];
  specializations: string[];
  location: {
    lat: number;
    lon: number;
  };
  createdAt: string;
}

interface EmbeddingRequest {
  vendorId: string;
  textDescription: string;
}

interface EmbeddingResponse {
  embedding: number[];
  modelId: string;
  inputTokens: number;
}
```

**Key Functions**:
- `generateTextDescription()`: Create rich text from vendor data
- `callTitanEmbeddings()`: Invoke Bedrock Titan model
- `storeEmbedding()`: Save to vector database
- `updateIndex()`: Refresh search index

### 4. Enhanced Matching Service

**Purpose**: Combine geospatial, semantic, and AI-powered matching for optimal vendor selection.

**Interfaces**:
```typescript
interface EnhancedMatchRequest {
  incidentId: string;
  location: {
    lat: number;
    lon: number;
  };
  issueDescription: string;
  incidentType: 'tire' | 'engine' | 'tow' | 'electrical';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  vehicleType?: string;
}

interface MatchCandidate {
  vendorId: string;
  source: 'registered' | 'ntts';
  businessName: string;
  distance: number; // miles
  semanticScore: number; // 0-1
  capabilityScore: number; // 0-1
  availabilityScore: number; // 0-1
  overallScore: number; // weighted combination
  explanation: string; // Bedrock-generated
}

interface EnhancedMatchResponse {
  candidates: MatchCandidate[];
  searchRadius: number;
  totalCandidates: number;
  nttsCount: number;
  registeredCount: number;
}
```

**Key Functions**:
- `extractIssueFeatures()`: Use Bedrock Claude to analyze issue description
- `performGeospatialSearch()`: Query DynamoDB + Redis for nearby vendors
- `performSemanticSearch()`: Query vector DB for capability match
- `scoreWithBedrock()`: Use Claude to score vendor suitability
- `mergeAndRank()`: Combine all sources and rank by weighted score

### 5. Knowledge Base Enhancement

**Purpose**: Integrate NTTS data into Amazon Kendra for Q in Connect queries.

**Interfaces**:
```typescript
interface KendraDocument {
  documentId: string;
  title: string; // Business name
  content: string; // Rich description
  attributes: {
    _category: 'ntts_vendor';
    services: string[];
    location: string;
    phone: string;
    specializations: string[];
    verificationStatus: 'pending' | 'verified' | 'rejected';
  };
}

interface AgentAssistQuery {
  query: string; // "Find tire specialist near I-95 mile marker 120"
  context: {
    incidentType?: string;
    location?: { lat: number; lon: number };
    urgency?: string;
  };
}

interface AgentAssistResponse {
  answer: string; // Bedrock-generated natural language response
  vendors: MatchCandidate[];
  sources: KendraSource[];
  confidence: number;
  responseTime: number;
}
```

**Key Functions**:
- `indexNTTSVendor()`: Add vendor to Kendra index
- `queryKendraWithContext()`: Search with location and service filters
- `generateRAGResponse()`: Use Bedrock to create natural language answer
- `enrichWithRealTimeData()`: Add availability and ETA information

## Data Models

### DynamoDB: NTTSVendors Table

```typescript
{
  vendorId: string; // PK: uuid
  businessName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    coordinates: { lat: number; lon: number };
  };
  phone: string;
  services: string[]; // ['tire', 'engine', 'towing']
  hours: {
    monday: { open: '08:00', close: '17:00' } | 'closed';
    // ... other days
  };
  specializations: string[];
  sourceUrl: string;
  scrapedAt: string; // ISO timestamp
  verificationStatus: 'pending' | 'verified' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  lastUpdated: string;
  geohash: string; // GSI for geospatial queries
  state: string; // GSI for state-based queries
}
```

**GSIs**:
- `geohash-index`: For geospatial proximity queries
- `state-verificationStatus-index`: For admin filtering
- `verificationStatus-scrapedAt-index`: For verification queue

### Vector Database Schema (OpenSearch/Pinecone)

```typescript
{
  id: string; // vendorId
  vector: number[]; // 1536-dim Titan embedding
  metadata: {
    businessName: string;
    services: string[];
    specializations: string[];
    location: { lat: number; lon: number };
    state: string;
    verificationStatus: string;
    source: 'ntts';
  };
}
```

### DynamoDB: ScrapingAuditLog Table

```typescript
{
  auditId: string; // PK: uuid
  jobId: string; // GSI
  targetUrl: string;
  action: 'scrape' | 'verify' | 'update' | 'delete';
  success: boolean;
  errorMessage?: string;
  dataCollected?: object;
  ipAddress: string; // Proxy IP used
  userAgent: string;
  timestamp: string;
  complianceFlags: {
    robotsTxtCompliant: boolean;
    rateLimitCompliant: boolean;
    legalReview: boolean;
  };
}
```

## Error Handling

### Circuit Breaker Implementation

```typescript
class ScrapingCircuitBreaker {
  private errorCount: number = 0;
  private requestCount: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private lastFailureTime?: Date;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime!.getTime() > 60000) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      this.requestCount++;
      if (this.state === 'half-open') {
        this.reset();
      }
      return result;
    } catch (error) {
      this.errorCount++;
      this.requestCount++;
      
      const errorRate = this.errorCount / this.requestCount;
      if (errorRate > 0.1 && this.requestCount >= 10) {
        this.open();
      }
      throw error;
    }
  }
  
  private open() {
    this.state = 'open';
    this.lastFailureTime = new Date();
    // Send CloudWatch alarm
    publishMetric('CircuitBreakerOpened', 1);
  }
  
  private reset() {
    this.state = 'closed';
    this.errorCount = 0;
    this.requestCount = 0;
  }
}
```

### Retry Strategy

- **Scraping Failures**: Exponential backoff (1s, 2s, 4s) with max 3 retries
- **Bedrock Throttling**: Exponential backoff with jitter
- **Vector DB Timeouts**: Immediate retry once, then fail
- **DynamoDB Errors**: AWS SDK automatic retry with exponential backoff

## Testing Strategy

### Unit Tests
- Scraper data extraction logic
- Embedding generation
- Match scoring algorithm
- Circuit breaker state transitions

### Integration Tests
- End-to-end scraping workflow
- Bedrock Titan embedding generation
- Vector database search accuracy
- Kendra indexing and retrieval

### Load Tests
- 1000 concurrent scraping jobs
- 10,000 semantic searches per minute
- Bedrock API rate limit handling
- Vector database query performance

### Compliance Tests
- Robots.txt compliance verification
- Rate limiting enforcement
- PII detection in scraped data
- Audit log completeness

## Security Considerations

1. **Data Privacy**: No PII collected from NTTS (only business information)
2. **Access Control**: IAM roles with least-privilege for all services
3. **Encryption**: All data encrypted at rest (KMS) and in transit (TLS 1.3)
4. **Audit Logging**: Complete audit trail of all scraping activities
5. **Bedrock Guardrails**: PII filtering and content safety for all AI operations
6. **Rate Limiting**: Prevent service disruption and respect website resources
7. **Legal Compliance**: Robots.txt compliance and terms of service review

## Performance Targets

- **Scraping**: 10 pages/minute per Lambda instance
- **Embedding Generation**: < 2 seconds per vendor
- **Semantic Search**: < 500ms for top 10 results
- **Enhanced Matching**: < 3 seconds end-to-end
- **Agent Assist**: < 2 seconds for Q in Connect queries
- **Daily Scraping**: Complete 10,000 vendors in < 4 hours

## Cost Optimization

1. **Bedrock**: Use Titan Embeddings (cheaper than Claude for embeddings)
2. **Lambda**: ARM64 architecture for 20% cost savings
3. **Vector DB**: Use OpenSearch Serverless instead of Pinecone for lower cost
4. **Caching**: ElastiCache for frequently accessed embeddings (1-hour TTL)
5. **Batch Processing**: Batch Bedrock calls to reduce API overhead
6. **DynamoDB**: On-demand billing for variable scraping workloads
