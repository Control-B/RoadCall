import { test, expect } from '@playwright/test';
import { DriverClient } from '../utils/driver-client';
import { VendorClient } from '../utils/vendor-client';

/**
 * E2E Test: Complete Driver Incident Flow
 * Requirements: 2.2 (Incident Creation)
 * 
 * This test validates the complete flow from incident creation to resolution:
 * 1. Driver creates an incident
 * 2. System matches and notifies vendors
 * 3. Vendor accepts the offer
 * 4. Driver receives assignment notification
 * 5. Vendor navigates to location
 * 6. System detects arrival
 * 7. Vendor completes work
 * 8. Incident is closed
 */
test.describe('Driver Incident Flow', () => {
  let driverClient: DriverClient;
  let vendorClient: VendorClient;

  test.beforeEach(async () => {
    driverClient = new DriverClient(process.env.API_URL!);
    vendorClient = new VendorClient(process.env.API_URL!);
  });

  test('should complete full incident lifecycle from creation to closure', async () => {
    // Step 1: Driver registers and authenticates
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234567',
      companyId: 'test-company',
      truckNumber: 'TRK-001',
    });

    await driverClient.verifyOTP(driver.phone, '123456');
    expect(driverClient.isAuthenticated()).toBe(true);

    // Step 2: Driver creates incident
    const incident = await driverClient.createIncident({
      type: 'tire',
      location: {
        lat: 40.7128,
        lon: -74.006,
      },
      description: 'Flat tire on I-95',
    });

    expect(incident.incidentId).toBeDefined();
    expect(incident.status).toBe('created');

    // Step 3: Wait for vendor matching (should complete within 60 seconds per requirement 25.2)
    const assignmentNotification = await driverClient.waitForNotification(
      'vendor_assigned',
      { incidentId: incident.incidentId },
      60000
    );

    expect(assignmentNotification).toBeDefined();
    expect(assignmentNotification.data.vendorId).toBeDefined();

    // Step 4: Verify incident status updated
    const updatedIncident = await driverClient.getIncident(incident.incidentId);
    expect(updatedIncident.status).toBe('vendor_assigned');
    expect(updatedIncident.assignedVendorId).toBe(assignmentNotification.data.vendorId);

    // Step 5: Vendor starts navigation
    const vendor = await vendorClient.authenticate(assignmentNotification.data.vendorId);
    await vendor.startNavigation(incident.incidentId);

    // Step 6: Driver receives en route notification
    const enRouteNotification = await driverClient.waitForNotification(
      'vendor_en_route',
      { incidentId: incident.incidentId },
      10000
    );

    expect(enRouteNotification).toBeDefined();

    // Step 7: Simulate vendor arrival (within 100m geofence)
    await vendor.updateLocation({
      lat: 40.7128,
      lon: -74.006,
      timestamp: new Date().toISOString(),
    });

    // Step 8: Driver receives arrival notification
    const arrivalNotification = await driverClient.waitForNotification(
      'vendor_arrived',
      { incidentId: incident.incidentId },
      10000
    );

    expect(arrivalNotification).toBeDefined();

    // Step 9: Vendor completes work
    await vendor.startWork(incident.incidentId);
    await vendor.completeWork(incident.incidentId, {
      notes: 'Replaced tire with spare',
      photos: ['photo1.jpg'],
    });

    // Step 10: Driver receives completion notification
    const completionNotification = await driverClient.waitForNotification(
      'work_completed',
      { incidentId: incident.incidentId },
      10000
    );

    expect(completionNotification).toBeDefined();

    // Step 11: Verify final incident status
    const finalIncident = await driverClient.getIncident(incident.incidentId);
    expect(finalIncident.status).toBe('work_completed');
    expect(finalIncident.timeline).toHaveLength(5); // created, assigned, en_route, arrived, completed
  });

  test('should handle incident cancellation by driver', async () => {
    const driver = await driverClient.register({
      name: 'Test Driver 2',
      phone: '+15551234568',
      companyId: 'test-company',
      truckNumber: 'TRK-002',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const incident = await driverClient.createIncident({
      type: 'engine',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Engine overheating',
    });

    // Cancel incident before vendor assignment
    await driverClient.cancelIncident(incident.incidentId, 'Issue resolved');

    const cancelledIncident = await driverClient.getIncident(incident.incidentId);
    expect(cancelledIncident.status).toBe('cancelled');
  });
});
