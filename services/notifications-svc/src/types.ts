import { NotificationType, NotificationChannel, NotificationPriority, UserRole } from '@roadcall/types';

export interface NotificationTemplate {
  push?: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
  sms?: string;
  email?: {
    subject: string;
    htmlBody: string;
    textBody: string;
  };
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    push: { enabled: boolean };
    sms: { enabled: boolean };
    email: { enabled: boolean };
  };
  mutedTypes: NotificationType[];
  quietHours?: {
    start: string; // HH:mm
    end: string;
    timezone: string;
  };
  updatedAt: string;
}

export interface UserContact {
  userId: string;
  phone: string;
  email?: string;
  deviceTokens: string[];
}

export interface NotificationLog {
  notificationId: string;
  recipientId: string;
  recipientType: UserRole;
  type: NotificationType;
  channels: NotificationChannel[];
  deliveryStatus: {
    [channel in NotificationChannel]?: {
      status: 'sent' | 'failed' | 'pending';
      timestamp: string;
      error?: string;
      messageId?: string;
    };
  };
  priority: NotificationPriority;
  data: Record<string, unknown>;
  createdAt: string;
  expiresAt: number; // TTL for DynamoDB
}

export interface RateLimitEntry {
  userId: string;
  channel: NotificationChannel;
  count: number;
  windowStart: number;
  expiresAt: number; // TTL
}

export interface QueuedNotification {
  notificationId: string;
  type: NotificationType;
  recipientId: string;
  recipientType: UserRole;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  data: Record<string, unknown>;
  templateId?: string;
  scheduledFor?: string;
  retryCount: number;
}
