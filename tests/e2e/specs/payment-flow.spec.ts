import { test, expect } from '@playwright/test';
import { DriverClient } from '../utils/driver-client';
import { VendorClient } from '../utils/vendor-client';
import { BackOfficeClient } from '../utils/backoffice-client';

/**
 * E2E Test: Payment Processing Flow
 * Requirements: 10.3 (Payment Processing)
 * 
 * This test validates the payment workflow:
 * 1. Vendor completes work and submits for payment
 * 2. Payment record is created with pending status
 * 3. Back office reviews and approves payment
 * 4. Payment is processed via Stripe
 * 5. Vendor receives payment confirmation
 * 6. Incident is closed
 */
test.describe('Payment Flow', () => {
  let driverClient: DriverClient;
  let vendorClient: VendorClient;
  let backOfficeClient: BackOfficeClient;

  test.beforeEach(async () => {
    driverClient = new DriverClient(process.env.API_URL!);
    vendorClient = new VendorClient(process.env.API_URL!);
    backOfficeClient = new BackOfficeClient(process.env.API_URL!);
  });

  test('should process payment from work completion to vendor payout', async () => {
    // Setup: Complete an incident
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234575',
      companyId: 'test-company',
      truckNumber: 'TRK-009',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001010',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 4.5,
      stripeAccountId: 'acct_test_123', // Test Stripe Connect account
    });

    await vendorClient.setAvailability('available');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Wait for assignment and complete work
    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);
    await vendorClient.startNavigation(incident.incidentId);
    await vendorClient.updateLocation({
      lat: 40.7128,
      lon: -74.006,
      timestamp: new Date().toISOString(),
    });
    await driverClient.waitForNotification('vendor_arrived', { incidentId: incident.incidentId }, 10000);

    // Vendor completes work
    await vendorClient.startWork(incident.incidentId);
    const completionData = {
      notes: 'Replaced flat tire with spare',
      photos: ['photo1.jpg', 'photo2.jpg'],
      lineItems: [
        { description: 'Tire replacement', quantity: 1, unitPrice: 15000 }, // $150.00
        { description: 'Labor', quantity: 1, unitPrice: 5000 }, // $50.00
      ],
    };

    await vendorClient.completeWork(incident.incidentId, completionData);

    // Verify payment record created
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const payments = await vendorClient.getPayments({ incidentId: incident.incidentId });
    expect(payments.length).toBe(1);

    const payment = payments[0];
    expect(payment.status).toBe('pending_approval');
    expect(payment.amountCents).toBe(20000); // $200.00
    expect(payment.lineItems).toHaveLength(2);

    // Back office reviews and approves payment
    await backOfficeClient.authenticate('backoffice-user-1');

    const pendingPayments = await backOfficeClient.getPendingPayments();
    const targetPayment = pendingPayments.find((p) => p.paymentId === payment.paymentId);
    expect(targetPayment).toBeDefined();

    await backOfficeClient.approvePayment(payment.paymentId, {
      reviewNotes: 'Verified completion photos and pricing',
    });

    // Verify payment processed
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const updatedPayment = await vendorClient.getPayment(payment.paymentId);
    expect(updatedPayment.status).toBe('completed');
    expect(updatedPayment.stripePaymentIntentId).toBeDefined();

    // Verify vendor received payment confirmation
    const paymentNotification = await vendorClient.waitForNotification(
      'payment_approved',
      { paymentId: payment.paymentId },
      10000
    );

    expect(paymentNotification).toBeDefined();
    expect(paymentNotification.data.amountCents).toBe(20000);

    // Verify incident closed
    const finalIncident = await driverClient.getIncident(incident.incidentId);
    expect(finalIncident.status).toBe('closed');
  });

  test('should handle IC driver direct payment', async () => {
    // Setup: IC driver (pays directly)
    const driver = await driverClient.register({
      name: 'IC Driver',
      phone: '+15551234576',
      companyId: 'independent',
      truckNumber: 'IC-001',
      paymentType: 'independent_contractor',
      stripeCustomerId: 'cus_test_123',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001011',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 4.5,
      stripeAccountId: 'acct_test_124',
    });

    await vendorClient.setAvailability('available');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Complete incident
    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);
    await vendorClient.startNavigation(incident.incidentId);
    await vendorClient.updateLocation({
      lat: 40.7128,
      lon: -74.006,
      timestamp: new Date().toISOString(),
    });
    await vendorClient.startWork(incident.incidentId);
    await vendorClient.completeWork(incident.incidentId, {
      notes: 'Work completed',
      photos: ['photo1.jpg'],
      lineItems: [{ description: 'Service', quantity: 1, unitPrice: 10000 }],
    });

    // Driver receives payment request
    const paymentRequest = await driverClient.waitForNotification(
      'payment_request',
      { incidentId: incident.incidentId },
      10000
    );

    expect(paymentRequest).toBeDefined();
    expect(paymentRequest.data.amountCents).toBe(10000);

    // Driver authorizes payment
    await driverClient.authorizePayment(paymentRequest.data.paymentId, {
      paymentMethodId: 'pm_test_123',
    });

    // Verify payment processed without back office approval
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const payment = await driverClient.getPayment(paymentRequest.data.paymentId);
    expect(payment.status).toBe('completed');
    expect(payment.approvedBy).toBeNull(); // No back office approval needed

    // Verify incident closed
    const finalIncident = await driverClient.getIncident(incident.incidentId);
    expect(finalIncident.status).toBe('closed');
  });

  test('should flag high-risk payments for manual review', async () => {
    // Setup
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234577',
      companyId: 'test-company',
      truckNumber: 'TRK-010',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    // Create new vendor (high risk due to no history)
    const vendor = await vendorClient.register({
      businessName: 'New Vendor',
      phone: '+15559001012',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 0, // No rating yet
      stripeAccountId: 'acct_test_125',
    });

    await vendorClient.setAvailability('available');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Complete incident with high amount
    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);
    await vendorClient.startNavigation(incident.incidentId);
    await vendorClient.updateLocation({
      lat: 40.7128,
      lon: -74.006,
      timestamp: new Date().toISOString(),
    });
    await vendorClient.startWork(incident.incidentId);
    await vendorClient.completeWork(incident.incidentId, {
      notes: 'Major repair',
      photos: ['photo1.jpg'],
      lineItems: [{ description: 'Expensive repair', quantity: 1, unitPrice: 500000 }], // $5000
    });

    // Verify payment flagged for fraud review
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const payments = await vendorClient.getPayments({ incidentId: incident.incidentId });
    const payment = payments[0];

    expect(payment.fraudScore).toBeGreaterThan(0.7); // High fraud score
    expect(payment.fraudStatus).toBe('review_required');

    // Verify payment in manual review queue
    await backOfficeClient.authenticate('fraud-reviewer-1');
    const reviewQueue = await backOfficeClient.getFraudReviewQueue();
    const flaggedPayment = reviewQueue.find((p) => p.paymentId === payment.paymentId);

    expect(flaggedPayment).toBeDefined();
    expect(flaggedPayment.fraudReasons).toContain('high_amount');
    expect(flaggedPayment.fraudReasons).toContain('new_vendor');
  });

  test('should handle payment failures with retry', async () => {
    // Setup
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234578',
      companyId: 'test-company',
      truckNumber: 'TRK-011',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001013',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 4.5,
      stripeAccountId: 'acct_test_invalid', // Invalid account to trigger failure
    });

    await vendorClient.setAvailability('available');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Complete incident
    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);
    await vendorClient.startNavigation(incident.incidentId);
    await vendorClient.updateLocation({
      lat: 40.7128,
      lon: -74.006,
      timestamp: new Date().toISOString(),
    });
    await vendorClient.startWork(incident.incidentId);
    await vendorClient.completeWork(incident.incidentId, {
      notes: 'Work completed',
      photos: ['photo1.jpg'],
      lineItems: [{ description: 'Service', quantity: 1, unitPrice: 10000 }],
    });

    // Approve payment
    await backOfficeClient.authenticate('backoffice-user-1');
    const payments = await vendorClient.getPayments({ incidentId: incident.incidentId });
    await backOfficeClient.approvePayment(payments[0].paymentId, {
      reviewNotes: 'Approved',
    });

    // Wait for payment processing and retry attempts
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Verify payment failed after retries
    const failedPayment = await vendorClient.getPayment(payments[0].paymentId);
    expect(failedPayment.status).toBe('failed');
    expect(failedPayment.failedReason).toContain('stripe');
    expect(failedPayment.retryAttempts).toBeGreaterThan(0);

    // Verify vendor notified of failure
    const failureNotification = await vendorClient.waitForNotification(
      'payment_failed',
      { paymentId: payments[0].paymentId },
      10000
    );

    expect(failureNotification).toBeDefined();
  });
});
