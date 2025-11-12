#!/usr/bin/env node
/**
 * Database initialization script
 * Run this to create the payments database schema
 * 
 * Usage:
 *   AURORA_SECRET_ARN=<secret-arn> AURORA_ENDPOINT=<endpoint> ts-node scripts/init-db.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { getPool, closePool } from '../src/db-connection';

async function initializeDatabase() {
  console.log('Initializing payments database schema...');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, '../src/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Get database connection
    const pool = await getPool();

    // Execute schema
    console.log('Executing schema...');
    await pool.query(schema);

    console.log('✓ Database schema initialized successfully');

    // Test connection
    const result = await pool.query('SELECT COUNT(*) FROM payments');
    console.log(`✓ Payments table accessible (${result.rows[0].count} records)`);

  } catch (error) {
    console.error('✗ Failed to initialize database:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('\nDatabase initialization complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nDatabase initialization failed:', error);
      process.exit(1);
    });
}

export { initializeDatabase };
