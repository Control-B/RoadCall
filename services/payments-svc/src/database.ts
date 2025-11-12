import { AuroraPool, getAuroraPool } from '@roadcall/utils';

/**
 * Get Aurora connection pool singleton
 */
export function getDatabase(): AuroraPool {
  return getAuroraPool({
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    ssl: { rejectUnauthorized: false },
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 30000,
  });
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const db = getDatabase();
    return await db.healthCheck();
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get pool statistics
 */
export function getDatabaseStats() {
  try {
    const db = getDatabase();
    return db.getStats();
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return null;
  }
}
