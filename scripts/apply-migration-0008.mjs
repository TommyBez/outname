/* eslint-disable */
// One-shot script to apply drizzle/0008_tools_and_connections.sql
// against the Neon database. Use Bash to run with:
//   node --env-file=/vercel/share/.env.project scripts/apply-migration-0008.mjs

import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const sqlPath = resolve(here, '..', 'drizzle', '0008_tools_and_connections.sql')
const sql = readFileSync(sqlPath, 'utf8')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = neon(connectionString)

// Split on bare statement boundaries; the file is hand-written so this
// works reliably (no semicolons inside strings).
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith('--'))

for (const stmt of statements) {
  console.log('[v0] applying:', stmt.split('\n')[0].slice(0, 80))
  await client.query(stmt)
}

// Record in __drizzle_migrations so drizzle-kit migrate doesn't try to
// re-apply this file.
const migrationsTable =
  'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (' +
  '"id" serial PRIMARY KEY, ' +
  '"hash" text NOT NULL, ' +
  '"created_at" bigint)'
await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
await client.query(migrationsTable)

// drizzle-kit hashes the SQL with a sha256-of-the-bytes; we compute the
// same hash so the migrate command treats this as already-applied.
import { createHash } from 'node:crypto'
const hash = createHash('sha256').update(sql).digest('hex')
const tag = '0008_tools_and_connections'

const existing = await client.query(
  'SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = $1',
  [hash]
)
if (existing.length === 0) {
  await client.query(
    'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
    [hash, Date.now()]
  )
  console.log('[v0] recorded migration', tag, 'as applied')
} else {
  console.log('[v0] migration', tag, 'already recorded')
}

console.log('[v0] done')
