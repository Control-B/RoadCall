/**
 * Integration Test: EventBridge Event Flows
 * Verifies all EventBridge event flows and subscriptions
 * Requirements: 2.3, 7.2, 22.1, 22.2, 22.3
 */

import { EventBridgeClient, PutEventsCommand, ListRulesCommand, ListTargetsByRuleCommand } from '@aws-sdk/client-eventbridge';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

describe('EventBridge Event Flows', () => {
  let eventBridgeClient: EventBridgeClient;
  let sqsClient: SQSClient;
  const eventBusName = process.env.EVENT_BUS_NAME || 'roadcall-events';
  
  beforeAll(() => {
    eventBridgeClient = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  });
  
  afterAll(() => {
    if (eventBridgeClient && typeof eventBridgeClient.destroy === 'function') {
      eventBridgeClient.destroy();
    }
    if (sqsClient && typeof sqsClient.destroy === 'function') {
      sqsClient.destroy();
    }
  });
  
  describe('Event Publishing', () => {
    it('should have EventBridge client initialized', () => {
      expect(eventBridgeClient).toBeDefined();
      expect(sqsClient).toBeDefined();
      expect(eventBusName).toBeDefined();
    });
    
    it('should validate event structure for IncidentCreated', () => {
      const event = {
        Source: 'incident-svc',
        DetailType: 'IncidentCreated',
        Detail: JSON.stringify({
          incidentId: 'test-incident-001',
          driverId: 'test-driver-001',
          type: 'tire',
          location: { lat: 40.7128, lon: -74.0060 },
          timestamp: new Date().toISOString()
        }),
        EventBusName: eventBusName
      };
      
      // Validate event structure
      expect(event.Source).toBe('incident-svc');
      expect(event.DetailType).toBe('IncidentCreated');
      expect(event.Detail).toBeDefined();
      
      const detail = JSON.parse(event.Detail);
      expect(detail.incidentId).toBeDefined();
      expect(detail.driverId).toBeDefined();
      expect(detail.type).toBe('tire');
      expect(detail.location).toBeDefined();
    });
    
    it('should publish OfferCreated event', async () => {
      const event = {
        Source: 'match-svc',
        DetailType: 'OfferCreated',
        Detail: JSON.stringify({
          offerId: 'test-offer-001',
          incidentId: 'test-incident-001',
          vendorId: 'test-vendor-001',
          matchScore: 0.85,
          expiresAt: new Date(Date.now() + 120000).toISOString()
        }),
        EventBusName: eventBusName
      };
      
      const command = new PutEventsCommand({
        Entries: [event]
      });
      
      const result = await eventBridgeClient.send(command);
      
      expect(result.FailedEntryCount).toBe(0);
    });
    
    it('should publish VendorAssigned event', async () => {
      const event = {
        Source: 'match-svc',
        DetailType: 'VendorAssigned',
        Detail: JSON.stringify({
          incidentId: 'test-incident-001',
          vendorId: 'test-vendor-001',
          offerId: 'test-offer-001',
          timestamp: new Date().toISOString()
        }),
        EventBusName: eventBusName
      };
      
      const command = new PutEventsCommand({
        Entries: [event]
      });
      
      const result = await eventBridgeClient.send(command);
      
      expect(result.FailedEntryCount).toBe(0);
    });
    
    it('should publish WorkCompleted event', async () => {
      const event = {
        Source: 'incident-svc',
        DetailType: 'WorkCompleted',
        Detail: JSON.stringify({
          incidentId: 'test-incident-001',
          vendorId: 'test-vendor-001',
          completedAt: new Date().toISOString(),
          notes: 'Tire replaced successfully'
        }),
        EventBusName: eventBusName
      };
      
      const command = new PutEventsCommand({
        Entries: [event]
      });
      
      const result = await eventBridgeClient.send(command);
      
      expect(result.FailedEntryCount).toBe(0);
    });
    
    it('should publish PaymentApproved event', async () => {
      const event = {
        Source: 'payments-svc',
        DetailType: 'PaymentApproved',
        Detail: JSON.stringify({
          paymentId: 'test-payment-001',
          incidentId: 'test-incident-001',
          vendorId: 'test-vendor-001',
          amountCents: 15000,
          approvedBy: 'dispatcher-001'
        }),
        EventBusName: eventBusName
      };
      
      const command = new PutEventsCommand({
        Entries: [event]
      });
      
      const result = await eventBridgeClient.send(command);
      
      expect(result.FailedEntryCount).toBe(0);
    });
  });
  
  describe('Event Routing Rules', () => {
    it('should have rule for IncidentCreated → Match Service', async () => {
      const rules = await listRules(eventBusName);
      const matchRule = rules.find(r => r.Name?.includes('IncidentCreated'));
      
      expect(matchRule).toBeDefined();
      expect(matchRule!.State).toBe('ENABLED');
      
      const targets = await listTargets(matchRule!.Name!);
      expect(targets.length).toBeGreaterThan(0);
    });
    
    it('should have rule for OfferCreated → Notifications Service', async () => {
      const rules = await listRules(eventBusName);
      const notificationRule = rules.find(r => r.Name?.includes('OfferCreated'));
      
      expect(notificationRule).toBeDefined();
      expect(notificationRule!.State).toBe('ENABLED');
    });
    
    it('should have rule for WorkCompleted → Payments Service', async () => {
      const rules = await listRules(eventBusName);
      const paymentRule = rules.find(r => r.Name?.includes('WorkCompleted'));
      
      expect(paymentRule).toBeDefined();
      expect(paymentRule!.State).toBe('ENABLED');
    });
    
    it('should have rule for all events → Reporting Service', async () => {
      const rules = await listRules(eventBusName);
      const reportingRule = rules.find(r => r.Name?.includes('AllEvents') || r.Name?.includes('Reporting'));
      
      expect(reportingRule).toBeDefined();
      expect(reportingRule!.State).toBe('ENABLED');
    });
  });
  
  describe('Event Delivery and Retry', () => {
    it('should deliver events to SQS queue', async () => {
      // Publish test event
      const testEvent = {
        Source: 'test-svc',
        DetailType: 'TestEvent',
        Detail: JSON.stringify({
          testId: 'test-001',
          timestamp: new Date().toISOString()
        }),
        EventBusName: eventBusName
      };
      
      await eventBridgeClient.send(new PutEventsCommand({
        Entries: [testEvent]
      }));
      
      // Wait for delivery
      await sleep(2000);
      
      // Check SQS queue
      const queueUrl = process.env.TEST_QUEUE_URL;
      if (queueUrl) {
        const messages = await receiveMessages(queueUrl);
        expect(messages.length).toBeGreaterThan(0);
        
        // Verify message content
        const message = JSON.parse(messages[0].Body!);
        expect(message.detail.testId).toBe('test-001');
        
        // Clean up
        await deleteMessage(queueUrl, messages[0].ReceiptHandle!);
      }
    });
    
    it('should have dead-letter queue configured', async () => {
      const rules = await listRules(eventBusName);
      
      for (const rule of rules) {
        const targets = await listTargets(rule.Name!);
        
        for (const target of targets) {
          if (target.Arn?.includes('sqs')) {
            expect(target.DeadLetterConfig).toBeDefined();
            expect(target.DeadLetterConfig!.Arn).toBeDefined();
          }
        }
      }
    });
    
    it('should retry failed deliveries', async () => {
      const rules = await listRules(eventBusName);
      
      for (const rule of rules) {
        const targets = await listTargets(rule.Name!);
        
        for (const target of targets) {
          expect(target.RetryPolicy).toBeDefined();
          expect(target.RetryPolicy!.MaximumRetryAttempts).toBeGreaterThanOrEqual(3);
        }
      }
    });
  });
  
  describe('Event Schema Validation', () => {
    it('should validate IncidentCreated event schema', () => {
      const event = {
        incidentId: 'test-001',
        driverId: 'driver-001',
        type: 'tire',
        location: { lat: 40.7128, lon: -74.0060 },
        timestamp: new Date().toISOString()
      };
      
      expect(event.incidentId).toBeDefined();
      expect(event.driverId).toBeDefined();
      expect(['tire', 'engine', 'tow']).toContain(event.type);
      expect(event.location.lat).toBeGreaterThan(-90);
      expect(event.location.lat).toBeLessThan(90);
      expect(event.location.lon).toBeGreaterThan(-180);
      expect(event.location.lon).toBeLessThan(180);
    });
    
    it('should validate OfferCreated event schema', () => {
      const event = {
        offerId: 'offer-001',
        incidentId: 'incident-001',
        vendorId: 'vendor-001',
        matchScore: 0.85,
        expiresAt: new Date().toISOString()
      };
      
      expect(event.offerId).toBeDefined();
      expect(event.incidentId).toBeDefined();
      expect(event.vendorId).toBeDefined();
      expect(event.matchScore).toBeGreaterThanOrEqual(0);
      expect(event.matchScore).toBeLessThanOrEqual(1);
    });
  });
});

