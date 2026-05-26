import { defineConfig } from 'drizzle-kit'
import { normalizeDatabaseUrlForPg } from './shared/db/connection-string'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for drizzle-kit')
}

export default defineConfig({
  schema: './shared/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: normalizeDatabaseUrlForPg(databaseUrl),
  },
  strict: true,
  verbose: true,
})
