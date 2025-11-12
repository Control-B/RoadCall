import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
} from '@aws-sdk/client-textract';
import {
  KendraClient,
  BatchPutDocumentCommand,
  BatchDeleteDocumentCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/client-kendra';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { dynamodb } from '@roadcall/aws-clients';
import { logger } from '@roadcall/utils';
import {
  KBDocument,
  DocumentUploadRequest,
  SearchRequest,
  SearchResult,
  RAGQueryRequest,
  RAGQueryResponse,
  TextractResult,
} from './types';

const s3Client = new S3Client({});
const textractClient = new TextractClient({});
const kendraClient = new KendraClient({});
const bedrockClient = new BedrockRuntimeClient({});

const TABLE_NAME = process.env.TABLE_NAME || 'KBDocuments';
const BUCKET_NAME = process.env.BUCKET_NAME || 'kb-documents';
const KENDRA_INDEX_ID = process.env.KENDRA_INDEX_ID || '';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';

export class KBService {
  /**
   * Create a document record and generate presigned upload URL
   */
  async createDocument(request: DocumentUploadRequest): Promise<{
    document: KBDocument;
    uploadUrl: string;
  }> {
    const documentId = uuidv4();
    const s3Key = `documents/${documentId}/${request.title}`;

    const document: KBDocument = {
      documentId,
      title: request.title,
      category: request.category,
      s3Key,
      s3Bucket: BUCKET_NAME,
      fileType: request.fileType,
      fileSize: request.fileSize,
      indexStatus: 'pending',
      uploadedBy: request.uploadedBy,
      uploadedAt: new Date().toISOString(),
      metadata: {
        tags: request.metadata?.tags || [],
        version: request.metadata?.version || '1.0',
        effectiveDate: request.metadata?.effectiveDate,
        expiryDate: request.metadata?.expiryDate,
      },
    };

    // Store in DynamoDB
    await dynamodb.put(TABLE_NAME, document);

    // Generate presigned URL for upload (valid for 15 minutes)
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: request.fileType,
      }),
      { expiresIn: 900 }
    );

    logger.info('Document created', { documentId, title: request.title });

    return { document, uploadUrl };
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<KBDocument | null> {
    return await dynamodb.get<KBDocument>(TABLE_NAME, { documentId });
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Delete from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: document.s3Key,
      })
    );

    // Delete from Kendra if indexed
    if (document.kendraDocumentId) {
      await kendraClient.send(
        new BatchDeleteDocumentCommand({
          IndexId: KENDRA_INDEX_ID,
          DocumentIdList: [document.kendraDocumentId],
        })
      );
    }

    // Delete from DynamoDB
    await dynamodb.delete(TABLE_NAME, { documentId });

    logger.info('Document deleted', { documentId });
  }

  /**
   * Process document: extract text using Textract
   */
  async processDocument(documentId: string): Promise<TextractResult> {
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    logger.info('Starting document processing', { documentId });

    // Start Textract job for PDF/images
    if (document.fileType === 'application/pdf' || document.fileType.startsWith('image/')) {
      const startCommand = new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: {
            Bucket: BUCKET_NAME,
            Name: document.s3Key,
          },
        },
      });

      const startResponse = await textractClient.send(startCommand);
      const jobId = startResponse.JobId!;

      // Poll for completion (simplified - in production use EventBridge)
      let status = 'IN_PROGRESS';
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

        const getCommand = new GetDocumentTextDetectionCommand({ JobId: jobId });
        const getResponse = await textractClient.send(getCommand);
        status = getResponse.JobStatus!;

        if (status === 'SUCCEEDED') {
          const blocks = getResponse.Blocks || [];
          const text = blocks
            .filter((block) => block.BlockType === 'LINE')
            .map((block) => block.Text)
            .join('\n');

          const avgConfidence =
            blocks.reduce((sum, block) => sum + (block.Confidence || 0), 0) / blocks.length;

          return {
            text,
            blocks,
            confidence: avgConfidence,
          };
        } else if (status === 'FAILED') {
          throw new Error('Textract processing failed');
        }

        attempts++;
      }

      throw new Error('Textract processing timeout');
    } else {
      // For text files, read directly from S3
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: document.s3Key,
      });

      const response = await s3Client.send(getCommand);
      const text = await response.Body!.transformToString();

      return {
        text,
        blocks: [],
        confidence: 100,
      };
    }
  }

  /**
   * Chunk text into smaller segments for indexing
   */
  chunkText(text: string, maxChunkSize: number = 5000): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split('\n\n');
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Index document in Kendra
   */
  async indexDocument(documentId: string): Promise<void> {
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    try {
      // Extract text
      const textractResult = await this.processDocument(documentId);

      // Index in Kendra
      const kendraDocumentId = `${documentId}-main`;
      const s3Uri = `s3://${BUCKET_NAME}/${document.s3Key}`;

      const documents = [
        {
          Id: kendraDocumentId,
          Title: document.title,
          ContentType: 'PLAIN_TEXT' as const,
          Blob: Buffer.from(textractResult.text),
          Attributes: [
            {
              Key: '_category',
              Value: { StringValue: document.category },
            },
            {
              Key: '_source_uri',
              Value: { StringValue: s3Uri },
            },
            {
              Key: 'tags',
              Value: { StringListValue: document.metadata.tags },
            },
            {
              Key: 'version',
              Value: { StringValue: document.metadata.version },
            },
            ...(document.metadata.effectiveDate
              ? [
                  {
                    Key: 'effectiveDate',
                    Value: { StringValue: document.metadata.effectiveDate },
                  },
                ]
              : []),
          ],
        },
      ];

      await kendraClient.send(
        new BatchPutDocumentCommand({
          IndexId: KENDRA_INDEX_ID,
          Documents: documents,
        })
      );

      // Update document status
      await dynamodb.update(
        TABLE_NAME,
        { documentId },
        {
          indexStatus: 'indexed',
          kendraDocumentId: kendraDocumentId,
          lastIndexedAt: new Date().toISOString(),
        }
      );

      logger.info('Document indexed successfully', { documentId, kendraDocumentId });
    } catch (error) {
      // Update status to failed
      await dynamodb.update(
        TABLE_NAME,
        { documentId },
        {
          indexStatus: 'failed',
        }
      );

      logger.error('Document indexing failed', error as Error, { documentId });
      throw error;
    }
  }

  /**
   * Search knowledge base using Kendra
   */
  async search(request: SearchRequest): Promise<SearchResult[]> {
    const queryInput: QueryCommandInput = {
      IndexId: KENDRA_INDEX_ID,
      QueryText: request.query,
      PageSize: request.limit || 10,
    };

    // Add category filter if specified
    if (request.category) {
      queryInput.AttributeFilter = {
        EqualsTo: {
          Key: '_category',
          Value: { StringValue: request.category },
        },
      };
    }

    const response = await kendraClient.send(new QueryCommand(queryInput));

    const results: SearchResult[] = [];

    for (const item of response.ResultItems || []) {
      if (item.Type === 'DOCUMENT' || item.Type === 'ANSWER') {
        // Extract document ID from Kendra document ID
        const kendraDocId = item.DocumentId || '';
        const documentId = kendraDocId.split('-')[0];

        results.push({
          documentId,
          title: item.DocumentTitle?.Text || '',
          excerpt: item.DocumentExcerpt?.Text || '',
          confidence: this.mapKendraConfidence(item.ScoreAttributes?.ScoreConfidence),
          category: this.extractCategory(item.DocumentAttributes),
          s3Key: this.extractS3Key(item.DocumentAttributes),
        });
      }
    }

    return results;
  }

  /**
   * RAG query: Search Kendra + Generate answer with Bedrock
   */
  async ragQuery(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    // Search Kendra for relevant documents
    const searchResults = await this.search({
      query: request.query,
      category: request.category,
      limit: 3,
    });

    if (searchResults.length === 0) {
      return {
        answer: 'I could not find relevant information in the knowledge base to answer your question.',
        sources: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Build context from search results
    const context = searchResults
      .map((result, index) => `[Source ${index + 1}: ${result.title}]\n${result.excerpt}`)
      .join('\n\n');

    // Build prompt for Bedrock
    const prompt = `Context from knowledge base:
${context}

User question: ${request.query}

Provide a concise answer based on the context above. If the context doesn't contain relevant information, say so. Cite sources by number when referencing information.`;

    // Call Bedrock
    const bedrockRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      body: JSON.stringify(bedrockRequest),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    return {
      answer: responseBody.content[0].text,
      sources: searchResults.map((result) => ({
        title: result.title,
        excerpt: result.excerpt,
        confidence: this.formatConfidence(result.confidence),
        documentId: result.documentId,
      })),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * List documents by category
   */
  async listDocuments(category?: string, limit: number = 50): Promise<KBDocument[]> {
    if (category) {
      return await dynamodb.query<KBDocument>(
        TABLE_NAME,
        'category = :category',
        { ':category': category },
        'category-uploadedAt-index',
        limit
      );
    } else {
      return await dynamodb.scan<KBDocument>(TABLE_NAME, limit);
    }
  }

  // Helper methods
  private mapKendraConfidence(confidence?: string): number {
    switch (confidence) {
      case 'VERY_HIGH':
        return 0.95;
      case 'HIGH':
        return 0.85;
      case 'MEDIUM':
        return 0.7;
      case 'LOW':
        return 0.5;
      default:
        return 0.5;
    }
  }

  private formatConfidence(confidence: number): string {
    if (confidence >= 0.9) return 'VERY_HIGH';
    if (confidence >= 0.8) return 'HIGH';
    if (confidence >= 0.6) return 'MEDIUM';
    return 'LOW';
  }

  private extractCategory(attributes?: any[]): any {
    const categoryAttr = attributes?.find((attr) => attr.Key === '_category');
    return categoryAttr?.Value?.StringValue || 'unknown';
  }

  private extractS3Key(attributes?: any[]): string {
    const uriAttr = attributes?.find((attr) => attr.Key === '_source_uri');
    const uri = uriAttr?.Value?.StringValue || '';
    return uri.replace(`s3://${BUCKET_NAME}/`, '');
  }
}

export const kbService = new KBService();
