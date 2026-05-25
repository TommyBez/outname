import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { dbSchema } from '@/shared/db/schema-registry'

/** Load the pooled client inside step bodies so workflow flow bundles never import `pg`. */
export async function getDb(): Promise<NodePgDatabase<typeof dbSchema>> {
  const { db } = await import('@/shared/db')
  return db
}
