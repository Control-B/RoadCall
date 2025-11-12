import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import {
  upsertIncidentFact,
  upsertVendorDimension,
  upsertDriverDimension,
  updateIncidentPayment,
  processDynamoDBStream,
} from '../etl-service';
import { query } from '../db-connection';

// Mock the database connection
jest.mock('../db-connection');

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('ETL Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('upsertIncidentFact', () => {
    it('should insert incident fact with calculated metrics', async () => {
      const incident = {
        incidentId: 'incident-123',
        driverId: 'driver-456',
        vendorId: 'vendor-789',
        type: 'tire',
        status: 'closed',
        location: {
          lat: 40.7128,
          lon: -74.006,
          address: '123 Main St, New York, NY',
        },
        createdAt: '2024-11-11T10:00:00.000Z',
        timeline: [
          {
            from: 'created',
            to: 'vendor_assigned',
            timestamp: '2024-11-11T10:02:00.000Z',
          },
          {
            from: 'vendor_assigned',
            to: 'vendor_arrived',
            timestamp: '2024-11-11T10:32:00.000Z',
          },
          {
            from: 'vendor_arrived',
            to: 'work_completed',
            timestamp: '2024-11-11T11:00:00.000Z',
          },
          {
            from: 'work_completed',
            to: 'closed',
            timestamp: '2024-11-11T11:05:00.000Z',
          },
        ],
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertIncidentFact(incident);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fact_incidents'),
        expect.arrayContaining([
          'incident-123',
          'driver-456',
          'vendor-789',
          'tire',
          'closed',
          '2024-11-11T10:00:00.000Z',
          '2024-11-11T10:02:00.000Z', // assigned_at
          '2024-11-11T10:32:00.000Z', // arrived_at
          '2024-11-11T11:00:00.000Z', // completed_at
          '2024-11-11T11:05:00.000Z', // closed_at
          120, // time_to_assign_seconds (2 minutes)
          1800, // time_to_arrival_seconds (30 minutes)
          3900, // total_duration_seconds (65 minutes)
          40.7128,
          -74.006,
          null, // distance_miles
          expect.any(String), // region
          false, // escalated
          20241111, // date_key
          10, // hour_key
        ])
      );
    });

    it('should detect escalated incidents', async () => {
      const incident = {
        incidentId: 'incident-123',
        driverId: 'driver-456',
        type: 'tire',
        status: 'vendor_assigned',
        createdAt: '2024-11-11T10:00:00.000Z',
        timeline: [
          {
            from: 'created',
            to: 'vendor_assigned',
            timestamp: '2024-11-11T10:02:00.000Z',
            reason: 'Escalated to dispatcher after no vendor found',
          },
        ],
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertIncidentFact(incident);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fact_incidents'),
        expect.arrayContaining([
          true, // escalated
        ])
      );
    });

    it('should handle incidents without timeline', async () => {
      const incident = {
        incidentId: 'incident-123',
        driverId: 'driver-456',
        type: 'engine',
        status: 'created',
        createdAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertIncidentFact(incident);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fact_incidents'),
        expect.arrayContaining([
          'incident-123',
          'driver-456',
          null, // vendor_id
          'engine',
          'created',
          '2024-11-11T10:00:00.000Z',
          null, // assigned_at
          null, // arrived_at
          null, // completed_at
          null, // closed_at
          null, // time_to_assign_seconds
          null, // time_to_arrival_seconds
          null, // total_duration_seconds
        ])
      );
    });
  });

  describe('upsertVendorDimension', () => {
    it('should insert vendor dimension with all fields', async () => {
      const vendor = {
        vendorId: 'vendor-123',
        businessName: 'ABC Towing',
        contactName: 'John Doe',
        phone: '+15551234567',
        email: 'john@abctowing.com',
        capabilities: ['tire_repair', 'towing'],
        coverageArea: {
          center: { lat: 40.7128, lon: -74.006 },
          radiusMiles: 50,
        },
        rating: {
          average: 4.7,
          count: 150,
        },
        metrics: {
          acceptanceRate: 0.85,
          completionRate: 0.95,
          avgResponseTime: 1800,
          totalJobs: 150,
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertVendorDimension(vendor);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_vendors'),
        expect.arrayContaining([
          'vendor-123',
          'ABC Towing',
          'John Doe',
          '+15551234567',
          'john@abctowing.com',
          ['tire_repair', 'towing'],
          expect.any(String), // region
          50,
          4.7,
          150,
          0.85,
          0.95,
          1800,
          true, // active
          null, // verified_at
          '2024-01-01T00:00:00.000Z',
          '2024-11-11T10:00:00.000Z',
        ])
      );
    });

    it('should handle vendors with minimal data', async () => {
      const vendor = {
        vendorId: 'vendor-123',
        businessName: 'XYZ Services',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertVendorDimension(vendor);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_vendors'),
        expect.arrayContaining([
          'vendor-123',
          'XYZ Services',
          null, // contact_name
          null, // phone
          null, // email
          [], // capabilities
          null, // region
          null, // coverage_radius_miles
          null, // avg_rating
          0, // total_jobs
          null, // acceptance_rate
          null, // completion_rate
          null, // avg_response_time_seconds
        ])
      );
    });
  });

  describe('upsertDriverDimension', () => {
    it('should insert driver dimension with all fields', async () => {
      const driver = {
        driverId: 'driver-123',
        userId: 'user-456',
        name: 'Jane Smith',
        phone: '+15559876543',
        email: 'jane@example.com',
        companyId: 'company-789',
        companyName: 'Acme Trucking',
        truckNumber: 'TRUCK-001',
        paymentType: 'company',
        stats: {
          totalIncidents: 25,
          avgRating: 4.5,
        },
        status: 'active',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertDriverDimension(driver);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_drivers'),
        expect.arrayContaining([
          'driver-123',
          'user-456',
          'Jane Smith',
          '+15559876543',
          'jane@example.com',
          'company-789',
          'Acme Trucking',
          'TRUCK-001',
          null, // region
          25,
          4.5,
          true, // active
          'company',
          '2024-01-01T00:00:00.000Z',
          '2024-11-11T10:00:00.000Z',
        ])
      );
    });

    it('should handle inactive drivers', async () => {
      const driver = {
        driverId: 'driver-123',
        userId: 'user-456',
        name: 'John Inactive',
        status: 'inactive',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await upsertDriverDimension(driver);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_drivers'),
        expect.arrayContaining([
          false, // active
        ])
      );
    });
  });

  describe('updateIncidentPayment', () => {
    it('should update incident with payment amount', async () => {
      const payment = {
        paymentId: 'payment-123',
        incidentId: 'incident-456',
        vendorId: 'vendor-789',
        amountCents: 25000,
        status: 'completed',
        createdAt: '2024-11-11T10:00:00.000Z',
      };

      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await updateIncidentPayment(payment);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fact_incidents'),
        [25000, 'incident-456']
      );
    });
  });

  describe('processDynamoDBStream', () => {
    it('should process incident stream records', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: '1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: {
                incidentId: { S: 'incident-123' },
              },
              NewImage: {
                incidentId: { S: 'incident-123' },
                driverId: { S: 'driver-456' },
                type: { S: 'tire' },
                status: { S: 'created' },
                createdAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '1',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
        ],
      };

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await processDynamoDBStream(event);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO fact_incidents'),
        expect.any(Array)
      );
    });

    it('should process vendor stream records', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: '1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: {
                vendorId: { S: 'vendor-123' },
              },
              NewImage: {
                vendorId: { S: 'vendor-123' },
                businessName: { S: 'ABC Towing' },
                createdAt: { S: '2024-01-01T00:00:00.000Z' },
                updatedAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '1',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
        ],
      };

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await processDynamoDBStream(event);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_vendors'),
        expect.any(Array)
      );
    });

    it('should process driver stream records', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: '1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: {
                driverId: { S: 'driver-123' },
              },
              NewImage: {
                driverId: { S: 'driver-123' },
                userId: { S: 'user-456' },
                name: { S: 'Jane Smith' },
                createdAt: { S: '2024-01-01T00:00:00.000Z' },
                updatedAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '1',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
        ],
      };

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await processDynamoDBStream(event);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO dim_drivers'),
        expect.any(Array)
      );
    });

    it('should process payment stream records', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: '1',
            eventName: 'MODIFY',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: {
                paymentId: { S: 'payment-123' },
              },
              NewImage: {
                paymentId: { S: 'payment-123' },
                incidentId: { S: 'incident-456' },
                vendorId: { S: 'vendor-789' },
                amountCents: { N: '25000' },
                status: { S: 'completed' },
                createdAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '1',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
        ],
      };

      mockQuery.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      await processDynamoDBStream(event);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE fact_incidents'),
        expect.any(Array)
      );
    });

    it('should continue processing on individual record failures', async () => {
      const event: DynamoDBStreamEvent = {
        Records: [
          {
            eventID: '1',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: { incidentId: { S: 'incident-1' } },
              NewImage: {
                incidentId: { S: 'incident-1' },
                driverId: { S: 'driver-1' },
                type: { S: 'tire' },
                status: { S: 'created' },
                createdAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '1',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
          {
            eventID: '2',
            eventName: 'INSERT',
            eventVersion: '1.1',
            eventSource: 'aws:dynamodb',
            awsRegion: 'us-east-1',
            dynamodb: {
              Keys: { incidentId: { S: 'incident-2' } },
              NewImage: {
                incidentId: { S: 'incident-2' },
                driverId: { S: 'driver-2' },
                type: { S: 'engine' },
                status: { S: 'created' },
                createdAt: { S: '2024-11-11T10:00:00.000Z' },
              },
              SequenceNumber: '2',
              SizeBytes: 100,
              StreamViewType: 'NEW_AND_OLD_IMAGES',
            },
          } as DynamoDBRecord,
        ],
      };

      // First record fails, second succeeds
      mockQuery
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      await processDynamoDBStream(event);

      // Should have attempted both records
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });
});
