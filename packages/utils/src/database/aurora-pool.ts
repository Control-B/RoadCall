import { Pool, PoolConfig, PoolClient, QueryResult } from 'pg';

export interface AuroraPoolConfig extends PoolConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  min?: number;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  statementTimeout?: number;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

/**
 * Aurora Postgres connection pool manager
 * 
 * Features:
 * - Connection pooling with configurable size
 * - Automatic retry on transient errors
 * - Query timeout handling
 * - Health checks
 * - Graceful shutdown
 */
export class AuroraPool {
  private pool: Pool;
  private isShuttingDown: boolean = false;

  constructor(config: AuroraPoolConfig) {
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl !== undefined ? config.ssl : { rejectUnauthorized: false },
      min: config.min || 2,
      max: config.max || 10,
      idleTimeoutMillis: config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config.connectionTimeoutMillis || 5000,
      statement_timeout: config.statementTimeout || 30000,
      application_name: 'roadcall-assistant',
    });

    // Error handling
    this.pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });

    this.pool.on('connect', (client) => {
      console.log('New client connected to Aurora');
    });

    this.pool.on('remove', (client) => {
      console.log('Client removed from pool');
    });
  }

  /**
   * Execute a query
   */
  async query<T = any>(
    text: string,
    params?: any[],
    options?: QueryOptions
  ): Promise<QueryResult<T>> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    const maxRetries = options?.retries || 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.pool.query<T>(text, params);
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if error is retryable
        if (this.isRetryableError(error) && attempt < maxRetries) {
          console.warn(`Query failed (attempt ${attempt}/${maxRetries}), retrying...`, error.message);
          await this.sleep(Math.pow(2, attempt) * 100); // Exponential backoff
          continue;
        }
        
        throw error;
      }
    }

    throw lastError || new Error('Query failed after retries');
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    options?: QueryOptions
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health', [], { retries: 1 });
      return result.rows[0]?.health === 1;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    console.log('Shutting down Aurora connection pool...');
    this.isShuttingDown = true;

    try {
      await this.pool.end();
      console.log('Aurora connection pool closed');
    } catch (error) {
      console.error('Error closing pool:', error);
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const retryableCodes = [
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '57P03', // cannot_connect_now
      '40001', // serialization_failure
      '40P01', // deadlock_detected
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create Aurora connection pool
 */
export function createAuroraPool(config: AuroraPoolConfig): AuroraPool {
  return new AuroraPool(config);
}

/**
 * Singleton pool manager for Lambda functions
 */
let poolInstance: AuroraPool | null = null;

export function getAuroraPool(config?: AuroraPoolConfig): AuroraPool {
  if (!poolInstance && config) {
    poolInstance = new AuroraPool(config);
  }
  
  if (!poolInstance) {
    throw new Error('Aurora pool not initialized. Provide config on first call.');
  }
  
  return poolInstance;
}

/**
 * Close singleton pool
 */
export async function closeAuroraPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.shutdown();
    poolInstance = null;
  }
}
