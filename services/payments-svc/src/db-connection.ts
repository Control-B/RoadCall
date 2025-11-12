import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '@roadcall/utils';

const AURORA_SECRET_ARN = process.env.AURORA_SECRET_ARN || '';
const AURORA_ENDPOINT = process.env.AURORA_ENDPOINT || '';
const DATABASE_NAME = process.env.DATABASE_NAME || 'roadcall';

let pool: Pool | null = null;
let cachedCredentials: { username: string; password: string } | null = null;
let credentialsCacheTime: number = 0;
const CREDENTIALS_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Get database credentials from Secrets Manager with caching
 */
async function getDatabaseCredentials(): Promise<{ username: string; password: string }> {
  const now = Date.now();
  
  // Return cached credentials if still valid
  if (cachedCredentials && (now - credentialsCacheTime) < CREDENTIALS_CACHE_TTL) {
    return cachedCredentials;
  }

  const client = new SecretsManagerClient({});
  
  try {
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: AURORA_SECRET_ARN,
      })
    );

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    cachedCredentials = {
      username: secret.username,
      password: secret.password,
    };
    credentialsCacheTime = now;

    logger.info('Database credentials retrieved from Secrets Manager');
    return cachedCredentials;
  } catch (error) {
    logger.error('Failed to retrieve database credentials', error as Error);
    throw error;
  }
}

/**
 * Initialize database connection pool
 */
async function initializePool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const credentials = await getDatabaseCredentials();

  pool = new Pool({
    host: AURORA_ENDPOINT,
    port: 5432,
    database: DATABASE_NAME,
    user: credentials.username,
    password: credentials.password,
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout after 10 seconds
    ssl: {
      rejectUnauthorized: true,
    },
  });

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', err);
  });

  logger.info('Database connection pool initialized', {
    host: AURORA_ENDPOINT,
    database: DATABASE_NAME,
    maxConnections: 10,
  });

  return pool;
}

/**
 * Get database connection pool
 */
export async function getPool(): Promise<Pool> {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = await getPool();
  
  try {
    const start = Date.now();
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      query: text.substring(0, 100), // Log first 100 chars
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Query execution failed', error as Error, {
      query: text.substring(0, 100),
    });
    throw error;
  }
}

/**
 * Execute a transaction with automatic rollback on error
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    logger.debug('Transaction started');

    const result = await callback(client);

    await client.query('COMMIT');
    logger.debug('Transaction committed');

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
 * Close the connection pool (for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

/**
 * Health check for database connection
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const pool = await getPool();
    const result = await pool.query('SELECT 1 as health');
    return result.rows[0].health === 1;
  } catch (error) {
    logger.error('Database health check failed', error as Error);
    return false;
  }
}
