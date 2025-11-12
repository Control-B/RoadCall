import { S3Event } from 'aws-lambda';
import { kbService } from '../kb-service';
import { logger } from '@roadcall/utils';
import { eventBridge } from '@roadcall/aws-clients';

/**
 * S3 event handler triggered when a document is uploaded
 * Processes the document and indexes it in Kendra
 */
export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    try {
      const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      
      // Extract document ID from S3 key (format: documents/{documentId}/{filename})
      const parts = s3Key.split('/');
      if (parts.length < 3 || parts[0] !== 'documents') {
        logger.warn('Invalid S3 key format', { s3Key });
        continue;
      }

      const documentId = parts[1];

      logger.info('Processing document upload', { documentId, s3Key });

      // Process and index the document
      await kbService.indexDocument(documentId);

      // Publish DocumentIndexed event
      await eventBridge.publishEvent({
        source: 'roadcall.kb-service',
        detailType: 'DocumentIndexed',
        detail: {
          documentId,
          s3Key,
          timestamp: new Date().toISOString(),
        },
      });

      logger.info('Document processed successfully', { documentId });
    } catch (error) {
      logger.error('Error processing document', error as Error, { s3Key: record.s3.object.key });
      
      // Publish DocumentIndexingFailed event
      try {
        const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
        const documentId = s3Key.split('/')[1];

        await eventBridge.publishEvent({
          source: 'roadcall.kb-service',
          detailType: 'DocumentIndexingFailed',
          detail: {
            documentId,
            s3Key,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
        });
      } catch (eventError) {
        logger.error('Failed to publish error event', eventError as Error);
      }
    }
  }
};
