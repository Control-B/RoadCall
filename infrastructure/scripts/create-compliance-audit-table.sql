-- Compliance audit log table for tracking data retention and GDPR actions
-- Retention: 7 years (requirement 11.3)

CREATE TABLE IF NOT EXISTS compliance_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  reason TEXT,
  actor_id UUID,
  actor_type VARCHAR(20),
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_compliance_audit_user_id ON compliance_audit_log(user_id);
CREATE INDEX idx_compliance_audit_action ON compliance_audit_log(action);
CREATE INDEX idx_compliance_audit_timestamp ON compliance_audit_log(timestamp DESC);

-- Add comments
COMMENT ON TABLE compliance_audit_log IS 'Audit log for compliance actions (GDPR, data retention). Retained for 7 years.';
COMMENT ON COLUMN compliance_audit_log.action IS 'Action type: RIGHT_TO_BE_FORGOTTEN, DATA_EXPORT, PII_DELETION, CONSENT_UPDATED';
COMMENT ON COLUMN compliance_audit_log.user_id IS 'User whose data was affected';
COMMENT ON COLUMN compliance_audit_log.actor_id IS 'User who performed the action (may be same as user_id or admin)';

-- Create partition for efficient archival (partition by year)
CREATE TABLE compliance_audit_log_2025 PARTITION OF compliance_audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE compliance_audit_log_2026 PARTITION OF compliance_audit_log
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Function to automatically create new partitions
CREATE OR REPLACE FUNCTION create_compliance_audit_partition()
RETURNS void AS $$
DECLARE
  current_year INTEGER;
  next_year INTEGER;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  next_year := current_year + 1;
  partition_name := 'compliance_audit_log_' || next_year;
  start_date := next_year || '-01-01';
  end_date := (next_year + 1) || '-01-01';
  
  -- Check if partition already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF compliance_audit_log FOR VALUES FROM (%L) TO (%L)',
      partition_name, start_date, end_date
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (run annually)
-- Note: This would typically be handled by a scheduled Lambda or cron job
