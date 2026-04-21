import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import {
  runs,
  digests,
  digestItems,
  gmailConnection,
} from "@/lib/db/schema"

/**
 * Drizzle client scoped to the tables this agent actually touches.
 */
export function getDb() {
  const sql = neon(process.env.DATABASE_URL!)
  return drizzle(sql, {
    schema: { runs, digests, digestItems, gmailConnection },
  })
}
