import { renderTemplate, getTemplate, notificationTemplates } from '../templates';
import { NotificationType } from '@roadcall/types';

describe('Template Rendering', () => {
  describe('renderTemplate', () => {
    it('should replace single variable', () => {
      const template = 'Hello {{name}}!';
      const data = { name: 'John' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Hello John!');
    });

    it('should replace multiple variables', () => {
      const template = '{{greeting}} {{name}}, you have {{count}} messages';
      const data = { greeting: 'Hello', name: 'Alice', count: 5 };
      const result = renderTemplate(template, data);
      expect(result).toBe('Hello Alice, you have 5 messages');
    });

    it('should replace same variable multiple times', () => {
      const template = '{{name}} said: "{{name}} is here"';
      const data = { name: 'Bob' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Bob said: "Bob is here"');
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello {{name}}, your score is {{score}}';
      const data = { name: 'Charlie' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Hello Charlie, your score is {{score}}');
    });

    it('should handle empty data object', () => {
      const template = 'Static text without variables';
      const data = {};
      const result = renderTemplate(template, data);
      expect(result).toBe('Static text without variables');
    });

    it('should convert non-string values to strings', () => {
      const template = 'Count: {{count}}, Price: ${{price}}, Active: {{active}}';
      const data = { count: 42, price: 19.99, active: true };
      const result = renderTemplate(template, data);
      expect(result).toBe('Count: 42, Price: $19.99, Active: true');
    });

    it('should handle special characters in values', () => {
      const template = 'Message: {{message}}';
      const data = { message: 'Hello & goodbye! <test>' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Message: Hello & goodbye! <test>');
    });

    it('should handle nested object values', () => {
      const template = 'User: {{user}}';
      const data = { user: { name: 'John', age: 30 } };
      const result = renderTemplate(template, data);
      expect(result).toBe('User: [object Object]');
    });
  });

  describe('getTemplate', () => {
    it('should return template for offer_received', () => {
      const template = getTemplate('offer_received');
      expect(template).toBeDefined();
      expect(template.push).toBeDefined();
      expect(template.sms).toBeDefined();
      expect(template.email).toBeDefined();
    });

    it('should return template for all notification types', () => {
      const types: NotificationType[] = [
        'offer_received',
        'offer_accepted',
        'vendor_en_route',
        'vendor_arrived',
        'work_started',
        'work_completed',
        'payment_approved',
        'incident_cancelled',
        'otp_code',
        'system_alert',
      ];

      types.forEach((type) => {
        const template = getTemplate(type);
        expect(template).toBeDefined();
      });
    });
  });

  describe('Notification Templates', () => {
    describe('offer_received template', () => {
      it('should render push notification correctly', () => {
        const template = notificationTemplates.offer_received;
        const data = {
          incidentType: 'tire',
          distance: '15',
          payout: '150',
          incidentId: 'inc-123',
          offerId: 'offer-456',
        };

        const title = renderTemplate(template.push!.title, data);
        const body = renderTemplate(template.push!.body, data);

        expect(title).toBe('New Job Offer');
        expect(body).toBe('New tire job 15 miles away. Payout: $150');
      });

      it('should render SMS correctly', () => {
        const template = notificationTemplates.offer_received;
        const data = {
          incidentType: 'engine',
          distance: '25',
          payout: '200',
          acceptUrl: 'https://app.example.com/offers/123',
        };

        const sms = renderTemplate(template.sms!, data);
        expect(sms).toBe('New engine job 25mi away. Payout $200. Accept: https://app.example.com/offers/123');
      });

      it('should render email correctly', () => {
        const template = notificationTemplates.offer_received;
        const data = {
          incidentType: 'tow',
          distance: '10',
          payout: '300',
          acceptUrl: 'https://app.example.com/offers/789',
        };

        const subject = renderTemplate(template.email!.subject, data);
        const htmlBody = renderTemplate(template.email!.htmlBody, data);
        const textBody = renderTemplate(template.email!.textBody, data);

        expect(subject).toBe('New Job Offer - tow');
        expect(htmlBody).toContain('tow');
        expect(htmlBody).toContain('10 miles');
        expect(htmlBody).toContain('$300');
        expect(textBody).toContain('tow');
        expect(textBody).toContain('10 miles');
      });
    });

    describe('offer_accepted template', () => {
      it('should render push notification with vendor name and ETA', () => {
        const template = notificationTemplates.offer_accepted;
        const data = {
          vendorName: 'Quick Tow Service',
          incidentId: 'inc-123',
          vendorId: 'vendor-456',
        };

        const title = renderTemplate(template.push!.title, data);
        const body = renderTemplate(template.push!.body, data);

        expect(title).toBe('Vendor Assigned');
        expect(body).toBe('Quick Tow Service has accepted your request and is on the way!');
      });

      it('should render SMS with tracking URL', () => {
        const template = notificationTemplates.offer_accepted;
        const data = {
          vendorName: 'ABC Tire Shop',
          trackingUrl: 'https://app.example.com/track/123',
        };

        const sms = renderTemplate(template.sms!, data);
        expect(sms).toBe('ABC Tire Shop is on the way! Track them here: https://app.example.com/track/123');
      });
    });

    describe('vendor_en_route template', () => {
      it('should render with ETA information', () => {
        const template = notificationTemplates.vendor_en_route;
        const data = {
          vendorName: 'Fast Response Towing',
          eta: '15',
          incidentId: 'inc-789',
          sessionId: 'session-123',
        };

        const body = renderTemplate(template.push!.body, data);
        expect(body).toBe('Fast Response Towing is heading to your location. ETA: 15 minutes');
      });
    });

    describe('payment_approved template', () => {
      it('should render payment amount correctly', () => {
        const template = notificationTemplates.payment_approved;
        const data = {
          amount: '250.00',
          paymentId: 'pay-123',
          incidentId: 'inc-456',
        };

        const title = renderTemplate(template.push!.title, data);
        const body = renderTemplate(template.push!.body, data);

        expect(title).toBe('Payment Approved');
        expect(body).toBe('Your payment of $250.00 has been approved and is being processed');
      });

      it('should render email with payment details', () => {
        const template = notificationTemplates.payment_approved;
        const data = {
          amount: '175.50',
          incidentId: 'inc-789',
          date: '2024-01-15',
        };

        const subject = renderTemplate(template.email!.subject, data);
        const htmlBody = renderTemplate(template.email!.htmlBody, data);

        expect(subject).toBe('Payment Approved - $175.50');
        expect(htmlBody).toContain('$175.50');
        expect(htmlBody).toContain('inc-789');
        expect(htmlBody).toContain('2024-01-15');
      });
    });

    describe('otp_code template', () => {
      it('should render OTP code in SMS', () => {
        const template = notificationTemplates.otp_code;
        const data = { code: '123456' };

        const sms = renderTemplate(template.sms!, data);
        expect(sms).toBe('Your verification code is: 123456. Valid for 5 minutes. Do not share this code.');
      });

      it('should render OTP code in email', () => {
        const template = notificationTemplates.otp_code;
        const data = { code: '654321' };

        const subject = renderTemplate(template.email!.subject, data);
        const htmlBody = renderTemplate(template.email!.htmlBody, data);
        const textBody = renderTemplate(template.email!.textBody, data);

        expect(subject).toBe('Your Verification Code');
        expect(htmlBody).toContain('654321');
        expect(textBody).toBe('Your verification code is: 654321. Valid for 5 minutes.');
      });
    });

    describe('work_completed template', () => {
      it('should include rating URL', () => {
        const template = notificationTemplates.work_completed;
        const data = {
          vendorName: 'Pro Mechanics',
          incidentId: 'inc-999',
          ratingUrl: 'https://app.example.com/rate/999',
        };

        const body = renderTemplate(template.push!.body, data);
        const sms = renderTemplate(template.sms!, data);

        expect(body).toBe('Pro Mechanics has completed the work. Please review and rate.');
        expect(sms).toContain('Pro Mechanics');
        expect(sms).toContain('https://app.example.com/rate/999');
      });
    });

    describe('system_alert template', () => {
      it('should render custom alert message', () => {
        const template = notificationTemplates.system_alert;
        const data = {
          message: 'System maintenance scheduled for tonight',
          alertType: 'maintenance',
        };

        const title = renderTemplate(template.push!.title, data);
        const body = renderTemplate(template.push!.body, data);
        const subject = renderTemplate(template.email!.subject, data);

        expect(title).toBe('System Alert');
        expect(body).toBe('System maintenance scheduled for tonight');
        expect(subject).toBe('System Alert - maintenance');
      });
    });
  });

  describe('Template Structure Validation', () => {
    it('should have all required notification types', () => {
      const requiredTypes: NotificationType[] = [
        'offer_received',
        'offer_accepted',
        'vendor_en_route',
        'vendor_arrived',
        'work_started',
        'work_completed',
        'payment_approved',
        'incident_cancelled',
        'otp_code',
        'system_alert',
      ];

      requiredTypes.forEach((type) => {
        expect(notificationTemplates[type]).toBeDefined();
      });
    });

    it('should have at least one channel for each template', () => {
      Object.entries(notificationTemplates).forEach(([, template]) => {
        const hasChannel = template.push || template.sms || template.email;
        expect(hasChannel).toBeTruthy();
      });
    });

    it('should have valid push notification structure when defined', () => {
      Object.entries(notificationTemplates).forEach(([, template]) => {
        if (template.push) {
          expect(template.push.title).toBeDefined();
          expect(template.push.body).toBeDefined();
          expect(typeof template.push.title).toBe('string');
          expect(typeof template.push.body).toBe('string');
        }
      });
    });

    it('should have valid email structure when defined', () => {
      Object.entries(notificationTemplates).forEach(([, template]) => {
        if (template.email) {
          expect(template.email.subject).toBeDefined();
          expect(template.email.htmlBody).toBeDefined();
          expect(template.email.textBody).toBeDefined();
          expect(typeof template.email.subject).toBe('string');
          expect(typeof template.email.htmlBody).toBe('string');
          expect(typeof template.email.textBody).toBe('string');
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined data values', () => {
      const template = 'Value: {{value}}';
      const data = { value: undefined };
      const result = renderTemplate(template, data);
      expect(result).toBe('Value: undefined');
    });

    it('should handle null data values', () => {
      const template = 'Value: {{value}}';
      const data = { value: null };
      const result = renderTemplate(template, data);
      expect(result).toBe('Value: null');
    });

    it('should handle empty string values', () => {
      const template = 'Value: "{{value}}"';
      const data = { value: '' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Value: ""');
    });

    it('should handle zero values', () => {
      const template = 'Count: {{count}}';
      const data = { count: 0 };
      const result = renderTemplate(template, data);
      expect(result).toBe('Count: 0');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(1000);
      const template = 'Data: {{data}}';
      const data = { data: longString };
      const result = renderTemplate(template, data);
      expect(result).toBe(`Data: ${longString}`);
    });

    it('should handle templates with no variables', () => {
      const template = 'This is a static message';
      const data = { unused: 'value' };
      const result = renderTemplate(template, data);
      expect(result).toBe('This is a static message');
    });

    it('should handle malformed variable syntax', () => {
      const template = 'Value: {value} or {{value or {{value}}';
      const data = { value: 'test' };
      const result = renderTemplate(template, data);
      expect(result).toBe('Value: {value} or {{value or test');
    });
  });
});
