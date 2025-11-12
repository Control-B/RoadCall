// Secrets Manager client wrapper with caching and safe error handling

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  CreateSecretCommand,
  UpdateSecretCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';
import { logger, SecretValue, parseSecretJSON, validateSecret, createSafeError } from '@roadcall/utils';

interface CachedSecret {
  value: string;
  expiresAt: number;
  version?: string;
}

export class SecretsManagerWrapper {
  private client: SecretsManagerClient;
  private cache: Map<string, CachedSecret>;
  private cacheTTL: number;

  constructor(region?: string, cacheTTL: number = 300000) {
    this.client = new SecretsManagerClient({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
    this.cache = new Map();
    this.cacheTTL = cacheTTL; // Default 5 minutes
  }

  /**
   * Get a secret value from Secrets Manager with caching
   * Returns the raw secret string (use with caution)
   */
  async getSecret(secretName: string, useCache: boolean = true): Promise<string> {
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(secretName);
      if (cached && cached.expiresAt > Date.now()) {
        logger.debug('Secret retrieved from cache', { secretName });
        return cached.value;
      }
    }

    try {
      const result = await this.client.send(
        new GetSecretValueCommand({
          SecretId: secretName,
        })
      );

      const secretValue = result.SecretString || '';

      // Validate secret is not empty or placeholder
      try {
        validateSecret(secretValue, secretName);
      } catch (validationError) {
        logger.warn('Secret validation warning', {
          secretName,
          error: (validationError as Error).message,
        });
      }

      // Cache the secret
      if (useCache) {
        this.cache.set(secretName, {
          value: secretValue,
          expiresAt: Date.now() + this.cacheTTL,
          version: result.VersionId,
        });
      }

      logger.info('Secret retrieved from Secrets Manager', {
        secretName,
        versionId: result.VersionId,
      });
      return secretValue;
    } catch (error) {
      if (error instanceof ResourceNotFoundException) {
        logger.error('Secret not found', error, { secretName });
        throw createSafeError(`Secret ${secretName} not found`, error);
      }
      
      logger.error('Secrets Manager get error', error as Error, { secretName });
      throw createSafeError('Failed to retrieve secret from Secrets Manager', error as Error);
    }
  }

  /**
   * Get a secret and wrap it in SecretValue for safe handling
   */
  async getSecretValue(secretName: string, useCache: boolean = true): Promise<SecretValue> {
    const secretString = await this.getSecret(secretName, useCache);
    return new SecretValue(secretString, secretName);
  }

  /**
   * Get a secret and parse it as JSON
   * Returns typed object with SecretValue wrappers for string fields
   */
  async getSecretJSON<T extends Record<string, any>>(
    secretName: string,
    useCache: boolean = true
  ): Promise<T> {
    const secretValue = await this.getSecret(secretName, useCache);
    try {
      return parseSecretJSON<T>(secretValue, secretName);
    } catch (error) {
      logger.error('Failed to parse secret as JSON', error as Error, { secretName });
      throw createSafeError(`Failed to parse secret ${secretName} as JSON`, error as Error);
    }
  }

  /**
   * Get a secret and parse it as plain JSON (without SecretValue wrappers)
   * Use this when you need the raw JSON object
   */
  async getSecretJSONRaw<T>(secretName: string, useCache: boolean = true): Promise<T> {
    const secretValue = await this.getSecret(secretName, useCache);
    try {
      return JSON.parse(secretValue) as T;
    } catch (error) {
      logger.error('Failed to parse secret as JSON', error as Error, { secretName });
      throw createSafeError(`Failed to parse secret ${secretName} as JSON`, error as Error);
    }
  }

  /**
   * Create a new secret
   */
  async createSecret(secretName: string, secretValue: string, description?: string): Promise<void> {
    try {
      await this.client.send(
        new CreateSecretCommand({
          Name: secretName,
          SecretString: secretValue,
          Description: description,
        })
      );

      logger.info('Secret created', { secretName });
    } catch (error) {
      logger.error('Secrets Manager create error', error as Error, { secretName });
      throw createSafeError('Failed to create secret', error as Error);
    }
  }

  /**
   * Update an existing secret
   */
  async updateSecret(secretName: string, secretValue: string): Promise<void> {
    try {
      await this.client.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretValue,
        })
      );

      // Invalidate cache
      this.cache.delete(secretName);

      logger.info('Secret updated', { secretName });
    } catch (error) {
      logger.error('Secrets Manager update error', error as Error, { secretName });
      throw createSafeError('Failed to update secret', error as Error);
    }
  }

  /**
   * Clear the cache for a specific secret or all secrets
   */
  clearCache(secretName?: string): void {
    if (secretName) {
      this.cache.delete(secretName);
      logger.debug('Secret cache cleared', { secretName });
    } else {
      this.cache.clear();
      logger.debug('All secret caches cleared');
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance with default configuration
export const secretsManager = new SecretsManagerWrapper();

// Export helper function for Lambda cold start optimization
export async function warmupSecrets(secretNames: string[]): Promise<void> {
  logger.info('Warming up secrets cache', { count: secretNames.length });
  
  await Promise.all(
    secretNames.map(async (secretName) => {
      try {
        await secretsManager.getSecret(secretName, true);
      } catch (error) {
        logger.warn('Failed to warmup secret', { secretName, error: (error as Error).message });
      }
    })
  );
  
  logger.info('Secrets cache warmup complete');
}
