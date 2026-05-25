import 'server-only'

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { dbSchema } from './schema-registry'

/**
 * Neon HTTP driver for workflow bundles and shared server modules on the
 * workflow dependency graph. Server routes should import from
 * `@/shared/db/pool` for TCP connection pooling on Vercel Fluid.
 */
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(databaseUrl)

export const db = drizzle(sql, { schema: dbSchema })
