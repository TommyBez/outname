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

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
})
attachDatabasePool(pool)

export const db = drizzle({ client: pool, schema })
