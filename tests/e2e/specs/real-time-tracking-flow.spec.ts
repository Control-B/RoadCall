import { test, expect } from '@playwright/test';
import { DriverClient } from '../utils/driver-client';
import { VendorClient } from '../utils/vendor-client';
import { TrackingClient } from '../utils/tracking-client';

/**
 * E2E Test: Real-Time Tracking Flow
 * Requirements: 6.1 (Real-Time Location Tracking)
 * 
 * This test validates real-time tracking functionality:
 * 1. Tracking session is created when vendor accepts
 * 2. Vendor location updates are received in real-time
 * 3. ETA is calculated and updated
 * 4. Driver receives updates via GraphQL subscription
 * 5. Arrival is detected via geofencing
 */
test.describe('Real-Time Tracking Flow', () => {
  let driverClient: DriverClient;
  let vendorClient: VendorClient;
  let trackingClient: TrackingClient;

  test.beforeEach(async () => {
    driverClient = new DriverClient(process.env.API_URL!);
    vendorClient = new VendorClient(process.env.API_URL!);
    trackingClient = new TrackingClient(process.env.APPSYNC_URL!);
  });

  test('should provide real-time location updates with ETA calculation', async () => {
    // Setup: Register driver and vendor
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234572',
      companyId: 'test-company',
      truckNumber: 'TRK-006',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001007',
      capabilities: ['tire_repair'],
      location: { lat: 40.7580, lon: -73.9855 }, // ~5 miles from incident
      rating: 4.5,
    });

    await vendorClient.setAvailability('available');

    // Driver creates incident
    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    // Wait for vendor assignment
    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);

    // Subscribe to tracking updates
    const trackingUpdates: any[] = [];
    const subscription = await trackingClient.subscribeToTracking(incident.incidentId, (update) => {
      trackingUpdates.push(update);
    });

    // Vendor starts navigation
    await vendorClient.startNavigation(incident.incidentId);

    // Wait for tracking session creation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(trackingUpdates.length).toBeGreaterThan(0);
    const initialUpdate = trackingUpdates[0];
    expect(initialUpdate.sessionId).toBeDefined();
    expect(initialUpdate.eta).toBeDefined();

    // Simulate vendor moving closer (send location updates every 10 seconds)
    const route = [
      { lat: 40.7580, lon: -73.9855 }, // Starting point
      { lat: 40.7500, lon: -73.9900 },
      { lat: 40.7400, lon: -73.9950 },
      { lat: 40.7300, lon: -74.0000 },
      { lat: 40.7200, lon: -74.0050 },
      { lat: 40.7128, lon: -74.006 }, // Arrival
    ];

    for (const location of route) {
      await vendorClient.updateLocation({
        ...location,
        timestamp: new Date().toISOString(),
      });

      // Wait for update propagation (should be within 2 seconds per requirement 6.3)
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Verify tracking updates received
    expect(trackingUpdates.length).toBeGreaterThanOrEqual(route.length);

    // Verify ETA decreased over time
    const etas = trackingUpdates.map((u) => u.eta.minutes);
    for (let i = 1; i < etas.length; i++) {
      expect(etas[i]).toBeLessThanOrEqual(etas[i - 1]);
    }

    // Verify arrival detected (last update should show vendor arrived)
    const lastUpdate = trackingUpdates[trackingUpdates.length - 1];
    expect(lastUpdate.status).toBe('arrived');

    // Verify driver received arrival notification
    const arrivalNotification = await driverClient.waitForNotification(
      'vendor_arrived',
      { incidentId: incident.incidentId },
      5000
    );

    expect(arrivalNotification).toBeDefined();

    // Cleanup subscription
    subscription.unsubscribe();
  });

  test('should handle location updates at 10-second intervals', async () => {
    // Setup
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234573',
      companyId: 'test-company',
      truckNumber: 'TRK-007',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001008',
      capabilities: ['tire_repair'],
      location: { lat: 40.7580, lon: -73.9855 },
      rating: 4.5,
    });

    await vendorClient.setAvailability('available');

    const incident = await driverClient.createIncident({
      type: 'tire',
      location: { lat: 40.7128, lon: -74.006 },
      description: 'Flat tire',
    });

    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);

    const trackingUpdates: any[] = [];
    const updateTimestamps: number[] = [];

    const subscription = await trackingClient.subscribeToTracking(incident.incidentId, (update) => {
      trackingUpdates.push(update);
      updateTimestamps.push(Date.now());
    });

    await vendorClient.startNavigation(incident.incidentId);

    // Send location updates every 10 seconds for 1 minute
    for (let i = 0; i < 6; i++) {
      await vendorClient.updateLocation({
        lat: 40.7580 - i * 0.01,
        lon: -73.9855 - i * 0.01,
        timestamp: new Date().toISOString(),
      });

      await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    // Verify updates received at approximately 10-second intervals
    expect(trackingUpdates.length).toBeGreaterThanOrEqual(6);

    for (let i = 1; i < updateTimestamps.length; i++) {
      const interval = updateTimestamps[i] - updateTimestamps[i - 1];
      // Allow 2-second tolerance for network latency
      expect(interval).toBeGreaterThanOrEqual(8000);
      expect(interval).toBeLessThanOrEqual(12000);
    }

    subscription.unsubscribe();
  });

  test('should detect arrival within 100-meter geofence', async () => {
    // Setup
    const driver = await driverClient.register({
      name: 'Test Driver',
      phone: '+15551234574',
      companyId: 'test-company',
      truckNumber: 'TRK-008',
    });

    await driverClient.verifyOTP(driver.phone, '123456');

    const vendor = await vendorClient.register({
      businessName: 'Test Vendor',
      phone: '+15559001009',
      capabilities: ['tire_repair'],
      location: { lat: 40.7580, lon: -73.9855 },
      rating: 4.5,
    });

    await vendorClient.setAvailability('available');

    const incidentLocation = { lat: 40.7128, lon: -74.006 };
    const incident = await driverClient.createIncident({
      type: 'tire',
      location: incidentLocation,
      description: 'Flat tire',
    });

    await driverClient.waitForNotification('vendor_assigned', { incidentId: incident.incidentId }, 60000);
    await vendorClient.startNavigation(incident.incidentId);

    // Move vendor to just outside geofence (150 meters away)
    await vendorClient.updateLocation({
      lat: incidentLocation.lat + 0.00135, // ~150 meters north
      lon: incidentLocation.lon,
      timestamp: new Date().toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Verify no arrival notification yet
    let arrivalNotification = await driverClient.checkNotification('vendor_arrived', {
      incidentId: incident.incidentId,
    });
    expect(arrivalNotification).toBeNull();

    // Move vendor inside geofence (50 meters away)
    await vendorClient.updateLocation({
      lat: incidentLocation.lat + 0.00045, // ~50 meters north
      lon: incidentLocation.lon,
      timestamp: new Date().toISOString(),
    });

    // Verify arrival notification received
    arrivalNotification = await driverClient.waitForNotification(
      'vendor_arrived',
      { incidentId: incident.incidentId },
      5000
    );

    expect(arrivalNotification).toBeDefined();

    // Verify incident status updated
    const updatedIncident = await driverClient.getIncident(incident.incidentId);
    expect(updatedIncident.status).toBe('vendor_arrived');
  });
});
