import { test, expect } from '@playwright/test';
import { DriverClient } from '../utils/driver-client';
import { VendorClient } from '../utils/vendor-client';
import { AdminClient } from '../utils/admin-client';

/**
 * E2E Test: Vendor Matching Flow
 * Requirements: 4.3 (Vendor Matching)
 * 
 * This test validates the vendor matching algorithm:
 * 1. Multiple vendors are available in the area
 * 2. System calculates match scores based on distance, capability, rating
 * 3. Top vendors receive offers
 * 4. First vendor to accept gets the job
 * 5. Other offers are cancelled
 */
test.describe('Vendor Matching Flow', () => {
  let driverClient: DriverClient;
  let vendor1Client: VendorClient;
  let vendor2Client: VendorClient;
  let vendor3Client: VendorClient;
  let adminClient: AdminClient;

  test.beforeEach(async () => {
    driverClient = new DriverClient(process.env.API_URL!);
    vendor1Client = new VendorClient(process.env.API_URL!);
    vendor2Client = new VendorClient(process.env.API_URL!);
    vendor3Client = new VendorClient(process.env.API_URL!);
    adminClient = new AdminClient(process.env.API_URL!);
  });

  test('should match closest available vendor with required capability', async () => {
    // Setup: Create 3 vendors at different distances
    const vendor1 = await vendor1Client.register({
      businessName: 'Quick Tire Service',
      phone: '+15559001001',
      capabilities: ['tire_repair', 'tire_replacement'],
      location: { lat: 40.7128, lon: -74.006 }, // Same location as incident
      rating: 4.5,
    });

    const vendor2 = await vendor2Client.register({
      businessName: 'Fast Tire Fix',
      phone: '+15559001002',
      capabilities: ['tire_repair'],
      location: { lat: 40.7580, lon: -73.9855 }, // ~5 miles away
      rating: 4.8,
    });

    const vendor3 = await vendor3Client.register({
      businessName: 'Engine Masters',
      phone: '+15559001003',
      capabilities: ['engine_repair'], // Wrong capability
      location: { lat: 40.7128, lon: -74.006 },
      rating: 5.0,
    });

    // Set all vendors to available
    await vendor1Client.setAvailability('available');
    await vendor2Client.setAvailability('available');
    await vendor3Client.setAvailability('available');

    // Driver creates tire incident
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234569',
      companyId: 'test-company',
      truckNumber: 'TRK-003',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Wait for offers to be created (should be within 10 seconds per requirement 4.3)
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Verify vendor1 and vendor2 received offers (not vendor3 due to capability mismatch)
    const vendor1Offers = await vendor1Client.getPendingOffers();
    const vendor2Offers = await vendor2Client.getPendingOffers();
    const vendor3Offers = await vendor3Client.getPendingOffers();

    expect(vendor1Offers.length).toBeGreaterThan(0);
    expect(vendor2Offers.length).toBeGreaterThan(0);
    expect(vendor3Offers.length).toBe(0);

    // Vendor1 accepts the offer
    const offer = vendor1Offers.find((o) => o.incidentId === incident.incidentId);
    expect(offer).toBeDefined();

    await vendor1Client.acceptOffer(offer!.offerId);

    // Verify incident assigned to vendor1
    const updatedIncident = await driverClient.getIncident(incident.incidentId);
    expect(updatedIncident.assignedVendorId).toBe(vendor1.vendorId);

    // Verify vendor2's offer was cancelled
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const vendor2UpdatedOffers = await vendor2Client.getPendingOffers();
    const cancelledOffer = vendor2UpdatedOffers.find((o) => o.incidentId === incident.incidentId);
    expect(cancelledOffer).toBeUndefined();
  });

  test('should expand search radius if no vendors accept within timeout', async () => {
    // Setup: Create vendor far away
    const vendor = await vendor1Client.register({
      businessName: 'Distant Tire Service',
      phone: '+15559001004',
      capabilities: ['tire_repair'],
      location: { lat: 41.8781, lon: -87.6298 }, // Chicago (far from NYC)
      rating: 4.5,
    });

    await vendor1Client.setAvailability('available');

    // Driver creates incident in NYC
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234570',
      companyId: 'test-company',
      truckNumber: 'TRK-004',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Wait for initial matching attempt (2 min timeout per requirement 4.4)
    await new Promise((resolve) => setTimeout(resolve, 120000));

    // Verify radius expansion occurred (check incident metadata)
    const incidentDetails = await adminClient.getIncidentDetails(incident.incidentId);
    expect(incidentDetails.matchingAttempts).toBeGreaterThan(1);
    expect(incidentDetails.searchRadius).toBeGreaterThan(50); // Initial radius
  });

  test('should prevent multiple vendors from accepting same incident', async () => {
    // Setup: Create 2 vendors
    const vendor1 = await vendor1Client.register({
      businessName: 'Vendor 1',
      phone: '+15559001005',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 4.5,
    });

    const vendor2 = await vendor2Client.register({
      businessName: 'Vendor 2',
      phone: '+15559001006',
      capabilities: ['tire_repair'],
      location: { lat: 40.7128, lon: -74.006 },
      rating: 4.5,
    });

    await vendor1Client.setAvailability('available');
    await vendor2Client.setAvailability('available');

    // Driver creates incident
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234571',
      companyId: 'test-company',
      truckNumber: 'TRK-005',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Wait for offers
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const vendor1Offers = await vendor1Client.getPendingOffers();
    const vendor2Offers = await vendor2Client.getPendingOffers();

    const offer1 = vendor1Offers.find((o) => o.incidentId === incident.incidentId);
    const offer2 = vendor2Offers.find((o) => o.incidentId === incident.incidentId);

    // Both vendors try to accept simultaneously
    const [result1, result2] = await Promise.allSettled([
      vendor1Client.acceptOffer(offer1!.offerId),
      vendor2Client.acceptOffer(offer2!.offerId),
    ]);

    // One should succeed, one should fail with conflict error
    const successCount = [result1, result2].filter((r) => r.status === 'fulfilled').length;
    const failureCount = [result1, result2].filter((r) => r.status === 'rejected').length;

    expect(successCount).toBe(1);
    expect(failureCount).toBe(1);

    // Verify only one vendor is assigned
    const finalIncident = await driverClient.getIncident(incident.incidentId);
    expect(finalIncident.assignedVendorId).toBeDefined();
    expect([vendor1.vendorId, vendor2.vendorId]).toContain(finalIncident.assignedVendorId);
  });
});
