import 'server-only'

import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { dbSchema } from './schema-registry'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
})
attachDatabasePool(pool)

/** Pooled TCP client for Vercel Fluid compute and other Node server routes. */
export const db = drizzle({ client: pool, schema: dbSchema })
