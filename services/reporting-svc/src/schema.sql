-- ============================================================================
-- AI Roadcall Assistant - Reporting Data Warehouse Schema
-- ============================================================================

-- ============================================================================
-- Fact Table: Incidents
-- ============================================================================

CREATE TABLE IF NOT EXISTS fact_incidents (
  incident_id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  vendor_id UUID,
  company_id UUID,
  incident_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  assigned_at TIMESTAMP,
  arrived_at TIMESTAMP,
  completed_at TIMESTAMP,
  closed_at TIMESTAMP,
  
  -- Calculated metrics (in seconds)
  time_to_assign_seconds INTEGER,
  time_to_arrival_seconds INTEGER,
  total_duration_seconds INTEGER,
  
  -- Location and distance
  driver_lat DECIMAL(10, 7),
  driver_lon DECIMAL(10, 7),
  distance_miles DECIMAL(10, 2),
  region VARCHAR(50),
  
  -- Financial
  payment_amount_cents INTEGER,
  
  -- Quality metrics
  driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
  vendor_rating INTEGER CHECK (vendor_rating BETWEEN 1 AND 5),
  
  -- Resolution
  resolution_type VARCHAR(20),
  escalated BOOLEAN DEFAULT FALSE,
  
  -- Dimension keys
  date_key INTEGER NOT NULL,
  hour_key INTEGER NOT NULL,
  
  -- Metadata
  created_in_warehouse_at TIMESTAMP DEFAULT NOW(),
  updated_in_warehouse_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fact_incidents
CREATE INDEX IF NOT EXISTS idx_fact_incidents_driver ON fact_incidents(driver_id);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_vendor ON fact_incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_company ON fact_incidents(company_id);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_status ON fact_incidents(status);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_type ON fact_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_date ON fact_incidents(date_key);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_created ON fact_incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_fact_incidents_region ON fact_incidents(region);

-- ============================================================================
-- Dimension Table: Vendors
-- ============================================================================

CREATE TABLE IF NOT EXISTS dim_vendors (
  vendor_id UUID PRIMARY KEY,
  business_name VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Capabilities (stored as array)
  capabilities TEXT[],
  
  -- Location
  region VARCHAR(50),
  coverage_radius_miles INTEGER,
  
  -- Metrics
  avg_rating DECIMAL(3, 2),
  total_jobs INTEGER DEFAULT 0,
  acceptance_rate DECIMAL(5, 2),
  completion_rate DECIMAL(5, 2),
  avg_response_time_seconds INTEGER,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for dim_vendors
CREATE INDEX IF NOT EXISTS idx_dim_vendors_region ON dim_vendors(region);
CREATE INDEX IF NOT EXISTS idx_dim_vendors_active ON dim_vendors(active);
CREATE INDEX IF NOT EXISTS idx_dim_vendors_rating ON dim_vendors(avg_rating DESC);

-- ============================================================================
-- Dimension Table: Drivers
-- ============================================================================

CREATE TABLE IF NOT EXISTS dim_drivers (
  driver_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  
  -- Company association
  company_id UUID,
  company_name VARCHAR(255),
  truck_number VARCHAR(50),
  
  -- Location
  region VARCHAR(50),
  
  -- Metrics
  total_incidents INTEGER DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  payment_type VARCHAR(30),
  
  -- Metadata
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for dim_drivers
CREATE INDEX IF NOT EXISTS idx_dim_drivers_company ON dim_drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_dim_drivers_region ON dim_drivers(region);
CREATE INDEX IF NOT EXISTS idx_dim_drivers_active ON dim_drivers(active);

-- ============================================================================
-- Dimension Table: Date
-- ============================================================================

CREATE TABLE IF NOT EXISTS dim_date (
  date_key INTEGER PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  day_of_week VARCHAR(10) NOT NULL,
  day_of_month INTEGER NOT NULL,
  week_of_year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_name VARCHAR(10) NOT NULL,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  is_weekend BOOLEAN NOT NULL,
  is_holiday BOOLEAN DEFAULT FALSE,
  holiday_name VARCHAR(100)
);

-- Indexes for dim_date
CREATE INDEX IF NOT EXISTS idx_dim_date_date ON dim_date(date);
CREATE INDEX IF NOT EXISTS idx_dim_date_year_month ON dim_date(year, month);
CREATE INDEX IF NOT EXISTS idx_dim_date_quarter ON dim_date(year, quarter);

-- ============================================================================
-- Materialized Views for Common Aggregations
-- ============================================================================

-- Daily KPIs
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_kpis AS
SELECT
  date_key,
  COUNT(*) as total_incidents,
  COUNT(CASE WHEN status = 'closed' THEN 1 END) as completed_incidents,
  COUNT(CASE WHEN escalated = TRUE THEN 1 END) as escalated_incidents,
  AVG(time_to_assign_seconds) as avg_time_to_assign_seconds,
  AVG(time_to_arrival_seconds) as avg_time_to_arrival_seconds,
  AVG(total_duration_seconds) as avg_total_duration_seconds,
  AVG(payment_amount_cents) as avg_payment_amount_cents,
  AVG(driver_rating) as avg_driver_rating,
  AVG(vendor_rating) as avg_vendor_rating,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY time_to_assign_seconds) as p95_time_to_assign,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY time_to_arrival_seconds) as p95_time_to_arrival
FROM fact_incidents
WHERE status IN ('closed', 'work_completed')
GROUP BY date_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_kpis_date ON mv_daily_kpis(date_key);

-- Vendor Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_vendor_performance AS
SELECT
  v.vendor_id,
  v.business_name,
  v.region,
  COUNT(f.incident_id) as total_jobs,
  AVG(f.vendor_rating) as avg_rating,
  AVG(f.time_to_arrival_seconds) as avg_response_time_seconds,
  COUNT(CASE WHEN f.status = 'closed' THEN 1 END)::DECIMAL / NULLIF(COUNT(f.incident_id), 0) as completion_rate,
  SUM(f.payment_amount_cents) as total_revenue_cents
FROM dim_vendors v
LEFT JOIN fact_incidents f ON v.vendor_id = f.vendor_id
WHERE v.active = TRUE
GROUP BY v.vendor_id, v.business_name, v.region;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_vendor_performance_vendor ON mv_vendor_performance(vendor_id);

-- Regional Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_regional_performance AS
SELECT
  region,
  date_key,
  COUNT(*) as total_incidents,
  AVG(time_to_assign_seconds) as avg_time_to_assign,
  AVG(time_to_arrival_seconds) as avg_time_to_arrival,
  COUNT(DISTINCT vendor_id) as active_vendors,
  COUNT(DISTINCT driver_id) as active_drivers
FROM fact_incidents
WHERE region IS NOT NULL
GROUP BY region, date_key;

CREATE INDEX IF NOT EXISTS idx_mv_regional_performance ON mv_regional_performance(region, date_key);

-- ============================================================================
-- Functions for Refreshing Materialized Views
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_kpis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vendor_performance;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_regional_performance;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to Populate Date Dimension
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_dim_date(start_date DATE, end_date DATE)
RETURNS void AS $$
DECLARE
  current_date DATE := start_date;
BEGIN
  WHILE current_date <= end_date LOOP
    INSERT INTO dim_date (
      date_key,
      date,
      day_of_week,
      day_of_month,
      week_of_year,
      month,
      month_name,
      quarter,
      year,
      is_weekend
    ) VALUES (
      TO_CHAR(current_date, 'YYYYMMDD')::INTEGER,
      current_date,
      TO_CHAR(current_date, 'Day'),
      EXTRACT(DAY FROM current_date)::INTEGER,
      EXTRACT(WEEK FROM current_date)::INTEGER,
      EXTRACT(MONTH FROM current_date)::INTEGER,
      TO_CHAR(current_date, 'Month'),
      EXTRACT(QUARTER FROM current_date)::INTEGER,
      EXTRACT(YEAR FROM current_date)::INTEGER,
      EXTRACT(DOW FROM current_date) IN (0, 6)
    )
    ON CONFLICT (date_key) DO NOTHING;
    
    current_date := current_date + INTERVAL '1 day';
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Populate date dimension for 5 years (past 2 years + next 3 years)
SELECT populate_dim_date(
  CURRENT_DATE - INTERVAL '2 years',
  CURRENT_DATE + INTERVAL '3 years'
);

-- ============================================================================
-- Grants (adjust based on your user setup)
-- ============================================================================

-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO reporting_user;
-- GRANT SELECT ON ALL MATERIALIZED VIEWS IN SCHEMA public TO reporting_user;
