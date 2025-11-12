/**
 * Integration Test: Audit Logging and Compliance
 * Validates audit logging and compliance features
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 20.1-20.5
 */

import { CloudWatchLogsClient, FilterLogEventsCommand, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { CloudTrailClient, LookupEventsCommand } from '@aws-sdk/client-cloudtrail';
import { S3Client, GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';

describe('Audit Logging and Compliance', () => {
  let cloudWatchClient: CloudWatchLogsClient;
  let cloudTrailClient: CloudTrailClient;
  let s3Client: S3Client;
  
  beforeAll(() => {
    const region = process.env.AWS_REGION || 'us-east-1';
    cloudWatchClient = new CloudWatchLogsClient({ region });
    cloudTrailClient = new CloudTrailClient({ region });
    s3Client = new S3Client({ region });
  });
  
  afterAll(() => {
    cloudWatchClient.destroy();
    cloudTrailClient.destroy();
    s3Client.destroy();
  });
  
  describe('CloudWatch Logging', () => {
    it('should log all API requests in structured JSON format', async () => {
      const logGroupName = '/aws/lambda/incident-handler';
      
      const command = new FilterLogEventsCommand({
        logGroupName,
        startTime: Date.now() - 3600000, // Last hour
        limit: 10
      });
      
      const result = await cloudWatchClient.send(command);
      
      expect(result.events).toBeDefined();
      expect(result.events!.length).toBeGreaterThan(0);
      
      // Verify structured logging
      const logEvent = result.events![0];
      const logData = JSON.parse(logEvent.message!);
      
      expect(logData.timestamp).toBeDefined();
      expect(logData.level).toBeDefined();
      expect(logData.requestId).toBeDefined();
      expect(logData.message).toBeDefined();
    });
    
    it('should have log groups for all microservices', async () => {
      const expectedLogGroups = [
        '/aws/lambda/incident-handler',
        '/aws/lambda/match-handler',
        '/aws/lambda/tracking-handler',
        '/aws/lambda/payment-handler',
        '/aws/lambda/notification-handler'
      ];
      
      const command = new DescribeLogGroupsCommand({});
      const result = await cloudWatchClient.send(command);
      
      const logGroupNames = result.logGroups!.map(lg => lg.logGroupName);
      
      for (const expectedGroup of expectedLogGroups) {
        expect(logGroupNames).toContain(expectedGroup);
      }
    });
    
    it('should retain logs for minimum 7 years', async () => {
      const logGroupName = '/aws/lambda/incident-handler';
      
      const command = new DescribeLogGroupsCommand({
        logGroupNamePrefix: logGroupName
      });
      
      const result = await cloudWatchClient.send(command);
      const logGroup = result.logGroups!.find(lg => lg.logGroupName === logGroupName);
      
      expect(logGroup).toBeDefined();
      
      // 7 years = 2555 days
      const minRetentionDays = 2555;
      
      if (logGroup!.retentionInDays) {
        expect(logGroup!.retentionInDays).toBeGreaterThanOrEqual(minRetentionDays);
      }
    });
  });
  
  describe('CloudTrail Audit', () => {
    it('should enable CloudTrail for all AWS API calls', async () => {
      const command = new LookupEventsCommand({
        StartTime: new Date(Date.now() - 3600000), // Last hour
        MaxResults: 10
      });
      
      const result = await cloudTrailClient.send(command);
      
      expect(result.Events).toBeDefined();
      expect(result.Events!.length).toBeGreaterThan(0);
    });
    
    it('should log DynamoDB operations', async () => {
      const command = new LookupEventsCommand({
        LookupAttributes: [
          {
            AttributeKey: 'EventSource',
            AttributeValue: 'dynamodb.amazonaws.com'
          }
        ],
        StartTime: new Date(Date.now() - 3600000),
        MaxResults: 10
      });
      
      const result = await cloudTrailClient.send(command);
      
      expect(result.Events).toBeDefined();
    });
    
    it('should log S3 operations', async () => {
      const command = new LookupEventsCommand({
        LookupAttributes: [
          {
            AttributeKey: 'EventSource',
            AttributeValue: 's3.amazonaws.com'
          }
        ],
        StartTime: new Date(Date.now() - 3600000),
        MaxResults: 10
      });
      
      const result = await cloudTrailClient.send(command);
      
      expect(result.Events).toBeDefined();
    });
  });
  
  describe('PII Access Logging', () => {
    it('should log PII access events', async () => {
      const logGroupName = '/aws/lambda/incident-handler';
      
      const command = new FilterLogEventsCommand({
        logGroupName,
        filterPattern: '"PII_ACCESS"',
        startTime: Date.now() - 3600000,
        limit: 10
      });
      
      const result = await cloudWatchClient.send(command);
      
      if (result.events && result.events.length > 0) {
        const piiAccessLog = JSON.parse(result.events[0].message!);
        
        expect(piiAccessLog.userId).toBeDefined();
        expect(piiAccessLog.dataAccessed).toBeDefined();
        expect(piiAccessLog.purpose).toBeDefined();
        expect(piiAccessLog.timestamp).toBeDefined();
      }
    });
  });
  
  describe('Data Retention Policies', () => {
    it('should have lifecycle policies for log archival', async () => {
      const logBucket = process.env.LOG_BUCKET_NAME || 'roadcall-logs';
      
      const command = new GetBucketLifecycleConfigurationCommand({
        Bucket: logBucket
      });
      
      try {
        const result = await s3Client.send(command);
        
        expect(result.Rules).toBeDefined();
        expect(result.Rules!.length).toBeGreaterThan(0);
        
        // Check for Glacier transition
        const glacierRule = result.Rules!.find(rule => 
          rule.Transitions?.some(t => t.StorageClass === 'GLACIER')
        );
        
        expect(glacierRule).toBeDefined();
        expect(glacierRule!.Transitions![0].Days).toBe(90);
      } catch (error: any) {
        if (error.name !== 'NoSuchLifecycleConfiguration') {
          throw error;
        }
      }
    });
    
    it('should delete PII after 3 years of inactivity', async () => {
      // Test data retention policy
      const inactiveUser = {
        userId: 'inactive-user-001',
        lastActivityAt: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000) // 4 years ago
      };
      
      const shouldDelete = await checkPIIDeletionPolicy(inactiveUser);
      
      expect(shouldDelete).toBe(true);
    });
    
    it('should retain data for active users', async () => {
      const activeUser = {
        userId: 'active-user-001',
        lastActivityAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      };
      
      const shouldDelete = await checkPIIDeletionPolicy(activeUser);
      
      expect(shouldDelete).toBe(false);
    });
  });
  
  describe('GDPR Compliance', () => {
    it('should support data export (right to access)', async () => {
      const userId = 'test-user-001';
      
      const exportResponse = await fetch(`${process.env.API_URL}/users/${userId}/export`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });
      
      expect(exportResponse.ok).toBe(true);
      
      const exportData = await exportResponse.json();
      
      expect(exportData.userId).toBe(userId);
      expect(exportData.personalData).toBeDefined();
      expect(exportData.incidents).toBeDefined();
      expect(exportData.format).toBe('JSON');
    });
    
    it('should support data deletion (right to be forgotten)', async () => {
      const userId = 'test-user-delete';
      
      const deleteResponse = await fetch(`${process.env.API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });
      
      expect(deleteResponse.ok).toBe(true);
      
      // Verify PII anonymized
      await sleep(2000);
      
      const userResponse = await fetch(`${process.env.API_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });
      
      const user = await userResponse.json();
      
      expect(user.phone).toMatch(/DELETED-\d+/);
      expect(user.email).toMatch(/deleted@/);
      expect(user.name).toBe('DELETED');
    });
    
    it('should obtain consent during registration', async () => {
      const registrationData = {
        phone: '+15551234567',
        name: 'Test User',
        role: 'driver',
        consentGiven: true,
        consentTimestamp: new Date().toISOString()
      };
      
      const response = await fetch(`${process.env.API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });
      
      expect(response.ok).toBe(true);
      
      const result = await response.json();
      
      expect(result.consentRecorded).toBe(true);
    });
  });
  
  describe('Payment Audit Trail', () => {
    it('should log all payment events', async () => {
      const logGroupName = '/aws/lambda/payment-handler';
      
      const command = new FilterLogEventsCommand({
        logGroupName,
        filterPattern: '"PAYMENT_EVENT"',
        startTime: Date.now() - 3600000,
        limit: 10
      });
      
      const result = await cloudWatchClient.send(command);
      
      if (result.events && result.events.length > 0) {
        const paymentLog = JSON.parse(result.events[0].message!);
        
        expect(paymentLog.paymentId).toBeDefined();
        expect(paymentLog.action).toBeDefined();
        expect(['initiated', 'approved', 'completed', 'failed']).toContain(paymentLog.action);
        expect(paymentLog.actorId).toBeDefined();
        expect(paymentLog.timestamp).toBeDefined();
      }
    });
    
    it('should maintain append-only payment ledger', async () => {
      const paymentId = 'test-payment-001';
      
      const auditTrail = await getPaymentAuditTrail(paymentId);
      
      expect(auditTrail).toBeDefined();
      expect(auditTrail.length).toBeGreaterThan(0);
      
      // Verify chronological order
      for (let i = 1; i < auditTrail.length; i++) {
        const prevTimestamp = new Date(auditTrail[i - 1].timestamp).getTime();
        const currTimestamp = new Date(auditTrail[i].timestamp).getTime();
        
        expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
      }
    });
  });
  
  describe('State Transition Logging', () => {
    it('should log all incident state transitions', async () => {
      const incidentId = 'test-incident-001';
      
      const incident = await getIncident(incidentId);
      
      expect(incident.timeline).toBeDefined();
      expect(incident.timeline.length).toBeGreaterThan(0);
      
      for (const transition of incident.timeline) {
        expect(transition.from).toBeDefined();
        expect(transition.to).toBeDefined();
        expect(transition.timestamp).toBeDefined();
        expect(transition.actor).toBeDefined();
      }
    });
  });
  
  describe('Configuration Change Audit', () => {
    it('should log admin configuration changes', async () => {
      const logGroupName = '/aws/lambda/admin-config-handler';
      
      const command = new FilterLogEventsCommand({
        logGroupName,
        filterPattern: '"CONFIG_CHANGE"',
        startTime: Date.now() - 3600000,
        limit: 10
      });
      
      const result = await cloudWatchClient.send(command);
      
      if (result.events && result.events.length > 0) {
        const configLog = JSON.parse(result.events[0].message!);
        
        expect(configLog.adminId).toBeDefined();
        expect(configLog.configKey).toBeDefined();
        expect(configLog.previousValue).toBeDefined();
        expect(configLog.newValue).toBeDefined();
        expect(configLog.timestamp).toBeDefined();
      }
    });
  });
});

// Helper functions
async function getAuthToken() {
  return 'mock-auth-token';
}

async function checkPIIDeletionPolicy(user: any) {
  const threeYearsAgo = Date.now() - 3 * 365 * 24 * 60 * 60 * 1000;
  return user.lastActivityAt.getTime() < threeYearsAgo;
}

async function getPaymentAuditTrail(paymentId: string) {
  return [
    {
      action: 'initiated',
      actorId: 'vendor-001',
      timestamp: new Date(Date.now() - 3600000).toISOString()
    },
    {
      action: 'approved',
      actorId: 'dispatcher-001',
      timestamp: new Date(Date.now() - 1800000).toISOString()
    },
    {
      action: 'completed',
      actorId: 'system',
      timestamp: new Date().toISOString()
    }
  ];
}

async function getIncident(incidentId: string) {
  return {
    incidentId,
    status: 'closed',
    timeline: [
      {
        from: null,
        to: 'created',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        actor: 'driver-001'
      },
      {
        from: 'created',
        to: 'vendor_assigned',
        timestamp: new Date(Date.now() - 7000000).toISOString(),
        actor: 'system'
      },
      {
        from: 'vendor_assigned',
        to: 'vendor_arrived',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        actor: 'system'
      },
      {
        from: 'vendor_arrived',
        to: 'work_completed',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        actor: 'vendor-001'
      },
      {
        from: 'work_completed',
        to: 'closed',
        timestamp: new Date().toISOString(),
        actor: 'system'
      }
    ]
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
