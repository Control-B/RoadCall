import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { query } from './db-connection';
import { logger } from '@roadcall/utils';

// ========================================================================
// Types
// ========================================================================

interface IncidentRecord {
  incidentId: string;
  driverId: string;
  vendorId?: string;
  type: string;
  status: string;
  location?: {
    lat: number;
    lon: number;
    address?: string;
  };
  createdAt: string;
  assignedAt?: string;
  timeline?: Array<{
    from: string;
    to: string;
    timestamp: string;
    reason?: string;
  }>;
}

interface VendorRecord {
  vendorId: string;
  businessName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  capabilities?: string[];
  coverageArea?: {
    center: { lat: number; lon: number };
    radiusMiles: number;
  };
  rating?: {
    average: number;
    count: number;
  };
  metrics?: {
    acceptanceRate: number;
    completionRate: number;
    avgResponseTime: number;
    totalJobs: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface DriverRecord {
  driverId: string;
  userId: string;
  name: string;
  phone?: string;
  email?: string;
  companyId?: string;
  companyName?: string;
  truckNumber?: string;
  paymentType?: string;
  stats?: {
    totalIncidents: number;
    avgRating: number;
  };
  status?: string;
  createdAt: string;
  updatedAt: string;
}

interface PaymentRecord {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  status: string;
  createdAt: string;
  processedAt?: string;
}

// ========================================================================
// ETL Functions
// ========================================================================

/**
 * Process DynamoDB stream event
 */
export async function processDynamoDBStream(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Processing DynamoDB stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    try {
      await processStreamRecord(record);
    } catch (error) {
      logger.error('Failed to process stream record', error as Error, {
        eventID: record.eventID,
        eventName: record.eventName,
      });
      // Continue processing other records
    }
  }
}

/**
 * Process a single DynamoDB stream record
 */
async function processStreamRecord(record: DynamoDBRecord): Promise<void> {
  const { dynamodb } = record;

  if (!dynamodb || !dynamodb.NewImage) {
    return;
  }

  // Unmarshal DynamoDB record
  const newImage = unmarshall(dynamodb.NewImage as Record<string, AttributeValue>);

  // Determine table based on record structure
  if (newImage.incidentId && newImage.driverId && newImage.type) {
    await upsertIncidentFact(newImage as IncidentRecord);
  } else if (newImage.vendorId && newImage.businessName) {
    await upsertVendorDimension(newImage as VendorRecord);
  } else if (newImage.driverId && newImage.userId) {
    await upsertDriverDimension(newImage as DriverRecord);
  } else if (newImage.paymentId && newImage.incidentId) {
    await updateIncidentPayment(newImage as PaymentRecord);
  }
}

/**
 * Upsert incident fact record
 */
export async function upsertIncidentFact(incident: IncidentRecord): Promise<void> {
  logger.info('Upserting incident fact', { incidentId: incident.incidentId });

  // Calculate metrics from timeline
  const metrics = calculateIncidentMetrics(incident);

  // Get date key
  const dateKey = getDateKey(new Date(incident.createdAt));
  const hourKey = new Date(incident.createdAt).getHours();

  // Determine region from location (simplified - in production, use geocoding)
  const region = incident.location ? determineRegion(incident.location.lat, incident.location.lon) : null;

  await query(
    `INSERT INTO fact_incidents (
      incident_id, driver_id, vendor_id, incident_type, status,
      created_at, assigned_at, arrived_at, completed_at, closed_at,
      time_to_assign_seconds, time_to_arrival_seconds, total_duration_seconds,
      driver_lat, driver_lon, distance_miles, region,
      escalated, date_key, hour_key,
      updated_in_warehouse_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19, $20,
      NOW()
    )
    ON CONFLICT (incident_id) DO UPDATE SET
      vendor_id = EXCLUDED.vendor_id,
      status = EXCLUDED.status,
      assigned_at = EXCLUDED.assigned_at,
      arrived_at = EXCLUDED.arrived_at,
      completed_at = EXCLUDED.completed_at,
      closed_at = EXCLUDED.closed_at,
      time_to_assign_seconds = EXCLUDED.time_to_assign_seconds,
      time_to_arrival_seconds = EXCLUDED.time_to_arrival_seconds,
      total_duration_seconds = EXCLUDED.total_duration_seconds,
      escalated = EXCLUDED.escalated,
      updated_in_warehouse_at = NOW()`,
    [
      incident.incidentId,
      incident.driverId,
      incident.vendorId || null,
      incident.type,
      incident.status,
      incident.createdAt,
      metrics.assignedAt,
      metrics.arrivedAt,
      metrics.completedAt,
      metrics.closedAt,
      metrics.timeToAssignSeconds,
      metrics.timeToArrivalSeconds,
      metrics.totalDurationSeconds,
      incident.location?.lat || null,
      incident.location?.lon || null,
      null, // distance_miles - calculated separately
      region,
      metrics.escalated,
      dateKey,
      hourKey,
    ]
  );

  logger.info('Incident fact upserted', {
    incidentId: incident.incidentId,
    status: incident.status,
  });
}

/**
 * Upsert vendor dimension record
 */
export async function upsertVendorDimension(vendor: VendorRecord): Promise<void> {
  logger.info('Upserting vendor dimension', { vendorId: vendor.vendorId });

  // Determine region from coverage area
  const region = vendor.coverageArea
    ? determineRegion(vendor.coverageArea.center.lat, vendor.coverageArea.center.lon)
    : null;

  await query(
    `INSERT INTO dim_vendors (
      vendor_id, business_name, contact_name, phone, email,
      capabilities, region, coverage_radius_miles,
      avg_rating, total_jobs, acceptance_rate, completion_rate, avg_response_time_seconds,
      active, verified_at, created_at, updated_at, synced_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11, $12, $13,
      $14, $15, $16, $17, NOW()
    )
    ON CONFLICT (vendor_id) DO UPDATE SET
      business_name = EXCLUDED.business_name,
      contact_name = EXCLUDED.contact_name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      capabilities = EXCLUDED.capabilities,
      region = EXCLUDED.region,
      coverage_radius_miles = EXCLUDED.coverage_radius_miles,
      avg_rating = EXCLUDED.avg_rating,
      total_jobs = EXCLUDED.total_jobs,
      acceptance_rate = EXCLUDED.acceptance_rate,
      completion_rate = EXCLUDED.completion_rate,
      avg_response_time_seconds = EXCLUDED.avg_response_time_seconds,
      active = EXCLUDED.active,
      updated_at = EXCLUDED.updated_at,
      synced_at = NOW()`,
    [
      vendor.vendorId,
      vendor.businessName,
      vendor.contactName || null,
      vendor.phone || null,
      vendor.email || null,
      vendor.capabilities || [],
      region,
      vendor.coverageArea?.radiusMiles || null,
      vendor.rating?.average || null,
      vendor.metrics?.totalJobs || 0,
      vendor.metrics?.acceptanceRate || null,
      vendor.metrics?.completionRate || null,
      vendor.metrics?.avgResponseTime || null,
      true, // active - determine from status if available
      null, // verified_at
      vendor.createdAt,
      vendor.updatedAt,
    ]
  );

  logger.info('Vendor dimension upserted', { vendorId: vendor.vendorId });
}

/**
 * Upsert driver dimension record
 */
export async function upsertDriverDimension(driver: DriverRecord): Promise<void> {
  logger.info('Upserting driver dimension', { driverId: driver.driverId });

  await query(
    `INSERT INTO dim_drivers (
      driver_id, user_id, name, phone, email,
      company_id, company_name, truck_number,
      region, total_incidents, avg_rating,
      active, payment_type, created_at, updated_at, synced_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12, $13, $14, $15, NOW()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      company_id = EXCLUDED.company_id,
      company_name = EXCLUDED.company_name,
      truck_number = EXCLUDED.truck_number,
      total_incidents = EXCLUDED.total_incidents,
      avg_rating = EXCLUDED.avg_rating,
      active = EXCLUDED.active,
      payment_type = EXCLUDED.payment_type,
      updated_at = EXCLUDED.updated_at,
      synced_at = NOW()`,
    [
      driver.driverId,
      driver.userId,
      driver.name,
      driver.phone || null,
      driver.email || null,
      driver.companyId || null,
      driver.companyName || null,
      driver.truckNumber || null,
      null, // region - could be derived from incidents
      driver.stats?.totalIncidents || 0,
      driver.stats?.avgRating || null,
      driver.status === 'active',
      driver.paymentType || null,
      driver.createdAt,
      driver.updatedAt,
    ]
  );

  logger.info('Driver dimension upserted', { driverId: driver.driverId });
}

/**
 * Update incident with payment information
 */
export async function updateIncidentPayment(payment: PaymentRecord): Promise<void> {
  logger.info('Updating incident payment', {
    incidentId: payment.incidentId,
    paymentId: payment.paymentId,
  });

  await query(
    `UPDATE fact_incidents
     SET payment_amount_cents = $1,
         updated_in_warehouse_at = NOW()
     WHERE incident_id = $2`,
    [payment.amountCents, payment.incidentId]
  );

  logger.info('Incident payment updated', { incidentId: payment.incidentId });
}

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Calculate incident metrics from timeline
 */
function calculateIncidentMetrics(incident: IncidentRecord): {
  assignedAt: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  closedAt: string | null;
  timeToAssignSeconds: number | null;
  timeToArrivalSeconds: number | null;
  totalDurationSeconds: number | null;
  escalated: boolean;
} {
  const timeline = incident.timeline || [];
  const createdAt = new Date(incident.createdAt);

  let assignedAt: Date | null = null;
  let arrivedAt: Date | null = null;
  let completedAt: Date | null = null;
  let closedAt: Date | null = null;
  let escalated = false;

  // Parse timeline for key events
  for (const transition of timeline) {
    const timestamp = new Date(transition.timestamp);

    if (transition.to === 'vendor_assigned' && !assignedAt) {
      assignedAt = timestamp;
    } else if (transition.to === 'vendor_arrived' && !arrivedAt) {
      arrivedAt = timestamp;
    } else if (transition.to === 'work_completed' && !completedAt) {
      completedAt = timestamp;
    } else if (transition.to === 'closed' && !closedAt) {
      closedAt = timestamp;
    }

    // Check for escalation indicators
    if (transition.reason?.includes('escalat')) {
      escalated = true;
    }
  }

  // Calculate durations
  const timeToAssignSeconds = assignedAt
    ? Math.floor((assignedAt.getTime() - createdAt.getTime()) / 1000)
    : null;

  const timeToArrivalSeconds =
    assignedAt && arrivedAt
      ? Math.floor((arrivedAt.getTime() - assignedAt.getTime()) / 1000)
      : null;

  const totalDurationSeconds =
    closedAt || completedAt
      ? Math.floor(((closedAt || completedAt)!.getTime() - createdAt.getTime()) / 1000)
      : null;

  return {
    assignedAt: assignedAt?.toISOString() || null,
    arrivedAt: arrivedAt?.toISOString() || null,
    completedAt: completedAt?.toISOString() || null,
    closedAt: closedAt?.toISOString() || null,
    timeToAssignSeconds,
    timeToArrivalSeconds,
    totalDurationSeconds,
    escalated,
  };
}

/**
 * Get date key from date (YYYYMMDD format)
 */
function getDateKey(date: Date): number {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
}

/**
 * Determine region from coordinates (simplified)
 * In production, use proper geocoding service
 */
function determineRegion(lat: number, lon: number): string {
  // Simplified US region determination
  if (lat > 40 && lon < -95) return 'Northwest';
  if (lat > 40 && lon >= -95) return 'Northeast';
  if (lat <= 40 && lon < -95) return 'Southwest';
  if (lat <= 40 && lon >= -95) return 'Southeast';
  return 'Unknown';
}

/**
 * Refresh materialized views
 */
export async function refreshMaterializedViews(): Promise<void> {
  logger.info('Refreshing materialized views');

  try {
    await query('SELECT refresh_all_materialized_views()');
    logger.info('Materialized views refreshed successfully');
  } catch (error) {
    logger.error('Failed to refresh materialized views', error as Error);
    throw error;
  }
}
