import { NotificationType } from '@roadcall/types';
import { NotificationTemplate } from './types';

export const notificationTemplates: Record<NotificationType, NotificationTemplate> = {
  offer_received: {
    push: {
      title: 'New Job Offer',
      body: 'New {{incidentType}} job {{distance}} miles away. Payout: ${{payout}}',
      data: {
        incidentId: '{{incidentId}}',
        offerId: '{{offerId}}',
        action: 'view_offer',
      },
    },
    sms: 'New {{incidentType}} job {{distance}}mi away. Payout ${{payout}}. Accept: {{acceptUrl}}',
    email: {
      subject: 'New Job Offer - {{incidentType}}',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>New Job Offer</h2><p>You have a new job offer:</p><ul><li><strong>Type:</strong> {{incidentType}}</li><li><strong>Distance:</strong> {{distance}} miles</li><li><strong>Estimated Payout:</strong> ${{payout}}</li></ul><p><a href="{{acceptUrl}}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Offer</a></p><p style="color: #666; font-size: 12px;">This offer expires in 2 minutes.</p></body></html>',
      textBody: 'New {{incidentType}} job {{distance}} miles away. Payout: ${{payout}}. View offer: {{acceptUrl}}',
    },
  },

  offer_accepted: {
    push: {
      title: 'Vendor Assigned',
      body: '{{vendorName}} has accepted your request and is on the way!',
      data: {
        incidentId: '{{incidentId}}',
        vendorId: '{{vendorId}}',
        action: 'track_vendor',
      },
    },
    sms: '{{vendorName}} is on the way! Track them here: {{trackingUrl}}',
    email: {
      subject: 'Help is on the way!',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Vendor Assigned</h2><p>Good news! {{vendorName}} has accepted your request.</p><p><strong>ETA:</strong> {{eta}} minutes</p><p><a href="{{trackingUrl}}" style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Track Vendor</a></p></body></html>',
      textBody: '{{vendorName}} has accepted your request. ETA: {{eta}} minutes. Track: {{trackingUrl}}',
    },
  },

  vendor_en_route: {
    push: {
      title: 'Help is on the way!',
      body: '{{vendorName}} is heading to your location. ETA: {{eta}} minutes',
      data: {
        incidentId: '{{incidentId}}',
        trackingSessionId: '{{sessionId}}',
        action: 'track_vendor',
      },
    },
    sms: '{{vendorName}} is en route. ETA: {{eta}} min. Track: {{trackingUrl}}',
  },

  vendor_arrived: {
    push: {
      title: 'Vendor Arrived',
      body: '{{vendorName}} has arrived at your location',
      data: {
        incidentId: '{{incidentId}}',
        action: 'view_incident',
      },
    },
    sms: '{{vendorName}} has arrived at your location.',
  },

  work_started: {
    push: {
      title: 'Work Started',
      body: '{{vendorName}} has started working on your {{incidentType}} issue',
      data: {
        incidentId: '{{incidentId}}',
        action: 'view_incident',
      },
    },
    sms: '{{vendorName}} has started working on your {{incidentType}} issue.',
  },

  work_completed: {
    push: {
      title: 'Work Completed',
      body: '{{vendorName}} has completed the work. Please review and rate.',
      data: {
        incidentId: '{{incidentId}}',
        action: 'rate_vendor',
      },
    },
    sms: 'Work completed by {{vendorName}}. Please rate your experience: {{ratingUrl}}',
    email: {
      subject: 'Work Completed - Please Rate Your Experience',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Work Completed</h2><p>{{vendorName}} has completed the work on your {{incidentType}} issue.</p><p>Please take a moment to rate your experience:</p><p><a href="{{ratingUrl}}" style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Rate Experience</a></p></body></html>',
      textBody: 'Work completed by {{vendorName}}. Rate your experience: {{ratingUrl}}',
    },
  },

  payment_approved: {
    push: {
      title: 'Payment Approved',
      body: 'Your payment of ${{amount}} has been approved and is being processed',
      data: {
        paymentId: '{{paymentId}}',
        incidentId: '{{incidentId}}',
        action: 'view_payment',
      },
    },
    sms: 'Payment approved: ${{amount}} for incident #{{incidentId}}. Processing now.',
    email: {
      subject: 'Payment Approved - ${{amount}}',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Payment Approved</h2><p>Your payment has been approved:</p><ul><li><strong>Amount:</strong> ${{amount}}</li><li><strong>Incident:</strong> #{{incidentId}}</li><li><strong>Date:</strong> {{date}}</li></ul><p>The payment is being processed and will be deposited to your account within 2-3 business days.</p></body></html>',
      textBody: 'Payment approved: ${{amount}} for incident #{{incidentId}}. Will be deposited in 2-3 business days.',
    },
  },

  incident_cancelled: {
    push: {
      title: 'Incident Cancelled',
      body: 'The incident has been cancelled by the driver',
      data: {
        incidentId: '{{incidentId}}',
        action: 'view_incident',
      },
    },
    sms: 'Incident #{{incidentId}} has been cancelled.',
  },

  otp_code: {
    sms: 'Your verification code is: {{code}}. Valid for 5 minutes. Do not share this code.',
    email: {
      subject: 'Your Verification Code',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>Verification Code</h2><p>Your verification code is:</p><h1 style="background-color: #f0f0f0; padding: 20px; text-align: center; letter-spacing: 5px;">{{code}}</h1><p>This code is valid for 5 minutes.</p><p style="color: #666; font-size: 12px;">If you didn\'t request this code, please ignore this message.</p></body></html>',
      textBody: 'Your verification code is: {{code}}. Valid for 5 minutes.',
    },
  },

  system_alert: {
    push: {
      title: 'System Alert',
      body: '{{message}}',
      data: {
        alertType: '{{alertType}}',
        action: 'view_alert',
      },
    },
    sms: 'System Alert: {{message}}',
    email: {
      subject: 'System Alert - {{alertType}}',
      htmlBody: '<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>System Alert</h2><p>{{message}}</p><p style="color: #666; font-size: 12px;">{{timestamp}}</p></body></html>',
      textBody: 'System Alert: {{message}}',
    },
  },
};

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `{{${key}}}`;
    rendered = rendered.replace(new RegExp(placeholder, 'g'), String(value));
  }
  return rendered;
}

export function getTemplate(type: NotificationType): NotificationTemplate {
  return notificationTemplates[type];
}
