# Reporting Service (reporting-svc)

The reporting service provides business intelligence, analytics, and data export capabilities for the AI Roadcall Assistant platform.

## Features

- **Data Warehouse**: Star schema with fact and dimension tables in Aurora Postgres
- **ETL Pipeline**: Real-time data ingestion from DynamoDB Streams
- **KPI Calculation**: Operational, financial, quality, and system metrics
- **Analytics APIs**: REST endpoints for reports and dashboards
- **Data Export**: Export data to S3 in CSV, JSON, or Parquet format
- **CloudWatch Metrics**: Real-time KPI publishing for monitoring
- **Materialized Views**: Pre-aggregated data for fast queries

## Architecture

### Data Warehouse Schema

**Fact Table**: `fact_incidents`
- Stores incident metrics and dimensions
- Indexed by driver, vendor, company, status, type, date, region

**Dimension Tables**:
- `dim_vendors`: Vendor profiles and metrics
- `dim_drivers`: Driver profiles and metrics
- `dim_date`: Date dimension for time-based analysis

**Materialized Views**:
- `mv_daily_kpis`: Daily KPI aggregations
- `mv_vendor_performance`: Vendor performance metrics
- `mv_regional_performance`: Regional performance metrics

### ETL Pipeline

```
DynamoDB Streams → Lambda ETL → Transform → Aurora Postgres
                                    ↓
                            CloudWatch Metrics
```

1. DynamoDB Streams capture changes to Incidents, Vendors, Drivers, Payments
2. Lambda function processes stream records
3. Data is transformed and loaded into warehouse
4. Materialized views are refreshed every 5 minutes
5. KPIs are published to CloudWatch every 5 minutes

## API Endpoints

### GET /reports/kpis

Get KPI summary for a given period.

**Query Parameters**:
- `startDate` (optional): Start date (ISO 8601)
- `endDate` (optional): End date (ISO 8601)
- `region` (optional): Filter by region
- `incidentType` (optional): Filter by incident type
- `companyId` (optional): Filter by company

**Response**:
```json
{
  "data": {
    "timeToAssignSeconds": 120,
    "timeToArrivalSeconds": 1800,
    "firstAttemptResolutionRate": 0.85,
    "vendorAcceptanceRate": 0.75,
    "costPerIncident": 250.00,
    "revenuePerVendor": 15000.00,
    "paymentApprovalTimeSeconds": 3600,
    "driverSatisfaction": 4.5,
    "vendorRating": 4.7,
    "incidentResolutionRate": 0.92,
    "apiLatencyP95": 250,
    "systemUptime": 99.95,
    "errorRate": 0.5
  }
}
```

### GET /reports/incidents

Get incident analytics for a given period.

**Query Parameters**:
- `from` or `startDate` (optional): Start date
- `to` or `endDate` (optional): End date
- `region` (optional): Filter by region
- `type` or `incidentType` (optional): Filter by incident type
- `companyId` (optional): Filter by company

**Response**:
```json
{
  "data": {
    "totalIncidents": 1000,
    "completedIncidents": 920,
    "escalatedIncidents": 50,
    "avgTimeToAssignSeconds": 120,
    "avgTimeToArrivalSeconds": 1800,
    "avgTotalDurationSeconds": 3600,
    "incidentsByType": {
      "tire": 400,
      "engine": 350,
      "tow": 250
    },
    "incidentsByStatus": {
      "closed": 920,
      "work_in_progress": 50,
      "vendor_en_route": 30
    },
    "incidentsByRegion": {
      "Northeast": 300,
      "Southeast": 250,
      "Northwest": 200,
      "Southwest": 250
    },
    "incidentsByHour": {
      "0": 20,
      "1": 15,
      ...
    }
  }
}
```

### GET /reports/vendors/{id}/performance

Get vendor performance report.

**Path Parameters**:
- `id` (optional): Vendor ID (omit to get all vendors)

