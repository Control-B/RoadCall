import { query } from './db-connection';
import { logger } from '@roadcall/utils';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

// ========================================================================
// Types
// ========================================================================

export interface KPIs {
  // Operational
  timeToAssignSeconds: number;
  timeToArrivalSeconds: number;
  firstAttemptResolutionRate: number;
  vendorAcceptanceRate: number;

  // Financial
  costPerIncident: number;
  revenuePerVendor: number;
  paymentApprovalTimeSeconds: number;

  // Quality
  driverSatisfaction: number;
  vendorRating: number;
  incidentResolutionRate: number;

  // System
  apiLatencyP95: number;
  systemUptime: number;
  errorRate: number;
}

export interface KPIFilters {
  startDate?: string;
  endDate?: string;
  region?: string;
  incidentType?: string;
  companyId?: string;
}

export interface IncidentAnalytics {
  totalIncidents: number;
  completedIncidents: number;
  escalatedIncidents: number;
  avgTimeToAssignSeconds: number;
  avgTimeToArrivalSeconds: number;
  avgTotalDurationSeconds: number;
  incidentsByType: Record<string, number>;
  incidentsByStatus: Record<string, number>;
  incidentsByRegion: Record<string, number>;
  incidentsByHour: Record<number, number>;
}

export interface VendorPerformance {
  vendorId: string;
  businessName: string;
  region: string;
  totalJobs: number;
  avgRating: number;
  avgResponseTimeSeconds: number;
  completionRate: number;
  totalRevenueCents: number;
  acceptanceRate: number;
}

// ========================================================================
// KPI Calculation Functions
// ========================================================================

/**
 * Calculate KPIs for a given period
 */
export async function calculateKPIs(filters: KPIFilters = {}): Promise<KPIs> {
  logger.info('Calculating KPIs', { filters });

  const whereClause = buildWhereClause(filters);

  // Operational metrics
  const operationalResult = await query(
    `SELECT
      AVG(time_to_assign_seconds) as avg_time_to_assign,
      AVG(time_to_arrival_seconds) as avg_time_to_arrival,
      COUNT(CASE WHEN escalated = FALSE AND status = 'closed' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN status = 'closed' THEN 1 END), 0) as first_attempt_resolution_rate
    FROM fact_incidents
    ${whereClause}
    AND status IN ('closed', 'work_completed')`
  );

  // Vendor acceptance rate (requires offers data - simplified here)
  const vendorAcceptanceRate = 0.75; // Placeholder - would query offers table

  // Financial metrics
  const financialResult = await query(
    `SELECT
      AVG(payment_amount_cents) / 100.0 as avg_cost_per_incident,
      SUM(payment_amount_cents) / NULLIF(COUNT(DISTINCT vendor_id), 0) / 100.0 as revenue_per_vendor
    FROM fact_incidents
    ${whereClause}
    AND payment_amount_cents IS NOT NULL`
  );

  // Payment approval time (would query payments table)
  const paymentApprovalTimeSeconds = 3600; // Placeholder

  // Quality metrics
  const qualityResult = await query(
    `SELECT
      AVG(driver_rating) as avg_driver_satisfaction,
      AVG(vendor_rating) as avg_vendor_rating,
      COUNT(CASE WHEN status = 'closed' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(*), 0) as incident_resolution_rate
    FROM fact_incidents
    ${whereClause}`
  );

  // System metrics (would come from CloudWatch)
  const systemMetrics = {
    apiLatencyP95: 250, // ms
    systemUptime: 99.95, // %
    errorRate: 0.5, // %
  };

  const operational = operationalResult.rows[0];
  const financial = financialResult.rows[0];
  const quality = qualityResult.rows[0];

  return {
    timeToAssignSeconds: parseFloat(operational.avg_time_to_assign) || 0,
    timeToArrivalSeconds: parseFloat(operational.avg_time_to_arrival) || 0,
    firstAttemptResolutionRate: parseFloat(operational.first_attempt_resolution_rate) || 0,
    vendorAcceptanceRate,
    costPerIncident: parseFloat(financial.avg_cost_per_incident) || 0,
    revenuePerVendor: parseFloat(financial.revenue_per_vendor) || 0,
    paymentApprovalTimeSeconds,
    driverSatisfaction: parseFloat(quality.avg_driver_satisfaction) || 0,
    vendorRating: parseFloat(quality.avg_vendor_rating) || 0,
    incidentResolutionRate: parseFloat(quality.incident_resolution_rate) || 0,
    ...systemMetrics,
  };
}

