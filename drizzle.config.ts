import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be set for drizzle-kit')
}

export default defineConfig({
  schema: './shared/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
