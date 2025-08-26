import { Pool } from "pg";
import 'dotenv/config';
import { config } from 'dotenv';

// Load .env.local specifically
config({ path: '.env.local' });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});


