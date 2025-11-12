import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  PinpointClient,
  SendMessagesCommand,
} from '@aws-sdk/client-pinpoint';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { v4 as uuidv4 } from 'uuid';
import { NotificationRequest, NotificationChannel, NotificationType } from '@roadcall/types';
import { logger } from '@roadcall/utils';
import {
  NotificationLog,
  NotificationPreferences,
  UserContact,
  RateLimitEntry,
} from './types';
import { getTemplate, renderTemplate } from './templates';

const dynamoClient = new DynamoDBClient({});
const pinpointClient = new PinpointClient({});
const sesClient = new SESClient({});

const NOTIFICATION_LOG_TABLE = process.env.NOTIFICATION_LOG_TABLE || 'NotificationLog';
const PREFERENCES_TABLE = process.env.PREFERENCES_TABLE || 'NotificationPreferences';
const RATE_LIMIT_TABLE = process.env.RATE_LIMIT_TABLE || 'NotificationRateLimits';
const PINPOINT_APP_ID = process.env.PINPOINT_APP_ID || '';
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@roadcall.example.com';

// Rate limit: 10 SMS per user per hour
const SMS_RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export class NotificationService {
  /**
   * Send a notification through multiple channels
   */
  async sendNotification(request: NotificationRequest): Promise<NotificationLog> {
    const notificationId = uuidv4();
    logger.info('Sending notification', { notificationId, type: request.type, recipientId: request.recipientId });

    try {
      // 1. Get user preferences
      const preferences = await this.getUserPreferences(request.recipientId);

      // 2. Filter channels based on preferences and quiet hours
      const enabledChannels = await this.filterChannels(request.channels, preferences, request.type);

      if (enabledChannels.length === 0) {
        logger.info('No enabled channels for notification', { notificationId, recipientId: request.recipientId });
        return this.createNotificationLog(notificationId, request, {}, 'no_channels');
      }

      // 3. Check rate limits
      const allowedChannels = await this.checkRateLimits(request.recipientId, enabledChannels);

      if (allowedChannels.length === 0) {
        logger.warn('Rate limit exceeded for all channels', { notificationId, recipientId: request.recipientId });
        return this.createNotificationLog(notificationId, request, {}, 'rate_limited');
      }

      // 4. Get user contact info
      const contact = await this.getUserContact(request.recipientId);

      // 5. Get and render template
      const template = getTemplate(request.type);
      const renderedTemplate = this.renderNotificationTemplate(template, request.data);

      // 6. Send via each channel (parallel)
      const deliveryResults = await Promise.allSettled(
        allowedChannels.map(async (channel) => {
          switch (channel) {
            case 'push':
              return this.sendPushNotification(contact, renderedTemplate.push!, request.priority);
            case 'sms':
              return this.sendSMS(contact.phone, renderedTemplate.sms!);
            case 'email':
              return this.sendEmail(contact.email!, renderedTemplate.email!);
            default:
              throw new Error(`Unsupported channel: ${channel}`);
          }
        })
      );

      // 7. Build delivery status
      const deliveryStatus: NotificationLog['deliveryStatus'] = {};
      allowedChannels.forEach((channel, index) => {
        const result = deliveryResults[index];
        if (result.status === 'fulfilled') {
          deliveryStatus[channel] = {
            status: 'sent',
            timestamp: new Date().toISOString(),
            messageId: result.value,
          };
        } else {
          deliveryStatus[channel] = {
            status: 'failed',
            timestamp: new Date().toISOString(),
            error: result.reason?.message || 'Unknown error',
          };
        }
      });

      // 8. Log notification
      const log = await this.createNotificationLog(notificationId, request, deliveryStatus);

      // 9. Update rate limits
      await this.updateRateLimits(request.recipientId, allowedChannels);

      return log;
    } catch (error) {
      logger.error('Failed to send notification', error instanceof Error ? error : new Error(String(error)), { notificationId });
      throw error;
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const result = await dynamoClient.send(
        new GetItemCommand({
          TableName: PREFERENCES_TABLE,
          Key: marshall({ userId }),
        })
      );

      if (!result.Item) {
        // Return default preferences
        return {
          userId,
          channels: {
            push: { enabled: true },
            sms: { enabled: true },
            email: { enabled: true },
          },
          mutedTypes: [],
          updatedAt: new Date().toISOString(),
        };
      }

      return unmarshall(result.Item) as NotificationPreferences;
    } catch (error) {
      logger.error('Failed to get user preferences', error instanceof Error ? error : new Error(String(error)), { userId });
      // Return default preferences on error
      return {
        userId,
        channels: {
          push: { enabled: true },
          sms: { enabled: true },
          email: { enabled: true },
        },
        mutedTypes: [],
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(preferences: NotificationPreferences): Promise<void> {
    preferences.updatedAt = new Date().toISOString();

    await dynamoClient.send(
      new PutItemCommand({
        TableName: PREFERENCES_TABLE,
        Item: marshall(preferences),
      })
    );

    logger.info('Updated user preferences', { userId: preferences.userId });
  }

  /**
   * Filter channels based on preferences and quiet hours
   */
  private async filterChannels(
    requestedChannels: NotificationChannel[],
    preferences: NotificationPreferences,
    type: NotificationType
  ): Promise<NotificationChannel[]> {
    // Check if notification type is muted
    if (preferences.mutedTypes.includes(type)) {
      return [];
    }

    // Filter by enabled channels
    let enabledChannels = requestedChannels.filter((channel) => preferences.channels[channel]?.enabled);

    // Check quiet hours (only for non-urgent notifications)
    if (preferences.quietHours && !this.isUrgentNotification(type)) {
      const isQuietHours = this.isInQuietHours(preferences.quietHours);
      if (isQuietHours) {
        // During quiet hours, only allow push notifications (silent)
        enabledChannels = enabledChannels.filter((ch) => ch === 'push');
      }
    }

    return enabledChannels;
  }

  /**
   * Check if notification type is urgent (should bypass quiet hours)
   */
  private isUrgentNotification(type: NotificationType): boolean {
    const urgentTypes: NotificationType[] = ['offer_received', 'vendor_arrived', 'otp_code', 'system_alert'];
    return urgentTypes.includes(type);
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(quietHours: { start: string; end: string; timezone: string }): boolean {
    // Simplified implementation - in production, use proper timezone handling
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = quietHours.start.split(':').map(Number);
    const [endHour, endMinute] = quietHours.end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  /**
   * Check rate limits for channels
   */
  private async checkRateLimits(
    userId: string,
    channels: NotificationChannel[]
  ): Promise<NotificationChannel[]> {
    const allowedChannels: NotificationChannel[] = [];

    for (const channel of channels) {
      if (channel !== 'sms') {
        // Only SMS has rate limiting
        allowedChannels.push(channel);
        continue;
      }

      const rateLimitKey = `${userId}#${channel}`;
      const now = Date.now();
      const windowStart = now - RATE_LIMIT_WINDOW_MS;

      try {
        const result = await dynamoClient.send(
          new GetItemCommand({
            TableName: RATE_LIMIT_TABLE,
            Key: marshall({ rateLimitKey }),
          })
        );

        if (!result.Item) {
          allowedChannels.push(channel);
          continue;
        }

        const entry = unmarshall(result.Item) as RateLimitEntry;

        // Check if window has expired
        if (entry.windowStart < windowStart) {
          allowedChannels.push(channel);
          continue;
        }

        // Check if under limit
        if (entry.count < SMS_RATE_LIMIT) {
          allowedChannels.push(channel);
        } else {
          logger.warn('Rate limit exceeded', { userId, channel, count: entry.count });
        }
      } catch (error) {
        logger.error('Failed to check rate limit', error instanceof Error ? error : new Error(String(error)), { userId, channel });
        // Allow on error to avoid blocking notifications
        allowedChannels.push(channel);
      }
    }

    return allowedChannels;
  }

  /**
   * Update rate limits after sending
   */
  private async updateRateLimits(userId: string, channels: NotificationChannel[]): Promise<void> {
    for (const channel of channels) {
      if (channel !== 'sms') {
        continue;
      }

      const rateLimitKey = `${userId}#${channel}`;
      const now = Date.now();
      const expiresAt = Math.floor((now + RATE_LIMIT_WINDOW_MS) / 1000);

      try {
        await dynamoClient.send(
          new UpdateItemCommand({
            TableName: RATE_LIMIT_TABLE,
            Key: marshall({ rateLimitKey }),
            UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, windowStart = :now, expiresAt = :exp',
            ExpressionAttributeNames: {
              '#count': 'count',
            },
            ExpressionAttributeValues: marshall({
              ':zero': 0,
              ':inc': 1,
              ':now': now,
              ':exp': expiresAt,
            }),
          })
        );
      } catch (error) {
        logger.error('Failed to update rate limit', error instanceof Error ? error : new Error(String(error)), { userId, channel });
      }
    }
  }

  /**
   * Get user contact information
   */
  private async getUserContact(userId: string): Promise<UserContact> {
    // In production, this would query the Users table
    // For now, return mock data
    return {
      userId,
      phone: '+15551234567',
      email: 'user@example.com',
      deviceTokens: [],
    };
  }

  /**
   * Render notification template with data
   */
  private renderNotificationTemplate(
    template: any,
    data: Record<string, unknown>
  ): {
    push?: { title: string; body: string; data?: Record<string, string> };
    sms?: string;
    email?: { subject: string; htmlBody: string; textBody: string };
  } {
    const rendered: any = {};

    if (template.push) {
      rendered.push = {
        title: renderTemplate(template.push.title, data),
        body: renderTemplate(template.push.body, data),
        data: template.push.data
          ? Object.entries(template.push.data).reduce((acc, [key, value]) => {
              acc[key] = renderTemplate(value as string, data);
              return acc;
            }, {} as Record<string, string>)
          : undefined,
      };
    }

    if (template.sms) {
      rendered.sms = renderTemplate(template.sms, data);
    }

    if (template.email) {
      rendered.email = {
        subject: renderTemplate(template.email.subject, data),
        htmlBody: renderTemplate(template.email.htmlBody, data),
        textBody: renderTemplate(template.email.textBody, data),
      };
    }

    return rendered;
  }

  /**
   * Send push notification via Pinpoint
   */
  private async sendPushNotification(
    contact: UserContact,
    notification: { title: string; body: string; data?: Record<string, string> },
    priority: string
  ): Promise<string> {
    if (!contact.deviceTokens || contact.deviceTokens.length === 0) {
      throw new Error('No device tokens available');
    }

    const command = new SendMessagesCommand({
      ApplicationId: PINPOINT_APP_ID,
      MessageRequest: {
        Addresses: contact.deviceTokens.reduce((acc, token) => {
          acc[token] = { ChannelType: 'APNS' }; // or 'GCM' for Android
          return acc;
        }, {} as any),
        MessageConfiguration: {
          APNSMessage: {
            Title: notification.title,
            Body: notification.body,
            Data: notification.data,
            Priority: priority === 'urgent' ? 'high' : 'normal',
            Sound: 'default',
          },
          GCMMessage: {
            Title: notification.title,
            Body: notification.body,
            Data: notification.data,
            Priority: priority === 'urgent' ? 'high' : 'normal',
            Sound: 'default',
          },
        },
      },
    });

    const result = await pinpointClient.send(command);
    return result.MessageResponse?.RequestId || 'unknown';
  }

  /**
   * Send SMS via Pinpoint
   */
  private async sendSMS(phone: string, message: string): Promise<string> {
    const command = new SendMessagesCommand({
      ApplicationId: PINPOINT_APP_ID,
      MessageRequest: {
        Addresses: {
          [phone]: {
            ChannelType: 'SMS',
          },
        },
        MessageConfiguration: {
          SMSMessage: {
            Body: message,
            MessageType: 'TRANSACTIONAL',
          },
        },
      },
    });

    const result = await pinpointClient.send(command);
    return result.MessageResponse?.RequestId || 'unknown';
  }

  /**
   * Send email via SES
   */
  private async sendEmail(
    email: string,
    content: { subject: string; htmlBody: string; textBody: string }
  ): Promise<string> {
    const command = new SendEmailCommand({
      Source: SES_FROM_EMAIL,
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Subject: {
          Data: content.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: content.htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: content.textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const result = await sesClient.send(command);
    return result.MessageId || 'unknown';
  }

  /**
   * Create notification log entry
   */
  private async createNotificationLog(
    notificationId: string,
    request: NotificationRequest,
    deliveryStatus: NotificationLog['deliveryStatus'],
    reason?: string
  ): Promise<NotificationLog> {
    const now = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60; // 90 days

    const log: NotificationLog = {
      notificationId,
      recipientId: request.recipientId,
      recipientType: request.recipientType,
      type: request.type,
      channels: request.channels,
      deliveryStatus,
      priority: request.priority,
      data: request.data,
      createdAt: now,
      expiresAt,
    };

    await dynamoClient.send(
      new PutItemCommand({
        TableName: NOTIFICATION_LOG_TABLE,
        Item: marshall(log),
      })
    );

    logger.info('Created notification log', { notificationId, reason });
    return log;
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(
    userId: string,
    limit: number = 50,
    nextToken?: string
  ): Promise<{ items: NotificationLog[]; nextToken?: string }> {
    const command = new QueryCommand({
      TableName: NOTIFICATION_LOG_TABLE,
      IndexName: 'recipientId-createdAt-index',
      KeyConditionExpression: 'recipientId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': userId,
      }),
      Limit: limit,
      ScanIndexForward: false, // Most recent first
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    const result = await dynamoClient.send(command);
    const items = result.Items?.map((item) => unmarshall(item) as NotificationLog) || [];

    return {
      items,
      nextToken: result.LastEvaluatedKey
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : undefined,
    };
  }
}

export const notificationService = new NotificationService();
