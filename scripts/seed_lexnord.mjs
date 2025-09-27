#!/usr/bin/env node
// scripts/seed_lexnord.mjs - kjør: node scripts/seed_lexnord.mjs

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

async function main() {
  const sqlPath = resolve(__dirname, '../sql/seed_lexnord.sql');
  const sql = await readFile(sqlPath, 'utf8');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('✅ LexNord seed completed');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('LexNord seed failed:', err);
  process.exit(1);
});
