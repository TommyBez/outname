import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { normalizeDatabaseUrlForPg } from './connection-string'
import { dbSchema } from './schema-registry'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrlForPg(databaseUrl),
  max: 10,
})
attachDatabasePool(pool)

export const db = drizzle({ client: pool, schema: dbSchema })