**Query Parameters**:
- `startDate` (optional): Start date
- `endDate` (optional): End date
- `region` (optional): Filter by region

**Response**:
```json
{
  "data": {
    "vendorId": "vendor-123",
    "businessName": "ABC Towing",
    "region": "Northeast",
    "totalJobs": 150,
    "avgRating": 4.7,
    "avgResponseTimeSeconds": 1800,
    "completionRate": 0.95,
    "totalRevenueCents": 3750000,
    "acceptanceRate": 0.80
  }
}
```

### POST /reports/export

Export data to S3 in CSV/Parquet format.

**Request Body**:
```json
{
  "type": "incidents",
  "format": "csv",
  "filters": {
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "region": "Northeast"
  },
  "s3Bucket": "roadcall-exports",
  "s3KeyPrefix": "reports"
}
```

**Response**:
```json
{
  "data": {
    "s3Bucket": "roadcall-exports",
    "s3Key": "reports/incidents/2024-11-11T12-00-00-000Z.csv",
    "recordCount": 1000,
    "fileSizeBytes": 524288,
    "exportedAt": "2024-11-11T12:00:00.000Z"
  }
}
```

## Environment Variables

- `DB_HOST`: Aurora Postgres host
- `DB_PORT`: Database port (default: 5432)
- `DB_NAME`: Database name (default: roadcall_analytics)
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_POOL_MAX`: Max connections in pool (default: 20)
- `EXPORT_BUCKET`: S3 bucket for data exports
- `AWS_REGION`: AWS region

## Database Setup

### Initialize Schema

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f src/schema.sql
```

### Populate Date Dimension

The date dimension is automatically populated for 5 years (2 years past + 3 years future) when the schema is created.

To manually populate additional dates:

```sql
SELECT populate_dim_date('2024-01-01', '2029-12-31');
```

### Refresh Materialized Views

Materialized views are automatically refreshed every 5 minutes by the `refresh-views` Lambda function.

To manually refresh:

```sql
SELECT refresh_all_materialized_views();
```

## CloudWatch Metrics

The service publishes the following custom metrics to CloudWatch:

- `TimeToAssign` (Seconds)
- `TimeToArrival` (Seconds)
- `FirstAttemptResolutionRate` (Percent)
- `VendorAcceptanceRate` (Percent)
- `CostPerIncident` (None)
- `DriverSatisfaction` (None)
- `VendorRating` (None)
- `IncidentResolutionRate` (Percent)

Metrics are published every 5 minutes by the `publish-metrics` Lambda function.

## QuickSight Integration

The data warehouse can be connected to Amazon QuickSight for interactive dashboards:

1. Create a QuickSight data source pointing to Aurora Postgres
2. Create datasets from fact and dimension tables
3. Use materialized views for pre-aggregated data
4. Build dashboards for:
   - Executive KPI dashboard
   - Operational metrics
   - Vendor performance
   - Regional analysis
   - Financial reports

## Development

### Build

```bash
pnpm build
```

### Type Check

```bash
pnpm typecheck
```

### Lint

```bash
pnpm lint
```

### Test

```bash
pnpm test
```

## Deployment

The service is deployed as part of the CDK infrastructure stack. See `infrastructure/lib/reporting-stack.ts` for deployment configuration.

## Performance Considerations

- **Materialized Views**: Refresh every 5 minutes for fast queries
- **Indexes**: Comprehensive indexes on fact and dimension tables
- **Connection Pooling**: Reuse database connections across Lambda invocations
- **Read Replicas**: Use Aurora read replicas for reporting queries
- **Partitioning**: Consider partitioning fact_incidents by date for large datasets

## Monitoring

- CloudWatch Logs: All Lambda functions log to CloudWatch
- CloudWatch Metrics: Custom KPI metrics published every 5 minutes
- X-Ray Tracing: Distributed tracing enabled for all Lambda functions
- Database Metrics: Aurora CloudWatch metrics for performance monitoring
