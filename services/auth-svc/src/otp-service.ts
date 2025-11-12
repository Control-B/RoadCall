import * as bcrypt from 'bcryptjs';
import { dynamodb } from '@roadcall/aws-clients';
import { OTPSession } from '@roadcall/types';
import { logger, RateLimitError } from '@roadcall/utils';

const USERS_TABLE = process.env.USERS_TABLE || '';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS_PER_HOUR = 5;
const SALT_ROUNDS = 10;

/**
 * Generate a 6-digit OTP code
 */
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP for secure storage
 */
export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

/**
 * Verify OTP against hashed value
 */
export async function verifyOTP(otp: string, hashedOTP: string): Promise<boolean> {
  return bcrypt.compare(otp, hashedOTP);
}

/**
 * Check rate limiting for OTP requests
 */
async function checkRateLimit(phone: string): Promise<void> {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  // Query recent OTP sessions for this phone
  const sessions = await dynamodb.query<OTPSession>(
    USERS_TABLE,
    'phone = :phone AND expiresAt > :oneHourAgo',
    {
      ':phone': phone,
      ':oneHourAgo': oneHourAgo,
    },
    'phone-index'
  );

  if (sessions.length >= MAX_ATTEMPTS_PER_HOUR) {
    logger.warn('Rate limit exceeded for OTP generation', { phone });
    throw new RateLimitError('Too many OTP requests. Please try again later.');
  }
}

/**
 * Create and store OTP session
 */
export async function createOTPSession(phone: string): Promise<string> {
  // Check rate limiting
  await checkRateLimit(phone);

  // Generate OTP
  const otp = generateOTP();
  const hashedOTP = await hashOTP(otp);
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  // Store OTP session
  const session: OTPSession = {
    phone,
    otp: hashedOTP,
    expiresAt,
    attempts: 0,
  };

  await dynamodb.put(USERS_TABLE, session);

  logger.info('OTP session created', { phone, expiresAt });

  return otp;
}

/**
 * Validate OTP for a phone number
 */
export async function validateOTP(
  phone: string,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  // Get OTP session
  const session = await dynamodb.get<OTPSession>(USERS_TABLE, { phone });

  if (!session) {
    logger.warn('OTP session not found', { phone });
    return { valid: false, reason: 'invalid' };
  }

  // Check expiry
  if (Date.now() > session.expiresAt) {
    logger.warn('OTP expired', { phone });
    await dynamodb.delete(USERS_TABLE, { phone });
    return { valid: false, reason: 'expired' };
  }

  // Check attempts
  if (session.attempts >= 3) {
    logger.warn('Too many OTP attempts', { phone });
    await dynamodb.delete(USERS_TABLE, { phone });
    return { valid: false, reason: 'too_many_attempts' };
  }

  // Verify OTP
  const isValid = await verifyOTP(otp, session.otp);

  if (!isValid) {
    // Increment attempts
    await dynamodb.update(
      USERS_TABLE,
      { phone },
      { attempts: session.attempts + 1 }
    );
    logger.warn('Invalid OTP provided', { phone, attempts: session.attempts + 1 });
    return { valid: false, reason: 'invalid' };
  }

  // OTP is valid - delete session
  await dynamodb.delete(USERS_TABLE, { phone });
  logger.info('OTP validated successfully', { phone });

  return { valid: true };
}

/**
 * Send OTP via SMS (placeholder - will integrate with Pinpoint)
 */
export async function sendOTPSMS(phone: string, otp: string): Promise<void> {
  // TODO: Integrate with Amazon Pinpoint for SMS delivery
  logger.info('Sending OTP via SMS', { phone, otp: '******' });

  // For now, just log the OTP (in production, this would send via Pinpoint)
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Development OTP', { phone, otp });
  }
}
