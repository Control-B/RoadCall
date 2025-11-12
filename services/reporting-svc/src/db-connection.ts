import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '@roadcall/utils';

// Database connection pool
let pool: Pool | null = null;

/**
 * Get or create database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'roadcall_analytics',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: parseInt(process.env.DB_POOL_MAX || '20'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    };

    pool = new Pool(config);

    pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });

    logger.info('Database connection pool created', {
      host: config.host,
      database: config.database,
      maxConnections: config.max,
    });
  }

  return pool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      duration,
      rows: result.rowCount,
      query: text.substring(0, 100),
    });

    return result;
  } catch (error) {
    logger.error('Query execution failed', error as Error, {
      query: text.substring(0, 100),
      params,
    });
    throw error;
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', error as Error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}