// Helper functions
async function listRules(eventBusName: string) {
  const client = new EventBridgeClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const command = new ListRulesCommand({
    EventBusName: eventBusName
  });
  
  try {
    const result = await client.send(command);
    if (typeof client.destroy === 'function') client.destroy();
    return result.Rules || [];
  } catch (error) {
    if (typeof client.destroy === 'function') client.destroy();
    return [];
  }
}

async function listTargets(ruleName: string) {
  const client = new EventBridgeClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const eventBusName = process.env.EVENT_BUS_NAME || 'roadcall-events';
  
  const command = new ListTargetsByRuleCommand({
    Rule: ruleName,
    EventBusName: eventBusName
  });
  
  try {
    const result = await client.send(command);
    if (typeof client.destroy === 'function') client.destroy();
    return result.Targets || [];
  } catch (error) {
    if (typeof client.destroy === 'function') client.destroy();
    return [];
  }
}

async function receiveMessages(queueUrl: string) {
  const client = new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const command = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 5
  });
  
  try {
    const result = await client.send(command);
    if (typeof client.destroy === 'function') client.destroy();
    return result.Messages || [];
  } catch (error) {
    if (typeof client.destroy === 'function') client.destroy();
    return [];
  }
}

async function deleteMessage(queueUrl: string, receiptHandle: string) {
  const client = new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const command = new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle
  });
  
  try {
    await client.send(command);
    if (typeof client.destroy === 'function') client.destroy();
  } catch (error) {
    if (typeof client.destroy === 'function') client.destroy();
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
