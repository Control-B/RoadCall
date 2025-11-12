/**
 * Verification Queue Service
 * 
 * Manages manual verification queue for collected vendor data
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { VerificationQueueItem, VendorData, DataProvenance } from './types';

export class VerificationQueue {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string = process.env.VERIFICATION_QUEUE_TABLE_NAME || 'VendorVerificationQueue') {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Add vendor data to verification queue
   */
  async addToQueue(vendorData: VendorData, provenance: DataProvenance): Promise<VerificationQueueItem> {
    const item: VerificationQueueItem = {
      itemId: uuidv4(),
      vendorData,
      provenance,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item
    }));

    console.log(`Added vendor to verification queue: ${item.itemId}`);
    return item;
  }

  /**
   * Get item from queue
   */
  async getItem(itemId: string): Promise<VerificationQueueItem | null> {
    const result = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { itemId }
    }));

    return result.Item as VerificationQueueItem || null;
  }

  /**
   * Get pending items from queue
   */
  async getPendingItems(limit: number = 50): Promise<VerificationQueueItem[]> {
    const result = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: 'StatusIndex',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'pending'
      },
      Limit: limit,
      ScanIndexForward: true // Oldest first
    }));

    return result.Items as VerificationQueueItem[] || [];
  }

  /**
   * Approve vendor data
   */
  async approve(itemId: string, verifiedBy: string): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { itemId },
      UpdateExpression: 'SET #status = :approved, verifiedBy = :verifiedBy, verifiedAt = :verifiedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':approved': 'approved',
        ':verifiedBy': verifiedBy,
        ':verifiedAt': new Date().toISOString()
      }
    }));

    console.log(`Approved verification item: ${itemId}`);
  }

  /**
   * Reject vendor data
   */
  async reject(itemId: string, verifiedBy: string, reason: string): Promise<void> {
    await this.docClient.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { itemId },
      UpdateExpression: 'SET #status = :rejected, verifiedBy = :verifiedBy, verifiedAt = :verifiedAt, rejectionReason = :reason',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':rejected': 'rejected',
        ':verifiedBy': verifiedBy,
        ':verifiedAt': new Date().toISOString(),
        ':reason': reason
      }
    }));

    console.log(`Rejected verification item: ${itemId} - ${reason}`);
  }

  /**
   * Get queue statistics
   */
  async getStatistics(): Promise<{
    pending: number;
    approved: number;
    rejected: number;
  }> {
    // In production, this would use DynamoDB aggregation or CloudWatch metrics
    // For now, return placeholder
    return {
      pending: 0,
      approved: 0,
      rejected: 0
    };
  }

  /**
   * Batch add items to queue
   */
  async addBatchToQueue(items: Array<{ vendorData: VendorData; provenance: DataProvenance }>): Promise<VerificationQueueItem[]> {
    const queueItems: VerificationQueueItem[] = [];

    for (const item of items) {
      const queueItem = await this.addToQueue(item.vendorData, item.provenance);
      queueItems.push(queueItem);
    }

    return queueItems;
  }
}
