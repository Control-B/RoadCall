/**
 * Secret Handler Utility
 * 
 * Provides safe handling of secrets to prevent accidental logging or exposure.
 * All secret values are wrapped in a SecretValue class that prevents serialization.
 */

import { logger } from './logger';

/**
 * Wrapper class for secret values that prevents accidental logging
 */
export class SecretValue {
  private readonly value: string;
  private readonly name: string;

  constructor(value: string, name: string = 'secret') {
    this.value = value;
    this.name = name;
  }

  /**
   * Get the actual secret value
   * Use this only when you need to use the secret (e.g., API calls)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Get the secret name for logging purposes
   */
  getName(): string {
    return this.name;
  }

  /**
   * Override toString to prevent accidental logging
   */
  toString(): string {
    return `[SecretValue:${this.name}]`;
  }

  /**
   * Override toJSON to prevent accidental serialization
   */
  toJSON(): string {
    return `[SecretValue:${this.name}]`;
  }

  /**
   * Override valueOf to prevent accidental exposure
   */
  valueOf(): string {
    return `[SecretValue:${this.name}]`;
  }

  /**
   * Custom inspect for Node.js util.inspect
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `[SecretValue:${this.name}]`;
  }
}

/**
 * Parse a JSON secret string into a typed object with SecretValue wrappers
 * Only wraps string values that look like secrets (contain 'key', 'token', 'secret', 'password')
 */
export function parseSecretJSON<T extends Record<string, any>>(
  secretString: string,
  secretName: string
): T {
  try {
    const parsed = JSON.parse(secretString);
    
    // Wrap string values that look like secrets
    const wrapped: any = {};
    for (const [key, value] of Object.entries(parsed)) {
      const lowerKey = key.toLowerCase();
      const isSecretField =
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('credential');

      if (typeof value === 'string' && isSecretField) {
        wrapped[key] = new SecretValue(value, `${secretName}.${key}`);
      } else {
        wrapped[key] = value;
      }
    }
    
    return wrapped as T;
  } catch (error) {
    logger.error('Failed to parse secret JSON', error as Error, {
      secretName,
      // Do NOT log the actual secret string
    });
    throw new Error(`Failed to parse secret JSON for ${secretName}`);
  }
}

/**
 * Sanitize an object to remove any potential secret values before logging
 */
export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof SecretValue) {
    return obj.toString();
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Check if value is SecretValue first
    if (value instanceof SecretValue) {
      sanitized[key] = value.toString();
    } else {
      // Redact common secret field names
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('credential')
      ) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Safe error handler that prevents secret exposure in error messages
 */
export function createSafeError(message: string, originalError?: Error): Error {
  // Create a new error without exposing the original error message
  // which might contain secrets
  const safeError = new Error(message);
  
  if (originalError) {
    // Log the original error securely (without exposing it to the caller)
    logger.error('Original error (sanitized)', originalError, {
      errorType: originalError.constructor.name,
      // Do NOT include error.message as it might contain secrets
    });
  }
  
  return safeError;
}

/**
 * Validate that a secret value is not empty or placeholder
 */
export function validateSecret(secret: SecretValue | string, secretName: string): void {
  const value = secret instanceof SecretValue ? secret.getValue() : secret;
  
  if (!value || value.trim() === '') {
    throw new Error(`Secret ${secretName} is empty`);
  }
  
  // Check for common placeholder values
  const placeholders = [
    'placeholder',
    'replace_with_actual',
    'todo',
    'changeme',
    'xxx',
    'test',
  ];
  
  const lowerValue = value.toLowerCase();
  for (const placeholder of placeholders) {
    if (lowerValue.includes(placeholder)) {
      throw new Error(
        `Secret ${secretName} contains placeholder value. Please update with actual secret.`
      );
    }
  }
}

/**
 * Mask a string for display purposes (show first and last 4 chars)
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return '****';
  }
  return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}