/**
 * Get incident analytics
 */
export async function getIncidentAnalytics(filters: KPIFilters = {}): Promise<IncidentAnalytics> {
  logger.info('Getting incident analytics', { filters });

  const whereClause = buildWhereClause(filters);

  // Overall metrics
  const overallResult = await query(
    `SELECT
      COUNT(*) as total_incidents,
      COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed_incidents,
      COUNT(CASE WHEN escalated = TRUE THEN 1 END) as escalated_incidents,
      AVG(time_to_assign_seconds) as avg_time_to_assign,
      AVG(time_to_arrival_seconds) as avg_time_to_arrival,
      AVG(total_duration_seconds) as avg_total_duration
    FROM fact_incidents
    ${whereClause}`
  );

  // Incidents by type
  const byTypeResult = await query(
    `SELECT incident_type, COUNT(*) as count
    FROM fact_incidents
    ${whereClause}
    GROUP BY incident_type`
  );

  // Incidents by status
  const byStatusResult = await query(
    `SELECT status, COUNT(*) as count
    FROM fact_incidents
    ${whereClause}
    GROUP BY status`
  );

  // Incidents by region
  const byRegionResult = await query(
    `SELECT region, COUNT(*) as count
    FROM fact_incidents
    ${whereClause}
    AND region IS NOT NULL
    GROUP BY region`
  );

  // Incidents by hour
  const byHourResult = await query(
    `SELECT hour_key, COUNT(*) as count
    FROM fact_incidents
    ${whereClause}
    GROUP BY hour_key
    ORDER BY hour_key`
  );

  const overall = overallResult.rows[0];

  return {
    totalIncidents: parseInt(overall.total_incidents),
    completedIncidents: parseInt(overall.completed_incidents),
    escalatedIncidents: parseInt(overall.escalated_incidents),
    avgTimeToAssignSeconds: parseFloat(overall.avg_time_to_assign) || 0,
    avgTimeToArrivalSeconds: parseFloat(overall.avg_time_to_arrival) || 0,
    avgTotalDurationSeconds: parseFloat(overall.avg_total_duration) || 0,
    incidentsByType: byTypeResult.rows.reduce(
      (acc, row) => ({ ...acc, [row.incident_type]: parseInt(row.count) }),
      {}
    ),
    incidentsByStatus: byStatusResult.rows.reduce(
      (acc, row) => ({ ...acc, [row.status]: parseInt(row.count) }),
      {}
    ),
    incidentsByRegion: byRegionResult.rows.reduce(
      (acc, row) => ({ ...acc, [row.region]: parseInt(row.count) }),
      {}
    ),
    incidentsByHour: byHourResult.rows.reduce(
      (acc, row) => ({ ...acc, [row.hour_key]: parseInt(row.count) }),
      {}
    ),
  };
}

/**
 * Get vendor performance report
 */
export async function getVendorPerformance(
  vendorId?: string,
  filters: KPIFilters = {}
): Promise<VendorPerformance[]> {
  logger.info('Getting vendor performance', { vendorId, filters });

  let whereClause = buildWhereClause(filters, 'f');

  if (vendorId) {
    whereClause += whereClause ? ` AND v.vendor_id = '${vendorId}'` : ` WHERE v.vendor_id = '${vendorId}'`;
  }

  const result = await query(
    `SELECT
      v.vendor_id,
      v.business_name,
      v.region,
      COUNT(f.incident_id) as total_jobs,
      AVG(f.vendor_rating) as avg_rating,
      AVG(f.time_to_arrival_seconds) as avg_response_time,
      COUNT(CASE WHEN f.status = 'closed' THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(f.incident_id), 0) as completion_rate,
      SUM(f.payment_amount_cents) as total_revenue_cents,
      v.acceptance_rate
    FROM dim_vendors v
    LEFT JOIN fact_incidents f ON v.vendor_id = f.vendor_id
    ${whereClause}
    GROUP BY v.vendor_id, v.business_name, v.region, v.acceptance_rate
    ORDER BY total_jobs DESC`
  );

  return result.rows.map((row) => ({
    vendorId: row.vendor_id,
    businessName: row.business_name,
    region: row.region,
    totalJobs: parseInt(row.total_jobs) || 0,
    avgRating: parseFloat(row.avg_rating) || 0,
    avgResponseTimeSeconds: parseFloat(row.avg_response_time) || 0,
    completionRate: parseFloat(row.completion_rate) || 0,
    totalRevenueCents: parseInt(row.total_revenue_cents) || 0,
    acceptanceRate: parseFloat(row.acceptance_rate) || 0,
  }));
}

