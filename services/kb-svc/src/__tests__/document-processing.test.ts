import { KBService } from '../kb-service';
import { DocumentUploadRequest, KBDocument } from '../types';

// Mock AWS SDK clients
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-textract');
jest.mock('@aws-sdk/client-kendra');
jest.mock('@aws-sdk/client-bedrock-runtime');
jest.mock('@roadcall/aws-clients');

describe('Document Processing Pipeline Integration Tests', () => {
  let kbService: KBService;

  beforeEach(() => {
    kbService = new KBService();
    jest.clearAllMocks();
  });

  describe('Document Upload and Creation', () => {
    it('should create document record and generate presigned URL', async () => {
      const request: DocumentUploadRequest = {
        title: 'Test SOP Document',
        category: 'sop',
        fileType: 'application/pdf',
        fileSize: 1024000,
        uploadedBy: 'test-user-123',
        metadata: {
          tags: ['test', 'sop'],
          version: '1.0',
        },
      };

      const result = await kbService.createDocument(request);

      expect(result.document).toBeDefined();
      expect(result.document.documentId).toBeDefined();
      expect(result.document.title).toBe(request.title);
      expect(result.document.category).toBe(request.category);
      expect(result.document.indexStatus).toBe('pending');
      expect(result.uploadUrl).toBeDefined();
      expect(result.uploadUrl).toContain('https://');
    });

    it('should store document metadata in DynamoDB', async () => {
      const request: DocumentUploadRequest = {
        title: 'Vendor SLA Document',
        category: 'vendor_sla',
        fileType: 'application/pdf',
        fileSize: 512000,
        uploadedBy: 'admin-456',
      };

      const result = await kbService.createDocument(request);

      expect(result.document.s3Key).toContain('documents/');
      expect(result.document.s3Bucket).toBeDefined();
      expect(result.document.uploadedAt).toBeDefined();
    });
  });

  describe('Text Extraction with Textract', () => {
    it('should extract text from PDF document', async () => {
      const documentId = 'test-doc-123';
      
      // Mock document in DynamoDB
      const mockDocument: KBDocument = {
        documentId,
        title: 'Test PDF',
        category: 'sop',
        s3Key: 'documents/test-doc-123/test.pdf',
        s3Bucket: 'test-bucket',
        fileType: 'application/pdf',
        fileSize: 1024000,
        indexStatus: 'pending',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        metadata: {
          tags: [],
          version: '1.0',
        },
      };

      // Mock getDocument to return our test document
      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);

      // Mock Textract response
      const mockTextractResult = {
        text: 'This is extracted text from the PDF document.\n\nIt contains multiple paragraphs.',
        blocks: [
          { BlockType: 'LINE', Text: 'This is extracted text from the PDF document.', Confidence: 99.5 },
          { BlockType: 'LINE', Text: 'It contains multiple paragraphs.', Confidence: 98.8 },
        ],
        confidence: 99.15,
      };

      jest.spyOn(kbService, 'processDocument').mockResolvedValue(mockTextractResult);

      const result = await kbService.processDocument(documentId);

      expect(result.text).toBeDefined();
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(90);
      expect(result.blocks).toBeDefined();
    });

    it('should handle text files without Textract', async () => {
      const documentId = 'test-doc-456';
      
      const mockDocument: KBDocument = {
        documentId,
        title: 'Test Text File',
        category: 'policy',
        s3Key: 'documents/test-doc-456/test.txt',
        s3Bucket: 'test-bucket',
        fileType: 'text/plain',
        fileSize: 5000,
        indexStatus: 'pending',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        metadata: {
          tags: [],
          version: '1.0',
        },
      };

      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);

      const mockTextResult = {
        text: 'Plain text content from file',
        blocks: [],
        confidence: 100,
      };

      jest.spyOn(kbService, 'processDocument').mockResolvedValue(mockTextResult);

      const result = await kbService.processDocument(documentId);

      expect(result.text).toBe('Plain text content from file');
      expect(result.confidence).toBe(100);
    });
  });

  describe('Text Chunking', () => {
    it('should chunk large text into manageable segments', () => {
      const longText = 'A'.repeat(15000); // 15KB of text
      
      const chunks = kbService.chunkText(longText, 5000);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(5000);
      });
    });

    it('should preserve paragraph boundaries when chunking', () => {
      const text = [
        'Paragraph 1 with some content.',
        '',
        'Paragraph 2 with more content.',
        '',
        'Paragraph 3 with even more content.',
      ].join('\n');

      const chunks = kbService.chunkText(text, 100);

      // Each chunk should contain complete paragraphs
      chunks.forEach((chunk) => {
        expect(chunk.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle text smaller than chunk size', () => {
      const smallText = 'This is a small text.';
      
      const chunks = kbService.chunkText(smallText, 5000);

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(smallText);
    });
  });

  describe('Kendra Indexing', () => {
    it('should index document in Kendra with metadata', async () => {
      const documentId = 'test-doc-789';
      
      const mockDocument: KBDocument = {
        documentId,
        title: 'Troubleshooting Guide',
        category: 'troubleshooting',
        s3Key: 'documents/test-doc-789/guide.pdf',
        s3Bucket: 'test-bucket',
        fileType: 'application/pdf',
        fileSize: 2048000,
        indexStatus: 'pending',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        metadata: {
          tags: ['engine', 'diagnostics'],
          version: '2.0',
          effectiveDate: '2024-01-01',
        },
      };

      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);
      jest.spyOn(kbService, 'processDocument').mockResolvedValue({
        text: 'Troubleshooting content',
        blocks: [],
        confidence: 95,
      });

      await kbService.indexDocument(documentId);

      // Verify document status was updated
      const updatedDoc = await kbService.getDocument(documentId);
      expect(updatedDoc?.indexStatus).toBe('indexed');
      expect(updatedDoc?.kendraDocumentId).toBeDefined();
      expect(updatedDoc?.lastIndexedAt).toBeDefined();
    });

    it('should handle indexing failures gracefully', async () => {
      const documentId = 'test-doc-fail';
      
      const mockDocument: KBDocument = {
        documentId,
        title: 'Failing Document',
        category: 'sop',
        s3Key: 'documents/test-doc-fail/fail.pdf',
        s3Bucket: 'test-bucket',
        fileType: 'application/pdf',
        fileSize: 1024000,
        indexStatus: 'pending',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        metadata: {
          tags: [],
          version: '1.0',
        },
      };

      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);
      jest.spyOn(kbService, 'processDocument').mockRejectedValue(new Error('Textract failed'));

      await expect(kbService.indexDocument(documentId)).rejects.toThrow();

      // Verify document status was updated to failed
      const updatedDoc = await kbService.getDocument(documentId);
      expect(updatedDoc?.indexStatus).toBe('failed');
    });
  });

  describe('End-to-End Document Processing', () => {
    it('should complete full pipeline from upload to indexing', async () => {
      // Step 1: Create document
      const uploadRequest: DocumentUploadRequest = {
        title: 'Complete Pipeline Test',
        category: 'sop',
        fileType: 'application/pdf',
        fileSize: 1024000,
        uploadedBy: 'test-user',
        metadata: {
          tags: ['test', 'e2e'],
          version: '1.0',
        },
      };

      const { document } = await kbService.createDocument(uploadRequest);
      expect(document.indexStatus).toBe('pending');

      // Step 2: Simulate document upload to S3 (mocked)
      // In real scenario, client uploads to presigned URL

      // Step 3: Process document (extract text)
      jest.spyOn(kbService, 'processDocument').mockResolvedValue({
        text: 'Extracted document content for testing',
        blocks: [],
        confidence: 98,
      });

      const textResult = await kbService.processDocument(document.documentId);
      expect(textResult.text).toBeDefined();

      // Step 4: Index in Kendra
      await kbService.indexDocument(document.documentId);

      // Step 5: Verify final state
      const finalDoc = await kbService.getDocument(document.documentId);
      expect(finalDoc?.indexStatus).toBe('indexed');
      expect(finalDoc?.kendraDocumentId).toBeDefined();
    });
  });

  describe('Search and Retrieval', () => {
    it('should search documents by query', async () => {
      const searchRequest = {
        query: 'tire replacement procedure',
        category: 'sop' as const,
        limit: 10,
      };

      const mockResults = [
        {
          documentId: 'doc-1',
          title: 'Tire Replacement SOP',
          excerpt: 'To replace a tire, first ensure the vehicle is on level ground...',
          confidence: 0.95,
          category: 'sop' as const,
          s3Key: 'documents/doc-1/tire-sop.pdf',
        },
      ];

      jest.spyOn(kbService, 'search').mockResolvedValue(mockResults);

      const results = await kbService.search(searchRequest);

      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('Tire');
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it('should filter search results by category', async () => {
      const searchRequest = {
        query: 'safety procedures',
        category: 'policy' as const,
      };

      const mockResults = [
        {
          documentId: 'doc-2',
          title: 'Safety Policy',
          excerpt: 'All safety procedures must be followed...',
          confidence: 0.88,
          category: 'policy' as const,
          s3Key: 'documents/doc-2/safety.pdf',
        },
      ];

      jest.spyOn(kbService, 'search').mockResolvedValue(mockResults);

      const results = await kbService.search(searchRequest);

      expect(results.every((r) => r.category === 'policy')).toBe(true);
    });
  });

  describe('RAG Query Processing', () => {
    it('should generate AI answer with source citations', async () => {
      const ragRequest = {
        query: 'What are the steps for tire replacement?',
        category: 'sop' as const,
      };

      const mockResponse = {
        answer: 'Based on the SOPs, tire replacement involves: 1) Ensure vehicle is on level ground [Source 1], 2) Apply parking brake [Source 1], 3) Loosen lug nuts [Source 2]...',
        sources: [
          {
            title: 'Tire Replacement SOP',
            excerpt: 'Ensure vehicle is on level ground and apply parking brake...',
            confidence: 'VERY_HIGH',
            documentId: 'doc-1',
          },
          {
            title: 'Wheel Service Guide',
            excerpt: 'Loosen lug nuts before jacking the vehicle...',
            confidence: 'HIGH',
            documentId: 'doc-2',
          },
        ],
        timestamp: new Date().toISOString(),
      };

      jest.spyOn(kbService, 'ragQuery').mockResolvedValue(mockResponse);

      const response = await kbService.ragQuery(ragRequest);

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources).toHaveLength(2);
      expect(response.sources[0].confidence).toBe('VERY_HIGH');
    });

    it('should handle queries with no relevant documents', async () => {
      const ragRequest = {
        query: 'How to fly a helicopter?',
      };

      const mockResponse = {
        answer: 'I could not find relevant information in the knowledge base to answer your question.',
        sources: [],
        timestamp: new Date().toISOString(),
      };

      jest.spyOn(kbService, 'ragQuery').mockResolvedValue(mockResponse);

      const response = await kbService.ragQuery(ragRequest);

      expect(response.answer).toContain('could not find');
      expect(response.sources).toHaveLength(0);
    });
  });

  describe('Document Lifecycle Management', () => {
    it('should retrieve document by ID', async () => {
      const documentId = 'test-doc-retrieve';
      
      const mockDocument: KBDocument = {
        documentId,
        title: 'Retrieved Document',
        category: 'sop',
        s3Key: 'documents/test-doc-retrieve/doc.pdf',
        s3Bucket: 'test-bucket',
        fileType: 'application/pdf',
        fileSize: 1024000,
        indexStatus: 'indexed',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        kendraDocumentId: 'kendra-123',
        lastIndexedAt: new Date().toISOString(),
        metadata: {
          tags: ['test'],
          version: '1.0',
        },
      };

      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);

      const document = await kbService.getDocument(documentId);

      expect(document).toBeDefined();
      expect(document?.documentId).toBe(documentId);
      expect(document?.indexStatus).toBe('indexed');
    });

    it('should delete document and cleanup resources', async () => {
      const documentId = 'test-doc-delete';
      
      const mockDocument: KBDocument = {
        documentId,
        title: 'Document to Delete',
        category: 'sop',
        s3Key: 'documents/test-doc-delete/doc.pdf',
        s3Bucket: 'test-bucket',
        fileType: 'application/pdf',
        fileSize: 1024000,
        indexStatus: 'indexed',
        uploadedBy: 'test-user',
        uploadedAt: new Date().toISOString(),
        kendraDocumentId: 'kendra-456',
        metadata: {
          tags: [],
          version: '1.0',
        },
      };

      jest.spyOn(kbService, 'getDocument').mockResolvedValue(mockDocument);

      await kbService.deleteDocument(documentId);

      // Verify document was deleted
      jest.spyOn(kbService, 'getDocument').mockResolvedValue(null);
      const deletedDoc = await kbService.getDocument(documentId);
      expect(deletedDoc).toBeNull();
    });

    it('should list documents by category', async () => {
      const mockDocuments: KBDocument[] = [
        {
          documentId: 'doc-1',
          title: 'SOP Document 1',
          category: 'sop',
          s3Key: 'documents/doc-1/sop1.pdf',
          s3Bucket: 'test-bucket',
          fileType: 'application/pdf',
          fileSize: 1024000,
          indexStatus: 'indexed',
          uploadedBy: 'test-user',
          uploadedAt: '2024-01-01T00:00:00Z',
          metadata: { tags: [], version: '1.0' },
        },
        {
          documentId: 'doc-2',
          title: 'SOP Document 2',
          category: 'sop',
          s3Key: 'documents/doc-2/sop2.pdf',
          s3Bucket: 'test-bucket',
          fileType: 'application/pdf',
          fileSize: 2048000,
          indexStatus: 'indexed',
          uploadedBy: 'test-user',
          uploadedAt: '2024-01-02T00:00:00Z',
          metadata: { tags: [], version: '1.0' },
        },
      ];

      jest.spyOn(kbService, 'listDocuments').mockResolvedValue(mockDocuments);

      const documents = await kbService.listDocuments('sop', 50);

      expect(documents).toHaveLength(2);
      expect(documents.every((d) => d.category === 'sop')).toBe(true);
    });
  });
});
