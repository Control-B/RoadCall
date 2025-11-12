import {
  FraudDetectorClient,
  GetEventPredictionCommand,
  GetEventPredictionCommandInput,
  ModelScores,
  RuleResult,
} from '@aws-sdk/client-frauddetector';
import { logger } from '@roadcall/utils';
import { query } from './db-connection';

// ========================================================================
// Types
// ========================================================================

export interface FraudDetectionInput {
  paymentId: string;
  incidentId: string;
  vendorId: string;
  amountCents: number;
  payerType: 'back_office' | 'driver_ic';
}

export interface FraudDetectionResult {
  fraudScore: number;
  fraudStatus: 'low_risk' | 'medium_risk' | 'high_risk' | 'flagged';
  riskLevel: string;
  reasons: string[];
  modelScores: Record<string, number>;
  ruleResults: Array<{
    ruleName: string;
    outcome: string;
  }>;
}

export interface VendorMetrics {
  accountAgeDays: number;
  totalPayments: number;
  paymentVelocity24h: number;
  avgPaymentAmount: number;
  completionRate: number;
}

// ========================================================================
// Fraud Detector Client
// ========================================================================

const fraudDetectorClient = new FraudDetectorClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// Configuration
const DETECTOR_NAME = process.env.FRAUD_DETECTOR_NAME || 'vendor_payment_detector';
const EVENT_TYPE_NAME = process.env.FRAUD_EVENT_TYPE || 'vendor_payment';
const FRAUD_THRESHOLD = parseFloat(process.env.FRAUD_THRESHOLD || '0.7');

// ========================================================================
// Main Fraud Detection Function
// ========================================================================

/**
 * Score a payment for fraud risk using Amazon Fraud Detector
 */
export async function scoreFraudRisk(
  input: FraudDetectionInput
): Promise<FraudDetectionResult> {
  const startTime = Date.now();

  try {
    // Gather vendor metrics
    const vendorMetrics = await getVendorMetrics(input.vendorId);

    // Get incident duration
    const incidentDuration = await getIncidentDuration(input.incidentId);

    // Build event variables for Fraud Detector
    const eventVariables: Record<string, string> = {
      payment_amount: (input.amountCents / 100).toFixed(2),
      vendor_id: input.vendorId,
      incident_id: input.incidentId,
      payer_type: input.payerType,
      vendor_account_age_days: vendorMetrics.accountAgeDays.toString(),
      vendor_total_payments: vendorMetrics.totalPayments.toString(),
      vendor_payment_velocity_24h: vendorMetrics.paymentVelocity24h.toString(),
      vendor_avg_payment_amount: vendorMetrics.avgPaymentAmount.toFixed(2),
      vendor_completion_rate: vendorMetrics.completionRate.toFixed(2),
      incident_duration_minutes: incidentDuration.toString(),
    };

    // Generate unique event ID
    const eventId = `${input.paymentId}_${Date.now()}`;
    const eventTimestamp = new Date().toISOString();

    // Call Fraud Detector
    const fraudDetectorInput: GetEventPredictionCommandInput = {
      detectorId: DETECTOR_NAME,
      eventId,
      eventTypeName: EVENT_TYPE_NAME,
      eventTimestamp,
      entities: [
        {
          entityType: 'vendor',
          entityId: input.vendorId,
        },
      ],
      eventVariables,
    };

    logger.info('Calling Fraud Detector', {
      paymentId: input.paymentId,
      vendorId: input.vendorId,
      eventVariables,
    });

    const command = new GetEventPredictionCommand(fraudDetectorInput);
    const response = await fraudDetectorClient.send(command);

    // Extract fraud score from model scores
    const modelScores: Record<string, number> = {};
    let fraudScore = 0;

    if (response.modelScores && response.modelScores.length > 0) {
      response.modelScores.forEach((modelScore: ModelScores) => {
        if (modelScore.scores) {
          Object.entries(modelScore.scores).forEach(([key, value]) => {
            const numValue = typeof value === 'number' ? value : parseFloat(String(value));
            modelScores[key] = numValue;
            if (key === 'fraud_score' || key === 'fraud') {
              fraudScore = numValue;
            }
          });
        }
      });
    }

    // Extract rule results
    const ruleResults =
      response.ruleResults?.map((rule: RuleResult) => ({
        ruleName: rule.ruleId || 'unknown',
        outcome: rule.outcomes?.[0] || 'unknown',
      })) || [];

    // Determine fraud status based on score
    const fraudStatus = determineFraudStatus(fraudScore);

    // Extract risk level from rule outcomes
    const riskLevel =
      response.ruleResults?.find((r: RuleResult) => r.outcomes && r.outcomes.length > 0)?.outcomes?.[0] ||
      'unknown';

    // Extract reasons
    const reasons = ruleResults.map((r: { ruleName: string; outcome: string }) => r.ruleName);

    const result: FraudDetectionResult = {
      fraudScore,
      fraudStatus,
      riskLevel,
      reasons,
      modelScores,
      ruleResults,
    };

    const duration = Date.now() - startTime;

    logger.info('Fraud detection completed', {
      paymentId: input.paymentId,
      fraudScore,
      fraudStatus,
      riskLevel,
      durationMs: duration,
    });

    // Ensure we meet the 5-second SLA
    if (duration > 5000) {
      logger.warn('Fraud detection exceeded 5-second SLA', {
        paymentId: input.paymentId,
        durationMs: duration,
      });
    }

    return result;
  } catch (error) {
    logger.error('Error scoring fraud risk', error as Error, {
      paymentId: input.paymentId,
      vendorId: input.vendorId,
    });

    // Return a safe default on error (flag for manual review)
    return {
      fraudScore: 1.0,
      fraudStatus: 'flagged',
      riskLevel: 'error',
      reasons: ['fraud_detection_error'],
      modelScores: {},
      ruleResults: [],
    };
  }
}

