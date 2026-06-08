import { createRequire } from 'node:module'
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { applyDreamingStoreMigrations } from './migrations'
import { dreamingSchema } from './schema'

const require = createRequire(import.meta.url)

let sqlJsPromise: Promise<SqlJsStatic> | null = null

export interface OpenDreamingSqliteResult {
  db: SQLJsDatabase<typeof dreamingSchema>
  exportBytes(): Uint8Array
  sqlite: Database
}

export async function openDreamingSqlite(
  input: { buffer?: Buffer | null } = {}
): Promise<OpenDreamingSqliteResult> {
  const SQL = await loadSqlJs()
  const sqlite = input.buffer
    ? new SQL.Database(new Uint8Array(input.buffer))
    : new SQL.Database()
  applyDreamingStoreMigrations(sqlite)
  const db = drizzle(sqlite, { schema: dreamingSchema })
  return {
    db,
    exportBytes: () => sqlite.export(),
    sqlite,
  }
}

async function loadSqlJs(): Promise<SqlJsStatic> {
  sqlJsPromise ??= initSqlJs({
    locateFile: (file: string) => require.resolve(`sql.js/dist/${file}`),
  })
  return await sqlJsPromise
}