/**
 * Get daily KPI trends
 */
export async function getDailyKPITrends(
  startDate: string,
  endDate: string
): Promise<Array<{ date: string; kpis: Partial<KPIs> }>> {
  logger.info('Getting daily KPI trends', { startDate, endDate });

  const result = await query(
    `SELECT
      d.date,
      k.total_incidents,
      k.completed_incidents,
      k.escalated_incidents,
      k.avg_time_to_assign_seconds,
      k.avg_time_to_arrival_seconds,
      k.avg_total_duration_seconds,
      k.avg_payment_amount_cents,
      k.avg_driver_rating,
      k.avg_vendor_rating,
      k.p95_time_to_assign,
      k.p95_time_to_arrival
    FROM mv_daily_kpis k
    JOIN dim_date d ON k.date_key = d.date_key
    WHERE d.date BETWEEN $1 AND $2
    ORDER BY d.date`,
    [startDate, endDate]
  );

  return result.rows.map((row) => ({
    date: row.date.toISOString().split('T')[0],
    kpis: {
      timeToAssignSeconds: parseFloat(row.avg_time_to_assign_seconds) || 0,
      timeToArrivalSeconds: parseFloat(row.avg_time_to_arrival_seconds) || 0,
      costPerIncident: parseFloat(row.avg_payment_amount_cents) / 100 || 0,
      driverSatisfaction: parseFloat(row.avg_driver_rating) || 0,
      vendorRating: parseFloat(row.avg_vendor_rating) || 0,
    },
  }));
}

// ========================================================================
// CloudWatch Metrics Publishing
// ========================================================================

const cloudwatch = new CloudWatchClient({});

/**
 * Publish KPIs to CloudWatch
 */
export async function publishKPIsToCloudWatch(kpis: KPIs, namespace: string = 'RoadcallAssistant'): Promise<void> {
  logger.info('Publishing KPIs to CloudWatch', { namespace });

  const timestamp = new Date();

  const metricData = [
    {
      MetricName: 'TimeToAssign',
      Value: kpis.timeToAssignSeconds,
      Unit: 'Seconds' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'TimeToArrival',
      Value: kpis.timeToArrivalSeconds,
      Unit: 'Seconds' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'FirstAttemptResolutionRate',
      Value: kpis.firstAttemptResolutionRate * 100,
      Unit: 'Percent' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'VendorAcceptanceRate',
      Value: kpis.vendorAcceptanceRate * 100,
      Unit: 'Percent' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'CostPerIncident',
      Value: kpis.costPerIncident,
      Unit: 'None' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'DriverSatisfaction',
      Value: kpis.driverSatisfaction,
      Unit: 'None' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'VendorRating',
      Value: kpis.vendorRating,
      Unit: 'None' as const,
      Timestamp: timestamp,
    },
    {
      MetricName: 'IncidentResolutionRate',
      Value: kpis.incidentResolutionRate * 100,
      Unit: 'Percent' as const,
      Timestamp: timestamp,
    },
  ];

  try {
    await cloudwatch.send(
      new PutMetricDataCommand({
        Namespace: namespace,
        MetricData: metricData,
      })
    );

    logger.info('KPIs published to CloudWatch successfully');
  } catch (error) {
    logger.error('Failed to publish KPIs to CloudWatch', error as Error);
    throw error;
  }
}

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Build WHERE clause from filters
 */
function buildWhereClause(filters: KPIFilters, tableAlias: string = ''): string {
  const conditions: string[] = [];
  const prefix = tableAlias ? `${tableAlias}.` : '';

  if (filters.startDate) {
    conditions.push(`${prefix}created_at >= '${filters.startDate}'`);
  }

  if (filters.endDate) {
    conditions.push(`${prefix}created_at <= '${filters.endDate}'`);
  }

  if (filters.region) {
    conditions.push(`${prefix}region = '${filters.region}'`);
  }

  if (filters.incidentType) {
    conditions.push(`${prefix}incident_type = '${filters.incidentType}'`);
  }

  if (filters.companyId) {
    conditions.push(`${prefix}company_id = '${filters.companyId}'`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}
