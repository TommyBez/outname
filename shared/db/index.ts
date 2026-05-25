import 'server-only'

import { attachDatabasePool } from '@vercel/functions'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import {
  account,
  agent,
  agentChannelBindings,
  agentEvents,
  agentTokenUsage,
  agentTools,
  budgetRule,
  channelInstallations,
  channelThreadConversations,
  chatConversation,
  chatMessage,
  session,
  user,
  userConnections,
  verification,
  waitlistEntry,
} from './schema'

const schema = {
  user,
  session,
  account,
  verification,
  agent,
  agentEvents,
  chatConversation,
  chatMessage,
  userConnections,
  agentTools,
  budgetRule,
  agentTokenUsage,
  channelInstallations,
  agentChannelBindings,
  channelThreadConversations,
  waitlistEntry,
}

type DB = ReturnType<typeof drizzle<typeof schema>>

let _pool: Pool | null = null
let _db: DB | null = null

function getPool(): Pool {
  if (_pool) {
    return _pool
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  _pool = new Pool({
    connectionString: url,
    max: 10,
  })
  attachDatabasePool(_pool)
  return _pool
}

function getDb(): DB {
  if (_db) {
    return _db
  }
  _db = drizzle({ client: getPool(), schema })
  return _db
}

// Lazy proxy — resolves the underlying client only when actually used.
export const db = new Proxy({} as DB, {
  get(_t, prop, receiver) {
    const target = getDb() as unknown as object
    return Reflect.get(target, prop, receiver)
  },
})
