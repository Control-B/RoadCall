import * as jwt from 'jsonwebtoken';
import { User, UserRole } from '@roadcall/types';
import { logger, AuthenticationError } from '@roadcall/utils';
import { secretsManager } from '@roadcall/aws-clients';

const JWT_SECRET_NAME = process.env.JWT_SECRET_NAME || 'roadcall/jwt/secret';
const JWT_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

interface JWTPayload {
  userId: string;
  phone: string;
  role: UserRole;
  companyId?: string;
  iat?: number;
  exp?: number;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Get JWT secret from Secrets Manager
 */
async function getJWTSecret(): Promise<string> {
  try {
    const secret = await secretsManager.getSecret(JWT_SECRET_NAME);
    return secret;
  } catch (error) {
    logger.error('Failed to retrieve JWT secret', error as Error);
    throw new AuthenticationError('Authentication service unavailable');
  }
}

/**
 * Generate access token
 */
export async function generateAccessToken(user: User): Promise<string> {
  const secret = await getJWTSecret();

  const payload: JWTPayload = {
    userId: user.userId,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
  };

  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: JWT_EXPIRY,
  });

  logger.info('Access token generated', { userId: user.userId });
  return token;
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(user: User): Promise<string> {
  const secret = await getJWTSecret();

  const payload: JWTPayload = {
    userId: user.userId,
    phone: user.phone,
    role: user.role,
    companyId: user.companyId,
  };

  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  logger.info('Refresh token generated', { userId: user.userId });
  return token;
}

/**
 * Generate token pair (access + refresh)
 */
export async function generateTokenPair(user: User): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(user),
    generateRefreshToken(user),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

/**
 * Verify and decode JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  const secret = await getJWTSecret();

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as JWTPayload;

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Token expired', { error: error.message });
      throw new AuthenticationError('Token expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid token', { error: error.message });
      throw new AuthenticationError('Invalid token');
    }

    logger.error('Token verification failed', error as Error);
    throw new AuthenticationError('Token verification failed');
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenPair> {
  // Verify refresh token
  const payload = await verifyToken(refreshToken);

  // Create user object from payload
  const user: User = {
    userId: payload.userId,
    phone: payload.phone,
    role: payload.role,
    name: '', // Will be fetched from DB if needed
    companyId: payload.companyId,
    createdAt: '',
    lastLoginAt: new Date().toISOString(),
  };

  // Generate new token pair
  return generateTokenPair(user);
}
