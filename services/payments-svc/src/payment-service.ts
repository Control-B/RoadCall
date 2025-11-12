import { v4 as uuidv4 } from 'uuid';
import { PoolClient } from 'pg';
import { query, transaction } from './db-connection';
import { logger, NotFoundError, ValidationError, ConflictError } from '@roadcall/utils';

// ========================================================================
// Types
// ========================================================================

export type PaymentStatus =
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type PayerType = 'back_office' | 'driver_ic';

export type FraudStatus = 'low_risk' | 'medium_risk' | 'high_risk' | 'flagged';

export type ActorType = 'user' | 'system' | 'admin';

export interface Payment {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  payerType: PayerType;
  payerId?: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  fraudScore?: number;
  fraudStatus?: FraudStatus;
  approvedBy?: string;
  approvedAt?: string;
  processedAt?: string;
  failedReason?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentLineItem {
  lineItemId: string;
  paymentId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  createdAt: string;
}

export interface PaymentAuditLog {
  logId: string;
  paymentId: string;
  action: string;
  actorId: string;
  actorType: ActorType;
  previousStatus?: PaymentStatus;
  newStatus?: PaymentStatus;
  notes?: string;
  timestamp: string;
}

export interface CreatePaymentInput {
  incidentId: string;
  vendorId: string;
  payerType: PayerType;
  payerId?: string;
  amountCents: number;
  currency?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentInput {
  status?: PaymentStatus;
  stripePaymentIntentId?: string;
  fraudScore?: number;
  fraudStatus?: FraudStatus;
  approvedBy?: string;
  failedReason?: string;
  metadata?: Record<string, any>;
}

// ========================================================================
// Payment CRUD Operations
// ========================================================================

/**
 * Create a new payment record with line items
 */
export async function createPayment(
  input: CreatePaymentInput,
  actorId: string,
  actorType: ActorType = 'system'
): Promise<Payment> {
  // Validate input
  if (input.amountCents < 0) {
    throw new ValidationError('Amount cannot be negative');
  }

  if (input.lineItems.length === 0) {
    throw new ValidationError('At least one line item is required');
  }

  // Calculate total from line items
  const calculatedTotal = input.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );

  if (calculatedTotal !== input.amountCents) {
    throw new ValidationError(
      `Amount mismatch: provided ${input.amountCents}, calculated ${calculatedTotal}`
    );
  }

