# Knowledge Base Service (kb-svc)

The Knowledge Base Service manages document storage, processing, and retrieval for the AI Roadcall Assistant platform. It provides document upload, Textract-based text extraction, Kendra indexing, and RAG (Retrieval-Augmented Generation) capabilities using Amazon Bedrock.

## Features

- **Document Management**: Upload, retrieve, and delete knowledge base documents
- **Text Extraction**: Automatic text extraction from PDFs and images using Amazon Textract
- **Intelligent Indexing**: Document chunking and indexing in Amazon Kendra with custom attributes
- **Semantic Search**: Full-text and semantic search across the knowledge base
- **RAG Queries**: AI-powered question answering using Kendra search + Bedrock LLM
- **Event-Driven Processing**: Automatic document processing triggered by S3 uploads

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  API Gateway    │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐      ┌──────────────┐
│  Lambda         │─────▶│  DynamoDB    │
│  Handlers       │      │  (Metadata)  │
└──────┬──────────┘      └──────────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│     S3      │   │  Textract   │
│ (Documents) │   │             │
└──────┬──────┘   └──────┬──────┘
       │                 │
       │                 ▼
       │          ┌─────────────┐
       │          │   Kendra    │
       │          │   (Index)   │
       │          └──────┬──────┘
       │                 │
       │                 ▼
       │          ┌─────────────┐
       └─────────▶│   Bedrock   │
                  │    (RAG)    │
                  └─────────────┘
