import { SQSEvent, SQSRecord } from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { notificationService } from '../notification-service';
import { QueuedNotification } from '../types';

/**
 * Lambda handler for processing notifications from SQS queue
 * Provides buffering and priority handling
 */
export async function handler(event: SQSEvent): Promise<void> {
  logger.info('Processing SQS batch', { recordCount: event.Records.length });

  // Sort by priority (urgent first)
  const sortedRecords = event.Records.sort((a, b) => {
    const priorityA = getPriority(a);
    const priorityB = getPriority(b);
    return priorityOrder[priorityB] - priorityOrder[priorityA];
  });

  // Process notifications sequentially to respect priority
  for (const record of sortedRecords) {
    try {
      await processRecord(record);
    } catch (error) {
      logger.error('Failed to process SQS record', error instanceof Error ? error : new Error(String(error)), { recordMessageId: record.messageId });
      // Let Lambda handle retry via SQS
      throw error;
    }
  }
}

const priorityOrder: Record<string, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function getPriority(record: SQSRecord): string {
  try {
    const notification: QueuedNotification = JSON.parse(record.body);
    return notification.priority || 'normal';
  } catch {
    return 'normal';
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const notification: QueuedNotification = JSON.parse(record.body);

  logger.info('Processing queued notification', {
    notificationId: notification.notificationId,
    type: notification.type,
    priority: notification.priority,
    retryCount: notification.retryCount,
  });

  // Check if scheduled for future
  if (notification.scheduledFor) {
    const scheduledTime = new Date(notification.scheduledFor).getTime();
    const now = Date.now();

    if (scheduledTime > now) {
      logger.info('Notification scheduled for future, skipping', {
        notificationId: notification.notificationId,
        scheduledFor: notification.scheduledFor,
      });
      // Re-queue with delay (simplified - in production use SQS delay)
      throw new Error('Scheduled for future');
    }
  }

  // Send notification
  await notificationService.sendNotification({
    type: notification.type,
    recipientId: notification.recipientId,
    recipientType: notification.recipientType,
    channels: notification.channels,
    priority: notification.priority,
    data: notification.data,
    templateId: notification.templateId,
  });

  logger.info('Successfully processed queued notification', {
    notificationId: notification.notificationId,
  });
}