  return transaction(async (client: PoolClient) => {
    const paymentId = uuidv4();
    const now = new Date().toISOString();

    // Insert payment
    const paymentResult = await client.query(
      `INSERT INTO payments (
        payment_id, incident_id, vendor_id, payer_type, payer_id,
        amount_cents, currency, status, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        paymentId,
        input.incidentId,
        input.vendorId,
        input.payerType,
        input.payerId || null,
        input.amountCents,
        input.currency || 'USD',
        'pending_approval',
        JSON.stringify(input.metadata || {}),
        now,
        now,
      ]
    );

    const payment = mapPaymentFromDb(paymentResult.rows[0]);

    // Insert line items
    for (const item of input.lineItems) {
      const lineItemId = uuidv4();
      const totalCents = item.quantity * item.unitPriceCents;

      await client.query(
        `INSERT INTO payment_line_items (
          line_item_id, payment_id, description, quantity, unit_price_cents, total_cents
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [lineItemId, paymentId, item.description, item.quantity, item.unitPriceCents, totalCents]
      );
    }

    // Create audit log entry
    await createAuditLog(
      client,
      paymentId,
      'payment_created',
      actorId,
      actorType,
      undefined,
      'pending_approval',
      'Payment record created'
    );

    logger.info('Payment created', {
      paymentId,
      incidentId: input.incidentId,
      vendorId: input.vendorId,
      amountCents: input.amountCents,
      lineItemCount: input.lineItems.length,
    });

    return payment;
  });
}

/**
 * Get payment by ID with line items
 */
export async function getPaymentById(
  paymentId: string
): Promise<{ payment: Payment; lineItems: PaymentLineItem[] } | null> {
  const paymentResult = await query(
    'SELECT * FROM payments WHERE payment_id = $1',
    [paymentId]
  );

  if (paymentResult.rows.length === 0) {
    return null;
  }

  const payment = mapPaymentFromDb(paymentResult.rows[0]);

  const lineItemsResult = await query(
    'SELECT * FROM payment_line_items WHERE payment_id = $1 ORDER BY created_at',
    [paymentId]
  );

  const lineItems = lineItemsResult.rows.map(mapLineItemFromDb);

  return { payment, lineItems };
}

/**
 * Get payment by incident ID
 */
export async function getPaymentByIncidentId(incidentId: string): Promise<Payment | null> {
  const result = await query(
    'SELECT * FROM payments WHERE incident_id = $1 ORDER BY created_at DESC LIMIT 1',
    [incidentId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapPaymentFromDb(result.rows[0]);
}

/**
 * Update payment
 */
export async function updatePayment(
  paymentId: string,
  input: UpdatePaymentInput,
  actorId: string,
  actorType: ActorType = 'system'
): Promise<Payment> {
  return transaction(async (client: PoolClient) => {
    // Get current payment
    const currentResult = await client.query(
      'SELECT * FROM payments WHERE payment_id = $1 FOR UPDATE',
      [paymentId]
    );

    if (currentResult.rows.length === 0) {
      throw new NotFoundError('Payment', paymentId);
    }

    const currentPayment = mapPaymentFromDb(currentResult.rows[0]);

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
    }

    if (input.stripePaymentIntentId !== undefined) {
      updates.push(`stripe_payment_intent_id = $${paramIndex++}`);
      values.push(input.stripePaymentIntentId);
    }

    if (input.fraudScore !== undefined) {
      updates.push(`fraud_score = $${paramIndex++}`);
      values.push(input.fraudScore);
    }

    if (input.fraudStatus !== undefined) {
      updates.push(`fraud_status = $${paramIndex++}`);
      values.push(input.fraudStatus);
    }

    if (input.approvedBy !== undefined) {
      updates.push(`approved_by = $${paramIndex++}, approved_at = NOW()`);
      values.push(input.approvedBy);
    }

    if (input.failedReason !== undefined) {
      updates.push(`failed_reason = $${paramIndex++}`);
      values.push(input.failedReason);
    }

    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    if (input.status === 'processing') {
      updates.push(`processed_at = NOW()`);
    }

    if (updates.length === 0) {
      return currentPayment;
    }

    // Add payment_id to values
    values.push(paymentId);

    const updateQuery = `
      UPDATE payments 
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE payment_id = $${paramIndex}
      RETURNING *
    `;

    const result = await client.query(updateQuery, values);
    const updatedPayment = mapPaymentFromDb(result.rows[0]);

    // Create audit log entry
    const action = input.status ? `status_changed_to_${input.status}` : 'payment_updated';
    await createAuditLog(
      client,
      paymentId,
      action,
      actorId,
      actorType,
      currentPayment.status,
      input.status,
      input.failedReason
    );

    logger.info('Payment updated', {
      paymentId,
      previousStatus: currentPayment.status,
      newStatus: input.status,
      actorId,
    });

    return updatedPayment;
  });
}

/**
 * Approve payment
 */
export async function approvePayment(
  paymentId: string,
  approvedBy: string
): Promise<Payment> {
  return transaction(async (client: PoolClient) => {
    // Get current payment
    const currentResult = await client.query(
      'SELECT * FROM payments WHERE payment_id = $1 FOR UPDATE',
      [paymentId]
    );

    if (currentResult.rows.length === 0) {
      throw new NotFoundError('Payment', paymentId);
    }

    const currentPayment = mapPaymentFromDb(currentResult.rows[0]);

    // Validate status
    if (currentPayment.status !== 'pending_approval') {
      throw new ConflictError(
        `Payment cannot be approved from status: ${currentPayment.status}`
      );
    }

    // Update payment
    const result = await client.query(
      `UPDATE payments 
       SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE payment_id = $2
       RETURNING *`,
      [approvedBy, paymentId]
    );

    const updatedPayment = mapPaymentFromDb(result.rows[0]);

    // Create audit log entry
    await createAuditLog(
      client,
      paymentId,
      'payment_approved',
      approvedBy,
      'user',
      'pending_approval',
      'approved',
      'Payment approved for processing'
    );

    logger.info('Payment approved', {
      paymentId,
      approvedBy,
      amountCents: updatedPayment.amountCents,
    });

    return updatedPayment;
  });
}

/**
 * Get pending approvals
 */
export async function getPendingApprovals(
  limit: number = 50,
  offset: number = 0
): Promise<Payment[]> {
  const result = await query(
    `SELECT * FROM payments 
     WHERE status = 'pending_approval' 
     ORDER BY created_at ASC 
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  return result.rows.map(mapPaymentFromDb);
}

/**
 * Get payments by vendor
 */
export async function getPaymentsByVendor(
  vendorId: string,
  status?: PaymentStatus,
  limit: number = 50,
  offset: number = 0
): Promise<Payment[]> {
  let queryText = 'SELECT * FROM payments WHERE vendor_id = $1';
  const params: any[] = [vendorId];

  if (status) {
    queryText += ' AND status = $2';
    params.push(status);
  }

  queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  params.push(limit, offset);

  const result = await query(queryText, params);
  return result.rows.map(mapPaymentFromDb);
}

/**
 * Get audit log for payment
 */
export async function getPaymentAuditLog(paymentId: string): Promise<PaymentAuditLog[]> {
  const result = await query(
    'SELECT * FROM payment_audit_log WHERE payment_id = $1 ORDER BY timestamp DESC',
    [paymentId]
  );

  return result.rows.map(mapAuditLogFromDb);
}

// ========================================================================
// Helper Functions
// ========================================================================

/**
 * Create audit log entry
 */
async function createAuditLog(
  client: PoolClient,
  paymentId: string,
  action: string,
  actorId: string,
  actorType: ActorType,
  previousStatus?: PaymentStatus,
  newStatus?: PaymentStatus,
  notes?: string
): Promise<void> {
  const logId = uuidv4();

  await client.query(
    `INSERT INTO payment_audit_log (
      log_id, payment_id, action, actor_id, actor_type,
      previous_status, new_status, notes, timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
    [logId, paymentId, action, actorId, actorType, previousStatus || null, newStatus || null, notes || null]
  );
}

/**
 * Map database row to Payment object
 */
function mapPaymentFromDb(row: any): Payment {
  return {
    paymentId: row.payment_id,
    incidentId: row.incident_id,
    vendorId: row.vendor_id,
    payerType: row.payer_type,
    payerId: row.payer_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    fraudScore: row.fraud_score ? parseFloat(row.fraud_score) : undefined,
    fraudStatus: row.fraud_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at?.toISOString(),
    processedAt: row.processed_at?.toISOString(),
    failedReason: row.failed_reason,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Map database row to PaymentLineItem object
 */
function mapLineItemFromDb(row: any): PaymentLineItem {
  return {
    lineItemId: row.line_item_id,
    paymentId: row.payment_id,
    description: row.description,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Map database row to PaymentAuditLog object
 */
function mapAuditLogFromDb(row: any): PaymentAuditLog {
  return {
    logId: row.log_id,
    paymentId: row.payment_id,
    action: row.action,
    actorId: row.actor_id,
    actorType: row.actor_type,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    notes: row.notes,
    timestamp: row.timestamp.toISOString(),
  };
}