/**
 * Determine fraud status based on score
 */
function determineFraudStatus(
  score: number
): 'low_risk' | 'medium_risk' | 'high_risk' | 'flagged' {
  if (score >= FRAUD_THRESHOLD) {
    return 'flagged';
  } else if (score >= 0.5) {
    return 'high_risk';
  } else if (score >= 0.3) {
    return 'medium_risk';
  } else {
    return 'low_risk';
  }
}

// ========================================================================
// Helper Functions for Vendor Metrics
// ========================================================================

/**
 * Get vendor metrics for fraud scoring
 */
async function getVendorMetrics(vendorId: string): Promise<VendorMetrics> {
  try {
    // Get vendor account age
    const vendorResult = await query(
      `SELECT created_at FROM vendors WHERE vendor_id = $1`,
      [vendorId]
    );

    let accountAgeDays = 0;
    if (vendorResult.rows.length > 0) {
      const createdAt = new Date(vendorResult.rows[0].created_at);
      const now = new Date();
      accountAgeDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Get payment statistics
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total_payments,
        AVG(amount_cents) as avg_amount,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_payments
       FROM payments 
       WHERE vendor_id = $1`,
      [vendorId]
    );

    const totalPayments = parseInt(statsResult.rows[0]?.total_payments || '0');
    const avgPaymentAmount = parseFloat(statsResult.rows[0]?.avg_amount || '0') / 100;
    const completedPayments = parseInt(statsResult.rows[0]?.completed_payments || '0');
    const completionRate = totalPayments > 0 ? completedPayments / totalPayments : 0;

    // Get 24-hour payment velocity
    const velocityResult = await query(
      `SELECT COUNT(*) as count_24h
       FROM payments 
       WHERE vendor_id = $1 
       AND created_at >= NOW() - INTERVAL '24 hours'`,
      [vendorId]
    );

    const paymentVelocity24h = parseInt(velocityResult.rows[0]?.count_24h || '0');

    return {
      accountAgeDays,
      totalPayments,
      paymentVelocity24h,
      avgPaymentAmount,
      completionRate,
    };
  } catch (error) {
    logger.error('Error fetching vendor metrics', error as Error, { vendorId });

    // Return safe defaults
    return {
      accountAgeDays: 0,
      totalPayments: 0,
      paymentVelocity24h: 0,
      avgPaymentAmount: 0,
      completionRate: 0,
    };
  }
}

/**
 * Get incident duration in minutes
 */
async function getIncidentDuration(incidentId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT created_at, updated_at FROM incidents WHERE incident_id = $1`,
      [incidentId]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    const createdAt = new Date(result.rows[0].created_at);
    const updatedAt = new Date(result.rows[0].updated_at);
    const durationMs = updatedAt.getTime() - createdAt.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    return durationMinutes;
  } catch (error) {
    logger.error('Error fetching incident duration', error as Error, { incidentId });
    return 0;
  }
}

/**
 * Check if payment should be flagged for manual review
 */
export function shouldFlagForManualReview(result: FraudDetectionResult): boolean {
  return result.fraudStatus === 'flagged' || result.fraudScore >= FRAUD_THRESHOLD;
}

/**
 * Get fraud detection configuration
 */
export function getFraudDetectionConfig() {
  return {
    detectorName: DETECTOR_NAME,
    eventTypeName: EVENT_TYPE_NAME,
    fraudThreshold: FRAUD_THRESHOLD,
  };
}
