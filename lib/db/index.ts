import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

type DB = ReturnType<typeof drizzle<typeof schema>>

let _db: DB | null = null

function getDb(): DB {
  if (_db) {
    return _db
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  const sql = neon(url)
  _db = drizzle(sql, { schema })
  return _db
}

// Lazy proxy — resolves the underlying client only when actually used.
export const db = new Proxy({} as DB, {
  get(_t, prop, receiver) {
    const target = getDb() as unknown as object
    return Reflect.get(target, prop, receiver)
  },
})

export { schema }
