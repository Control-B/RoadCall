import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { query } from '../db-connection';
import { logger } from '@roadcall/utils';

/**
 * Lambda handler for getting flagged payments for manual review
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // Get query parameters
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const offset = parseInt(event.queryStringParameters?.offset || '0');
    const fraudStatus = event.queryStringParameters?.fraudStatus;

    // Get user context from authorizer
    const userRole = event.requestContext.authorizer?.claims?.['custom:role'];

    // Check if user has permission to view flagged payments
    if (userRole !== 'dispatcher' && userRole !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions to view flagged payments' }),
      };
    }

    // Build query
    let queryText = `
      SELECT 
        p.*,
        json_agg(
          json_build_object(
            'lineItemId', li.line_item_id,
            'description', li.description,
            'quantity', li.quantity,
            'unitPriceCents', li.unit_price_cents,
            'totalCents', li.total_cents
          )
        ) as line_items
      FROM payments p
      LEFT JOIN payment_line_items li ON p.payment_id = li.payment_id
      WHERE p.fraud_status = 'flagged'
    `;

    const params: any[] = [];

    if (fraudStatus && fraudStatus !== 'flagged') {
      queryText += ` OR p.fraud_status = $${params.length + 1}`;
      params.push(fraudStatus);
    }

    queryText += `
      GROUP BY p.payment_id
      ORDER BY p.fraud_score DESC, p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    // Execute query
    const result = await query(queryText, params);

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as total FROM payments WHERE fraud_status = 'flagged'`,
      []
    );

    const total = parseInt(countResult.rows[0]?.total || '0');

    // Format results
    const payments = result.rows.map((row) => ({
      paymentId: row.payment_id,
      incidentId: row.incident_id,
      vendorId: row.vendor_id,
      payerType: row.payer_type,
      payerId: row.payer_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      status: row.status,
      fraudScore: row.fraud_score ? parseFloat(row.fraud_score) : undefined,
      fraudStatus: row.fraud_status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at?.toISOString(),
      processedAt: row.processed_at?.toISOString(),
      failedReason: row.failed_reason,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      lineItems: row.line_items || [],
    }));

    logger.info('Retrieved flagged payments', {
      count: payments.length,
      total,
      limit,
      offset,
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payments,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      }),
    };
  } catch (error: any) {
    logger.error('Error retrieving flagged payments', error as Error);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
