-- Payments Service Database Schema
-- Aurora Postgres Database

-- ========================================================================
-- Payments Table
-- ========================================================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id UUID PRIMARY KEY,
  incident_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  payer_type VARCHAR(20) NOT NULL CHECK (payer_type IN ('back_office', 'driver_ic')),
  payer_id UUID,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending_approval', 'approved', 'processing', 'completed', 'failed', 'cancelled')),
  stripe_payment_intent_id VARCHAR(255),
  fraud_score DECIMAL(3,2),
  fraud_status VARCHAR(20) CHECK (fraud_status IN ('low_risk', 'medium_risk', 'high_risk', 'flagged')),
  approved_by UUID,
  approved_at TIMESTAMP,
  processed_at TIMESTAMP,
  failed_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payments table
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_incident ON payments(incident_id);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id) WHERE payer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_fraud_status ON payments(fraud_status) WHERE fraud_status IN ('high_risk', 'flagged');

-- ========================================================================
-- Payment Line Items Table
-- ========================================================================
CREATE TABLE IF NOT EXISTS payment_line_items (
  line_item_id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
  description VARCHAR(255) NOT NULL,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for line items
CREATE INDEX IF NOT EXISTS idx_line_items_payment ON payment_line_items(payment_id);

-- ========================================================================
-- Payment Audit Log Table
-- ========================================================================
CREATE TABLE IF NOT EXISTS payment_audit_log (
  log_id UUID PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES payments(payment_id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  actor_id UUID NOT NULL,
  actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('user', 'system', 'admin')),
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  notes TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_payment ON payment_audit_log(payment_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON payment_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON payment_audit_log(actor_id);

-- ========================================================================
-- Triggers for updated_at timestamp
-- ========================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================================================
-- Views for common queries
-- ========================================================================

-- Pending approvals view
CREATE OR REPLACE VIEW pending_approvals AS
SELECT 
  p.payment_id,
  p.incident_id,
  p.vendor_id,
  p.amount_cents,
  p.created_at,
  p.metadata,
  COUNT(pli.line_item_id) as line_item_count
FROM payments p
LEFT JOIN payment_line_items pli ON p.payment_id = pli.payment_id
WHERE p.status = 'pending_approval'
GROUP BY p.payment_id, p.incident_id, p.vendor_id, p.amount_cents, p.created_at, p.metadata
ORDER BY p.created_at ASC;

-- Payment summary view
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
  p.payment_id,
  p.incident_id,
  p.vendor_id,
  p.status,
  p.amount_cents,
  p.created_at,
  p.approved_at,
  p.processed_at,
  p.fraud_score,
  p.fraud_status,
  COUNT(pli.line_item_id) as line_item_count,
  COUNT(pal.log_id) as audit_log_count
FROM payments p
LEFT JOIN payment_line_items pli ON p.payment_id = pli.payment_id
LEFT JOIN payment_audit_log pal ON p.payment_id = pal.payment_id
GROUP BY p.payment_id, p.incident_id, p.vendor_id, p.status, p.amount_cents, 
         p.created_at, p.approved_at, p.processed_at, p.fraud_score, p.fraud_status;

-- ========================================================================
-- Comments for documentation
-- ========================================================================
COMMENT ON TABLE payments IS 'Stores payment records for vendor services';
COMMENT ON TABLE payment_line_items IS 'Itemized breakdown of payment charges';
COMMENT ON TABLE payment_audit_log IS 'Audit trail of all payment actions';

COMMENT ON COLUMN payments.payer_type IS 'Type of payer: back_office (company pays) or driver_ic (independent contractor pays directly)';
COMMENT ON COLUMN payments.fraud_score IS 'Fraud detection score from 0.00 to 1.00';
COMMENT ON COLUMN payments.metadata IS 'Additional payment metadata in JSON format';
