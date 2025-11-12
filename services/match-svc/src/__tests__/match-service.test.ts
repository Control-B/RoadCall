import {
  calculateMatchScore,
  calculateScoreBreakdown,
  MatchConfig,
} from '../match-service';
import { Vendor, Incident } from '@roadcall/types';

describe('Match Scoring Algorithm', () => {
  const defaultConfig: MatchConfig = {
    weights: {
      distance: 0.30,
      capability: 0.25,
      availability: 0.20,
      acceptanceRate: 0.15,
      rating: 0.10,
    },
    defaultRadiusMiles: 50,
    maxRadiusMiles: 150,
    topVendorCount: 3,
  };

  const createVendor = (overrides: Partial<Vendor> = {}): Vendor => ({
    vendorId: 'vendor-123',
    businessName: 'Test Vendor',
    contactName: 'John Doe',
    phone: '+15551234567',
    email: 'vendor@test.com',
    capabilities: ['tire_repair'],
    coverageArea: {
      center: { lat: 40.7128, lon: -74.0060 },
      radiusMiles: 50,
      geofenceIds: [],
    },
    availability: {
      status: 'available',
      lastUpdated: new Date().toISOString(),
    },
    operatingHours: {},
    rating: {
      average: 4.5,
      count: 100,
    },
    metrics: {
      acceptanceRate: 0.85,
      avgResponseTime: 15,
      completionRate: 0.95,
      totalJobs: 200,
    },
    pricing: {
      tire_repair: { basePrice: 10000, perMileRate: 200 },
    },
    certifications: [],
    insuranceExpiry: '2025-12-31',
    backgroundCheckStatus: 'approved',
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  const createIncident = (overrides: Partial<Incident> = {}): Incident => ({
    incidentId: 'incident-123',
    driverId: 'driver-123',
    type: 'tire',
    status: 'created',
    location: {
      lat: 40.7128,
      lon: -74.0060,
      address: '123 Main St',
      roadSnapped: { lat: 40.7128, lon: -74.0060 },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: [],
    media: [],
    ...overrides,
  });

  describe('calculateMatchScore', () => {
    it('should return 1.0 for perfect match at same location', () => {
      const vendor = createVendor({
        coverageArea: {
          center: { lat: 40.7128, lon: -74.0060 },
          radiusMiles: 50,
          geofenceIds: [],
        },
        capabilities: ['tire_repair'],
        availability: { status: 'available', lastUpdated: new Date().toISOString() },
        rating: { average: 5, count: 100 },
        metrics: {
          acceptanceRate: 1.0,
          avgResponseTime: 10,
          completionRate: 1.0,
          totalJobs: 100,
        },
      });
      const incident = createIncident();

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeCloseTo(1.0, 1);
    });

    it('should prioritize closer vendors over distant ones', () => {
      const closeVendor = createVendor({
        coverageArea: {
          center: { lat: 40.7128, lon: -74.0060 },
          radiusMiles: 50,
          geofenceIds: [],
        },
      });
      const distantVendor = createVendor({
        coverageArea: {
          center: { lat: 41.0, lon: -75.0 },
          radiusMiles: 50,
          geofenceIds: [],
        },
      });
      const incident = createIncident();

      const closeScore = calculateMatchScore(closeVendor, incident, defaultConfig);
      const distantScore = calculateMatchScore(distantVendor, incident, defaultConfig);

      expect(closeScore).toBeGreaterThan(distantScore);
    });

    it('should heavily penalize vendor without required capability', () => {
      const vendor = createVendor({
        capabilities: ['engine_repair'],
      });
      const incident = createIncident({ type: 'tire' });

      const score = calculateMatchScore(vendor, incident, defaultConfig);
      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      // Capability score should be 0
      expect(breakdown.capability).toBe(0);
      // Total score should be significantly reduced (missing 25% weight)
      expect(score).toBeLessThan(0.75);
    });

    it('should score tire_replacement capability for tire incidents', () => {
      const vendor = createVendor({
        capabilities: ['tire_replacement'],
      });
      const incident = createIncident({ type: 'tire' });

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThan(0);
    });

    it('should penalize unavailable vendors', () => {
      const availableVendor = createVendor({
        availability: { status: 'available', lastUpdated: new Date().toISOString() },
      });
      const busyVendor = createVendor({
        availability: { status: 'busy', lastUpdated: new Date().toISOString() },
      });
      const incident = createIncident();

      const availableScore = calculateMatchScore(availableVendor, incident, defaultConfig);
      const busyScore = calculateMatchScore(busyVendor, incident, defaultConfig);

      expect(availableScore).toBeGreaterThan(busyScore);
    });

    it('should favor vendors with higher acceptance rates', () => {
      const highAcceptanceVendor = createVendor({
        metrics: {
          acceptanceRate: 0.95,
          avgResponseTime: 10,
          completionRate: 0.95,
          totalJobs: 100,
        },
      });
      const lowAcceptanceVendor = createVendor({
        metrics: {
          acceptanceRate: 0.50,
          avgResponseTime: 10,
          completionRate: 0.95,
          totalJobs: 100,
        },
      });
      const incident = createIncident();

      const highScore = calculateMatchScore(highAcceptanceVendor, incident, defaultConfig);
      const lowScore = calculateMatchScore(lowAcceptanceVendor, incident, defaultConfig);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should favor vendors with higher ratings', () => {
      const highRatedVendor = createVendor({
        rating: { average: 5.0, count: 100 },
      });
      const lowRatedVendor = createVendor({
        rating: { average: 2.5, count: 100 },
      });
      const incident = createIncident();

      const highScore = calculateMatchScore(highRatedVendor, incident, defaultConfig);
      const lowScore = calculateMatchScore(lowRatedVendor, incident, defaultConfig);

      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should handle vendor at max radius', () => {
      const vendor = createVendor({
        coverageArea: {
          center: { lat: 42.0, lon: -76.0 },
          radiusMiles: 50,
          geofenceIds: [],
        },
      });
      const incident = createIncident();

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle vendor with zero acceptance rate', () => {
      const vendor = createVendor({
        metrics: {
          acceptanceRate: 0,
          avgResponseTime: 10,
          completionRate: 0.95,
          totalJobs: 0,
        },
      });
      const incident = createIncident();

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle vendor with zero rating', () => {
      const vendor = createVendor({
        rating: { average: 0, count: 0 },
      });
      const incident = createIncident();

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should match engine_repair capability for engine incidents', () => {
      const vendor = createVendor({
        capabilities: ['engine_repair'],
      });
      const incident = createIncident({ type: 'engine' });

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThan(0);
    });

    it('should match towing capability for tow incidents', () => {
      const vendor = createVendor({
        capabilities: ['towing'],
      });
      const incident = createIncident({ type: 'tow' });

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThan(0);
    });

    it('should handle vendor with multiple capabilities', () => {
      const vendor = createVendor({
        capabilities: ['tire_repair', 'tire_replacement', 'engine_repair', 'towing'],
      });
      const incident = createIncident({ type: 'tire' });

      const score = calculateMatchScore(vendor, incident, defaultConfig);

      expect(score).toBeGreaterThan(0);
    });

    it('should apply custom weights correctly', () => {
      const customConfig: MatchConfig = {
        ...defaultConfig,
        weights: {
          distance: 0.50, // Heavily weight distance
          capability: 0.25,
          availability: 0.10,
          acceptanceRate: 0.10,
          rating: 0.05,
        },
      };

      const closeVendor = createVendor({
        coverageArea: {
          center: { lat: 40.7128, lon: -74.0060 },
          radiusMiles: 50,
          geofenceIds: [],
        },
        rating: { average: 3.0, count: 10 },
      });
      const distantVendor = createVendor({
        coverageArea: {
          center: { lat: 41.5, lon: -75.5 },
          radiusMiles: 50,
          geofenceIds: [],
        },
        rating: { average: 5.0, count: 100 },
      });
      const incident = createIncident();

      const closeScore = calculateMatchScore(closeVendor, incident, customConfig);
      const distantScore = calculateMatchScore(distantVendor, incident, customConfig);

      // With heavy distance weighting, close vendor should win despite lower rating
      expect(closeScore).toBeGreaterThan(distantScore);
    });
  });

  describe('calculateScoreBreakdown', () => {
    it('should return breakdown with all components', () => {
      const vendor = createVendor();
      const incident = createIncident();

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown).toHaveProperty('distance');
      expect(breakdown).toHaveProperty('capability');
      expect(breakdown).toHaveProperty('availability');
      expect(breakdown).toHaveProperty('acceptanceRate');
      expect(breakdown).toHaveProperty('rating');
    });

    it('should show 0 capability score for mismatched capability', () => {
      const vendor = createVendor({
        capabilities: ['engine_repair'],
      });
      const incident = createIncident({ type: 'tire' });

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.capability).toBe(0);
    });

    it('should show 1 capability score for matched capability', () => {
      const vendor = createVendor({
        capabilities: ['tire_repair'],
      });
      const incident = createIncident({ type: 'tire' });

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.capability).toBe(1);
    });

    it('should show 0 availability score for busy vendor', () => {
      const vendor = createVendor({
        availability: { status: 'busy', lastUpdated: new Date().toISOString() },
      });
      const incident = createIncident();

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.availability).toBe(0);
    });

    it('should show 1 availability score for available vendor', () => {
      const vendor = createVendor({
        availability: { status: 'available', lastUpdated: new Date().toISOString() },
      });
      const incident = createIncident();

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.availability).toBe(1);
    });

    it('should normalize rating to 0-1 scale', () => {
      const vendor = createVendor({
        rating: { average: 4.0, count: 100 },
      });
      const incident = createIncident();

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.rating).toBeCloseTo(0.8, 2);
    });

    it('should normalize distance to 0-1 scale', () => {
      const vendor = createVendor({
        coverageArea: {
          center: { lat: 40.7128, lon: -74.0060 },
          radiusMiles: 50,
          geofenceIds: [],
        },
      });
      const incident = createIncident();

      const breakdown = calculateScoreBreakdown(vendor, incident, defaultConfig);

      expect(breakdown.distance).toBeGreaterThanOrEqual(0);
      expect(breakdown.distance).toBeLessThanOrEqual(1);
    });
  });
});
