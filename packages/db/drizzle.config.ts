import { normalizeDatabaseUrlForPg } from '@outname/db/connection-string'
import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for drizzle-kit')
}

export default defineConfig({
  schema: './schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: normalizeDatabaseUrlForPg(databaseUrl),
  },
  strict: true,
  verbose: true,
})
