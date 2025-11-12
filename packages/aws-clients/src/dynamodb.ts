// DynamoDB client wrapper

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@roadcall/utils';

export class DynamoDBWrapper {
  private client: DynamoDBDocumentClient;

  constructor(region?: string) {
    const dynamoClient = new DynamoDBClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }

  async get<T>(tableName: string, key: Record<string, unknown>): Promise<T | null> {
    try {
      const result = await this.client.send(
        new GetCommand({
          TableName: tableName,
          Key: key,
        })
      );

      return (result.Item as T) || null;
    } catch (error) {
      logger.error('DynamoDB get error', error as Error, { tableName, key });
      throw error;
    }
  }

  async put<T>(tableName: string, item: T): Promise<void> {
    try {
      await this.client.send(
        new PutCommand({
          TableName: tableName,
          Item: item as Record<string, unknown>,
        })
      );
    } catch (error) {
      logger.error('DynamoDB put error', error as Error, { tableName });
      throw error;
    }
  }

  async update(
    tableName: string,
    key: Record<string, unknown>,
    updates: Record<string, unknown>,
    condition?: string
  ): Promise<void> {
    try {
      const updateExpression = Object.keys(updates)
        .map((_k, i) => `#attr${i} = :val${i}`)
        .join(', ');

      const expressionAttributeNames = Object.keys(updates).reduce<Record<string, string>>(
        (acc, k, i) => ({ ...acc, [`#attr${i}`]: k }),
        {}
      );

      const expressionAttributeValues = Object.values(updates).reduce<Record<string, unknown>>(
        (acc, v, i) => ({ ...acc, [`:val${i}`]: v }),
        {}
      );

      await this.client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: key,
          UpdateExpression: `SET ${updateExpression}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ConditionExpression: condition,
        })
      );
    } catch (error) {
      logger.error('DynamoDB update error', error as Error, { tableName, key });
      throw error;
    }
  }

  async delete(tableName: string, key: Record<string, unknown>): Promise<void> {
    try {
      await this.client.send(
        new DeleteCommand({
          TableName: tableName,
          Key: key,
        })
      );
    } catch (error) {
      logger.error('DynamoDB delete error', error as Error, { tableName, key });
      throw error;
    }
  }

  async query<T>(
    tableName: string,
    keyCondition: string,
    expressionAttributeValues: Record<string, unknown>,
    indexName?: string,
    limit?: number
  ): Promise<T[]> {
    try {
      const result = await this.client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: expressionAttributeValues,
          IndexName: indexName,
          Limit: limit,
        })
      );

      return (result.Items as T[]) || [];
    } catch (error) {
      logger.error('DynamoDB query error', error as Error, { tableName, indexName });
      throw error;
    }
  }

  async scan<T>(tableName: string, limit?: number): Promise<T[]> {
    try {
      const result = await this.client.send(
        new ScanCommand({
          TableName: tableName,
          Limit: limit,
        })
      );

      return (result.Items as T[]) || [];
    } catch (error) {
      logger.error('DynamoDB scan error', error as Error, { tableName });
      throw error;
    }
  }

  async batchGet<T>(tableName: string, keys: Record<string, unknown>[]): Promise<T[]> {
    try {
      const result = await this.client.send(
        new BatchGetCommand({
          RequestItems: {
            [tableName]: {
              Keys: keys,
            },
          },
        })
      );

      return (result.Responses?.[tableName] as T[]) || [];
    } catch (error) {
      logger.error('DynamoDB batchGet error', error as Error, { tableName });
      throw error;
    }
  }

  async batchWrite(tableName: string, items: unknown[]): Promise<void> {
    try {
      const putRequests = items.map((item) => ({
        PutRequest: {
          Item: item as Record<string, unknown>,
        },
      }));

      await this.client.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: putRequests,
          },
        })
      );
    } catch (error) {
      logger.error('DynamoDB batchWrite error', error as Error, { tableName });
      throw error;
    }
  }
}

// Singleton instance
export const dynamodb = new DynamoDBWrapper();
