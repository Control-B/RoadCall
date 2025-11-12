/**
 * Audit Logger for Data Collection
 * 
 * Logs all data collection activities for compliance and debugging
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { AuditLogEntry } from './types';

export class AuditLogger {
  private docClient: DynamoDBDocumentClient;
  private tableName: string;

  constructor(tableName: string = process.env.AUDIT_TABLE_NAME || 'VendorDataAuditLog') {
    const client = new DynamoDBClient({});
    this.docClient = DynamoDBDocumentClient.from(client);
    this.tableName = tableName;
  }

  /**
   * Log a data collection activity
   */
  async log(entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): Promise<void> {
    const logEntry: AuditLogEntry = {
      logId: uuidv4(),
      timestamp: new Date().toISOString(),
      ...entry
    };

    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: logEntry
      }));

      // Also log to CloudWatch for real-time monitoring
      console.log('AUDIT_LOG:', JSON.stringify(logEntry));
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Log scraping started
   */
  async logScrapeStarted(targetUrl: string, details: Record<string, any>): Promise<void> {
    await this.log({
      action: 'scrape_started',
      targetUrl,
      success: true,
      details
    });
  }

  /**
   * Log scraping completed
   */
  async logScrapeCompleted(targetUrl: string, details: Record<string, any>): Promise<void> {
    await this.log({
      action: 'scrape_completed',
      targetUrl,
      success: true,
      details
    });
  }

  /**
   * Log scraping failed
   */
  async logScrapeFailed(targetUrl: string, error: string, details: Record<string, any>): Promise<void> {
    await this.log({
      action: 'scrape_failed',
      targetUrl,
      success: false,
      details,
      errorMessage: error
    });
  }

  /**
   * Log robots.txt check
   */
  async logRobotsCheck(targetUrl: string, allowed: boolean, reason?: string): Promise<void> {
    await this.log({
      action: 'robots_check',
      targetUrl,
      success: allowed,
      details: { allowed, reason }
    });
  }

  /**
   * Log rate limit applied
   */
  async logRateLimit(targetUrl: string, waitTime: number): Promise<void> {
    await this.log({
      action: 'rate_limit',
      targetUrl,
      success: true,
      details: { waitTime }
    });
  }

  /**
   * Log circuit breaker state change
   */
  async logCircuitBreakerStateChange(
    action: 'circuit_breaker_opened' | 'circuit_breaker_closed',
    details: Record<string, any>
  ): Promise<void> {
    await this.log({
      action,
      targetUrl: 'N/A',
      success: true,
      details
    });
  }

  /**
   * Log proxy rotation
   */
  async logProxyRotation(proxyUrl: string, details: Record<string, any>): Promise<void> {
    await this.log({
      action: 'proxy_rotated',
      targetUrl: proxyUrl,
      success: true,
      details
    });
  }
}
