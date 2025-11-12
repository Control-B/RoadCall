import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { query } from './db-connection';
import { logger } from '@roadcall/utils';
import { KPIFilters } from './kpi-service';

// ========================================================================
// Types
// ========================================================================

export type ExportFormat = 'csv' | 'parquet' | 'json';

export interface ExportRequest {
  type: 'incidents' | 'vendors' | 'drivers' | 'kpis';
  format: ExportFormat;
  filters?: KPIFilters;
  s3Bucket: string;
  s3KeyPrefix?: string;
}

export interface ExportResult {
  s3Bucket: string;
  s3Key: string;
  recordCount: number;
  fileSizeBytes: number;
  exportedAt: string;
}

// ========================================================================
// Export Functions
// ========================================================================

const s3Client = new S3Client({});

/**
 * Export data to S3
 */
export async function exportToS3(request: ExportRequest): Promise<ExportResult> {
  logger.info('Starting data export', {
    type: request.type,
    format: request.format,
    bucket: request.s3Bucket,
  });

  // Get data based on type
  const data = await fetchDataForExport(request.type, request.filters);

  // Convert to requested format
  const content = await convertToFormat(data, request.format);

  // Generate S3 key
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const s3Key = `${request.s3KeyPrefix || 'exports'}/${request.type}/${timestamp}.${request.format}`;

  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: request.s3Bucket,
      Key: s3Key,
      Body: content,
      ContentType: getContentType(request.format),
      Metadata: {
        exportType: request.type,
        exportedAt: new Date().toISOString(),
        recordCount: data.length.toString(),
      },
    })
  );

  const result: ExportResult = {
    s3Bucket: request.s3Bucket,
    s3Key,
    recordCount: data.length,
    fileSizeBytes: Buffer.byteLength(content),
    exportedAt: new Date().toISOString(),
  };

  logger.info('Data export completed', {
    s3Bucket: result.s3Bucket,
    s3Key: result.s3Key,
    recordCount: result.recordCount,
  });

  return result;
}

/**
 * Fetch data for export based on type
 */
async function fetchDataForExport(
  type: string,
  filters?: KPIFilters
): Promise<Record<string, any>[]> {
  const whereClause = buildWhereClause(filters);

  switch (type) {
    case 'incidents':
      return fetchIncidents(whereClause);
    case 'vendors':
      return fetchVendors(whereClause);
    case 'drivers':
      return fetchDrivers(whereClause);
    case 'kpis':
      return fetchKPIs(whereClause);
    default:
      throw new Error(`Unknown export type: ${type}`);
  }
}

/**
 * Fetch incidents for export
 */
async function fetchIncidents(whereClause: string): Promise<Record<string, any>[]> {
  const result = await query(
    `SELECT
      f.incident_id,
      f.driver_id,
      d.name as driver_name,
      d.company_name,
      f.vendor_id,
      v.business_name as vendor_name,
      f.incident_type,
      f.status,
      f.created_at,
      f.assigned_at,
      f.arrived_at,
      f.completed_at,
      f.closed_at,
      f.time_to_assign_seconds,
      f.time_to_arrival_seconds,
      f.total_duration_seconds,
      f.driver_lat,
      f.driver_lon,
      f.distance_miles,
      f.region,
      f.payment_amount_cents / 100.0 as payment_amount,
      f.driver_rating,
      f.vendor_rating,
      f.resolution_type,
      f.escalated
    FROM fact_incidents f
    LEFT JOIN dim_drivers d ON f.driver_id = d.driver_id
    LEFT JOIN dim_vendors v ON f.vendor_id = v.vendor_id
    ${whereClause}
    ORDER BY f.created_at DESC`
  );

  return result.rows;
}

/**
 * Fetch vendors for export
 */
async function fetchVendors(whereClause: string): Promise<Record<string, any>[]> {
  const result = await query(
    `SELECT
      vendor_id,
      business_name,
      contact_name,
      phone,
      email,
      capabilities,
      region,
      coverage_radius_miles,
      avg_rating,
      total_jobs,
      acceptance_rate,
      completion_rate,
      avg_response_time_seconds,
      active,
      verified_at,
      created_at,
      updated_at
    FROM dim_vendors
    ${whereClause}
    ORDER BY business_name`
  );

  return result.rows;
}

/**
 * Fetch drivers for export
 */
async function fetchDrivers(whereClause: string): Promise<Record<string, any>[]> {
  const result = await query(
    `SELECT
      driver_id,
      user_id,
      name,
      phone,
      email,
      company_id,
      company_name,
      truck_number,
      region,
      total_incidents,
      avg_rating,
      active,
      payment_type,
      created_at,
      updated_at
    FROM dim_drivers
    ${whereClause}
    ORDER BY name`
  );

  return result.rows;
}

/**
 * Fetch KPIs for export
 */
async function fetchKPIs(whereClause: string): Promise<Record<string, any>[]> {
  const result = await query(
    `SELECT
      d.date,
      k.total_incidents,
      k.completed_incidents,
      k.escalated_incidents,
      k.avg_time_to_assign_seconds,
      k.avg_time_to_arrival_seconds,
      k.avg_total_duration_seconds,
      k.avg_payment_amount_cents / 100.0 as avg_payment_amount,
      k.avg_driver_rating,
      k.avg_vendor_rating,
      k.p95_time_to_assign,
      k.p95_time_to_arrival
    FROM mv_daily_kpis k
    JOIN dim_date d ON k.date_key = d.date_key
    ${whereClause.replace('WHERE', 'WHERE d.')}
    ORDER BY d.date DESC`
  );

  return result.rows;
}

/**
 * Convert data to requested format
 */
async function convertToFormat(data: Record<string, any>[], format: ExportFormat): Promise<string> {
  switch (format) {
    case 'csv':
      return convertToCSV(data);
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'parquet':
      // Parquet conversion would require additional library (e.g., parquetjs)
      // For now, fall back to JSON
      logger.warn('Parquet format not yet implemented, using JSON');
      return JSON.stringify(data, null, 2);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: Record<string, any>[]): string {
  if (data.length === 0) {
    return '';
  }

  // Get headers from first row
  const headers = Object.keys(data[0]);

  // Create CSV header row
  const headerRow = headers.map(escapeCSVValue).join(',');

  // Create data rows
  const dataRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        return escapeCSVValue(value);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Escape CSV value
 */
function escapeCSVValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Convert arrays to JSON strings
  if (Array.isArray(value)) {
    value = JSON.stringify(value);
  }

  // Convert objects to JSON strings
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }

  const stringValue = String(value);

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Get content type for format
 */
function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'parquet':
      return 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Build WHERE clause from filters
 */
function buildWhereClause(filters?: KPIFilters): string {
  if (!filters) {
    return '';
  }

  const conditions: string[] = [];

  if (filters.startDate) {
    conditions.push(`created_at >= '${filters.startDate}'`);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= '${filters.endDate}'`);
  }

  if (filters.region) {
    conditions.push(`region = '${filters.region}'`);
  }

  if (filters.incidentType) {
    conditions.push(`incident_type = '${filters.incidentType}'`);
  }

  if (filters.companyId) {
    conditions.push(`company_id = '${filters.companyId}'`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}
