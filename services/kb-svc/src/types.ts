export type DocumentCategory = 'sop' | 'vendor_sla' | 'troubleshooting' | 'policy';
export type IndexStatus = 'pending' | 'indexed' | 'failed';

export interface KBDocument {
  documentId: string;
  title: string;
  category: DocumentCategory;
  s3Key: string;
  s3Bucket: string;
  fileType: string;
  fileSize: number;
  kendraDocumentId?: string;
  indexStatus: IndexStatus;
  uploadedBy: string;
  uploadedAt: string;
  lastIndexedAt?: string;
  metadata: {
    tags: string[];
    version: string;
    effectiveDate?: string;
    expiryDate?: string;
  };
}

export interface DocumentUploadRequest {
  title: string;
  category: DocumentCategory;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  metadata?: {
    tags?: string[];
    version?: string;
    effectiveDate?: string;
    expiryDate?: string;
  };
}

export interface SearchRequest {
  query: string;
  category?: DocumentCategory;
  limit?: number;
}

export interface SearchResult {
  documentId: string;
  title: string;
  excerpt: string;
  confidence: number;
  category: DocumentCategory;
  s3Key: string;
}

export interface RAGQueryRequest {
  query: string;
  category?: DocumentCategory;
  context?: Record<string, any>;
}

export interface RAGQueryResponse {
  answer: string;
  sources: Array<{
    title: string;
    excerpt: string;
    confidence: string;
    documentId?: string;
  }>;
  timestamp: string;
}

export interface TextractResult {
  text: string;
  blocks: any[];
  confidence: number;
}

export interface KendraIndexRequest {
  documentId: string;
  title: string;
  content: string;
  category: DocumentCategory;
  s3Uri: string;
  metadata: Record<string, any>;
}