```

## API Endpoints

### POST /kb/documents
Create a new document and get a presigned upload URL.

**Request:**
```json
{
  "title": "Tire Replacement SOP",
  "category": "sop",
  "fileType": "application/pdf",
  "fileSize": 1024000,
  "uploadedBy": "admin-123",
  "metadata": {
    "tags": ["tire", "replacement", "procedure"],
    "version": "2.1",
    "effectiveDate": "2024-01-01"
  }
}
```

**Response:**
```json
{
  "document": {
    "documentId": "uuid",
    "title": "Tire Replacement SOP",
    "category": "sop",
    "s3Key": "documents/uuid/Tire Replacement SOP.pdf",
    "indexStatus": "pending",
    ...
  },
  "uploadUrl": "https://s3.amazonaws.com/..."
}
```

### GET /kb/documents/{id}
Retrieve document metadata by ID.

**Response:**
```json
{
  "documentId": "uuid",
  "title": "Tire Replacement SOP",
  "category": "sop",
  "indexStatus": "indexed",
  "kendraDocumentId": "uuid-main",
  ...
}
```

### DELETE /kb/documents/{id}
Delete a document from S3, Kendra, and DynamoDB.

**Response:** 204 No Content

### GET /kb/documents
List all documents, optionally filtered by category.

**Query Parameters:**
- `category` (optional): Filter by document category
- `limit` (optional): Maximum number of results (default: 50)

**Response:**
```json
{
  "documents": [...],
  "count": 10
}
```

### POST /kb/search
Search the knowledge base using Kendra.

**Request:**
```json
{
  "query": "How to replace a tire?",
  "category": "sop",
  "limit": 10
}
```

**Response:**
```json
{
  "results": [
    {
      "documentId": "uuid",
      "title": "Tire Replacement SOP",
      "excerpt": "To replace a tire, first ensure...",
      "confidence": 0.95,
      "category": "sop",
      "s3Key": "documents/uuid/..."
    }
  ],
  "count": 1
}
```

### POST /kb/query
Perform a RAG query (search + AI-generated answer).

**Request:**
```json
{
  "query": "What are the safety precautions for tire replacement?",
  "category": "sop"
}
```

**Response:**
```json
{
  "answer": "Based on the SOPs, key safety precautions include: 1) Ensure the vehicle is on level ground [Source 1], 2) Use wheel chocks [Source 1], 3) Wear safety glasses and gloves [Source 2]...",
  "sources": [
    {
      "title": "Tire Replacement SOP",
      "excerpt": "Always ensure the vehicle is on level ground...",
      "confidence": "VERY_HIGH",
      "documentId": "uuid"
    }
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Document Processing Pipeline

1. **Upload**: Client creates document record and uploads file to S3 using presigned URL
2. **Trigger**: S3 upload triggers Lambda function via S3 event notification
3. **Extract**: Lambda uses Textract to extract text from PDF/images
4. **Chunk**: Text is chunked into manageable segments (max 5000 chars)
5. **Index**: Chunks are indexed in Kendra with metadata attributes
6. **Update**: Document status updated to "indexed" in DynamoDB
7. **Event**: DocumentIndexed event published to EventBridge

## Document Categories

- `sop`: Standard Operating Procedures
- `vendor_sla`: Vendor Service Level Agreements
- `troubleshooting`: Troubleshooting guides
- `policy`: Company policies and guidelines

## Environment Variables

- `TABLE_NAME`: DynamoDB table name for document metadata
- `BUCKET_NAME`: S3 bucket name for document storage
- `KENDRA_INDEX_ID`: Amazon Kendra index ID
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: Claude 3 Sonnet)
- `EVENT_BUS_NAME`: EventBridge event bus name

## DynamoDB Schema

**Table: KBDocuments**
- Primary Key: `documentId` (String)
- GSI: `category-uploadedAt-index`
  - Partition Key: `category` (String)
  - Sort Key: `uploadedAt` (String)

**Attributes:**
- `documentId`: Unique document identifier
- `title`: Document title
- `category`: Document category
- `s3Key`: S3 object key
- `s3Bucket`: S3 bucket name
- `fileType`: MIME type
- `fileSize`: File size in bytes
- `kendraDocumentId`: Kendra document ID (after indexing)
- `indexStatus`: pending | indexed | failed
- `uploadedBy`: User ID who uploaded
- `uploadedAt`: ISO timestamp
- `lastIndexedAt`: ISO timestamp
- `metadata`: Object with tags, version, dates

## Kendra Index Configuration

**Custom Attributes:**
- `_category`: Document category (facetable, searchable)
- `_source_uri`: S3 URI of source document
- `tags`: Array of tags (facetable, searchable)
- `version`: Document version
- `effectiveDate`: Date when document becomes effective

**Index Settings:**
- Edition: Developer or Enterprise
- Query capacity: Auto-scaling
- Storage capacity: Auto-scaling
- Relevance tuning: Boost recent documents, prioritize SOPs

## Testing

Run unit tests:
```bash
pnpm test
```

Run integration tests:
```bash
pnpm test:integration
```

## Performance Considerations

- **Textract Processing**: Asynchronous processing for large PDFs (5+ minutes)
- **Kendra Indexing**: Typically completes within 15 minutes
- **Search Latency**: P95 < 500ms for Kendra queries
- **RAG Latency**: P95 < 2s (includes Kendra search + Bedrock inference)
- **File Size Limit**: 50MB per document
- **Concurrent Uploads**: Supports 100+ concurrent uploads

## Security

- **Encryption at Rest**: S3 SSE-KMS, DynamoDB encryption
- **Encryption in Transit**: TLS 1.3 for all API calls
- **Access Control**: IAM roles with least-privilege policies
- **Presigned URLs**: 15-minute expiry for uploads
- **Input Validation**: File type, size, and metadata validation
- **Bedrock Guardrails**: PII filtering and content safety

## Monitoring

**CloudWatch Metrics:**
- `DocumentsUploaded`: Count of successful uploads
- `DocumentsIndexed`: Count of successful indexing operations
- `IndexingFailures`: Count of failed indexing operations
- `SearchLatency`: P50, P95, P99 latency for searches
- `RAGLatency`: P50, P95, P99 latency for RAG queries

**CloudWatch Alarms:**
- Indexing failure rate > 5%
- Search latency P95 > 1s
- RAG latency P95 > 3s

## Future Enhancements

- [ ] Support for video/audio transcription
- [ ] Multi-language document support
- [ ] Document versioning and change tracking
- [ ] Collaborative editing and annotations
- [ ] Advanced analytics on document usage
- [ ] Integration with external knowledge sources
