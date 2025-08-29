import { Pool } from 'pg';

// Neon database client using pg (PostgreSQL) driver
export function createNeonClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
}

// Unpooled client for direct connections (used in CI and migrations)
export function createNeonUnpooledClient() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL_UNPOOLED environment variable is required');
  }

  return new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    },
    max: 1, // Single connection for unpooled usage
    idleTimeoutMillis: 0,
    connectionTimeoutMillis: 0
  });
}
