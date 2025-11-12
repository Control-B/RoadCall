# End-to-End Tests

This directory contains end-to-end tests for the AI Roadcall Assistant platform, validating complete user flows across all microservices.

## Test Coverage

The E2E tests cover the following critical user flows as specified in the requirements:

### 1. Driver Incident Flow (Requirement 2.2)
- Driver registration and authentication
- Incident creation via mobile app
- Vendor assignment notification
- Real-time tracking
- Arrival notification
- Work completion
- Incident closure

### 2. Vendor Matching Flow (Requirement 4.3)
- Multi-vendor matching based on distance, capability, and rating
- Offer distribution to top vendors
- First-accept-wins logic
- Concurrent acceptance prevention
- Radius expansion on timeout

### 3. Real-Time Tracking Flow (Requirement 6.1)
- Tracking session creation
- Location updates every 10 seconds
- ETA calculation and updates
- Geofence-based arrival detection
- GraphQL subscription updates

### 4. Payment Processing Flow (Requirement 10.3)
- Payment record creation
- Back-office approval workflow
- IC driver direct payment
- Fraud detection and review
- Payment retry on failure
- Vendor payout confirmation

## Prerequisites

- Node.js 20+
- pnpm 8+
- Running API services (or deployed environment)

## Installation

```bash
cd tests/e2e
pnpm install
```

## Configuration

Create a `.env` file in the `tests/e2e` directory:

```env
# API Configuration
API_URL=https://api.dev.roadcall.example.com
APPSYNC_URL=https://appsync.dev.roadcall.example.com/graphql

# Test Configuration
STAGE=dev
```

## Running Tests

### Run all tests
```bash
pnpm test
```

### Run specific test file
```bash
pnpm test driver-incident-flow.spec.ts
```

### Run tests in UI mode (interactive)
```bash
pnpm test:ui
```

### Run tests in debug mode
```bash
pnpm test:debug
```

### Run tests on specific browser
```bash
pnpm test --project=chromium
pnpm test --project=firefox
pnpm test --project=webkit
```

### Run tests in headed mode (see browser)
```bash
pnpm test --headed
```

## Test Structure

```
tests/e2e/
├── specs/                          # Test specifications
│   ├── driver-incident-flow.spec.ts
│   ├── vendor-matching-flow.spec.ts
│   ├── real-time-tracking-flow.spec.ts
│   └── payment-flow.spec.ts
├── utils/                          # Test utilities
│   ├── driver-client.ts           # Driver API client
│   ├── vendor-client.ts           # Vendor API client
│   ├── tracking-client.ts         # GraphQL tracking client
│   ├── backoffice-client.ts       # Back-office API client
│   └── admin-client.ts            # Admin API client
├── playwright.config.ts           # Playwright configuration
├── package.json
└── README.md
```

## Writing Tests

### Test Template

```typescript
import { test, expect } from '@playwright/test';
import { DriverClient } from '../utils/driver-client';

test.describe('My Test Suite', () => {
  let driverClient: DriverClient;

  test.beforeEach(async () => {
    driverClient = new DriverClient(process.env.API_URL!);
  });

  test('should do something', async () => {
    // Arrange
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234567',
      companyId: 'test-company',
      truckNumber: 'TRK-001',
    });

    // Act
    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Assert
    expect(incident.incidentId).toBeDefined();
    expect(incident.status).toBe('created');
  });
});
```

### Best Practices

1. **Use descriptive test names**
   ```typescript
   test('should complete full incident lifecycle from creation to closure', async () => {
     // ...
   });
   ```

2. **Follow AAA pattern** (Arrange, Act, Assert)
   ```typescript
   // Arrange
   const driver = await setupDriver();
   
   // Act
   const result = await driver.createIncident(data);
   
   // Assert
   expect(result).toBeDefined();
   ```

3. **Clean up resources**
   ```typescript
   test.afterEach(async () => {
     await cleanupTestData();
   });
   ```

4. **Use meaningful assertions**
   ```typescript
   // Good
   expect(incident.status).toBe('created');
   expect(incident.timeline).toHaveLength(1);
   
   // Avoid
   expect(incident).toBeTruthy();
   ```

5. **Handle async operations properly**
   ```typescript
   // Wait for notifications with timeout
   const notification = await driverClient.waitForNotification(
     'vendor_assigned',
     { incidentId: incident.incidentId },
     60000 // 60 second timeout
   );
   ```

## Test Utilities

### DriverClient

Provides methods for driver-related operations:
- `register()`: Register new driver
- `verifyOTP()`: Verify OTP code
- `createIncident()`: Create incident
- `getIncident()`: Get incident details
- `cancelIncident()`: Cancel incident
- `waitForNotification()`: Wait for notification

### VendorClient

Provides methods for vendor-related operations:
- `register()`: Register new vendor
- `setAvailability()`: Update availability status
- `getPendingOffers()`: Get pending offers
- `acceptOffer()`: Accept offer
- `startNavigation()`: Start navigation
- `updateLocation()`: Update location
- `completeWork()`: Complete work

### TrackingClient

Provides GraphQL subscription methods:
- `subscribeToTracking()`: Subscribe to tracking updates
- `getTrackingSession()`: Get tracking session details

### BackOfficeClient

Provides back-office operations:
- `authenticate()`: Authenticate as back-office user
- `getPendingPayments()`: Get pending payments
- `approvePayment()`: Approve payment
- `getFraudReviewQueue()`: Get fraud review queue

## CI/CD Integration

Tests run automatically in the CI/CD pipeline:

### On Pull Requests
- Tests run against dev environment
- Must pass before merge

### On Staging Deployment
- Full E2E test suite runs
- Tests run against staging environment
- Deployment blocked if tests fail

### On Production Deployment
- Smoke tests run (subset of E2E tests)
- Tests run against production environment
- Automatic rollback if tests fail

## Debugging

### View test results
```bash
pnpm test:report
```

### Debug specific test
```bash
pnpm test:debug driver-incident-flow.spec.ts
```

### View traces
Traces are automatically captured on test failure and saved to `test-results/`.

### View screenshots
Screenshots are captured on failure and saved to `test-results/`.

### View videos
Videos are recorded for failed tests and saved to `test-results/`.

## Performance Considerations

- Tests run in parallel by default
- Use `test.describe.serial()` for sequential tests
- Set timeout for long-running operations:
  ```typescript
  test('long test', async () => {
    test.setTimeout(120000); // 2 minutes
    // ...
  });
  ```

## Troubleshooting

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if services are running
- Verify network connectivity

### Authentication failures
- Verify API_URL is correct
- Check if auth service is running
- Verify test credentials

### Flaky tests
- Add explicit waits for async operations
- Use `waitForNotification()` instead of fixed delays
- Check for race conditions

### Connection errors
- Verify services are accessible
- Check firewall rules
- Verify CORS configuration

## Contributing

When adding new E2E tests:

1. Follow existing test structure
2. Use test utilities for API calls
3. Add descriptive comments
4. Reference requirements in test description
5. Update this README if adding new test suites

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [API Testing Guide](https://playwright.dev/docs/api-testing)
