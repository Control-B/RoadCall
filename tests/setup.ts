/**
 * Test Setup and Global Configuration
 */

// Set test environment variables
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(120000);

// Global test utilities
global.testUtils = {
  sleep: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  generateTestId: (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  
  waitFor: async (condition: () => Promise<boolean>, timeout: number = 30000, interval: number = 500) => {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await global.testUtils.sleep(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
};

// Mock AWS SDK clients for unit tests
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn(),
  GetItemCommand: jest.fn(),
  PutItemCommand: jest.fn(),
  QueryCommand: jest.fn(),
  UpdateItemCommand: jest.fn(),
  DeleteItemCommand: jest.fn(),
  DescribeTableCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-eventbridge', () => ({
  EventBridgeClient: jest.fn(),
  PutEventsCommand: jest.fn(),
  ListRulesCommand: jest.fn(),
  ListTargetsByRuleCommand: jest.fn()
}));

// Console output control
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    console.log = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Global error handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export {};
