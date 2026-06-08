import type { Database } from 'sql.js'

const SCHEMA_VERSION = '1'

export function applyDreamingStoreMigrations(sqlite: Database): void {
  sqlite.run('PRAGMA foreign_keys = ON')
  sqlite.run('PRAGMA journal_mode = DELETE')
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sweeps (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      local_date TEXT NOT NULL,
      attempt INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      error TEXT
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS ingestion_checkpoints (
      source TEXT PRIMARY KEY,
      cursor TEXT NOT NULL,
      observed_at TEXT NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS recall_candidates (
      key TEXT PRIMARY KEY,
      normalized_text TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      recall_count INTEGER NOT NULL,
      unique_query_count INTEGER NOT NULL,
      score REAL NOT NULL,
      status TEXT NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS evidence_snippets (
      id TEXT PRIMARY KEY,
      candidate_key TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      path TEXT,
      line INTEGER,
      text TEXT NOT NULL,
      observed_at TEXT NOT NULL,
      query_key TEXT NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS phase_signals (
      id TEXT PRIMARY KEY,
      sweep_id TEXT NOT NULL,
      phase TEXT NOT NULL,
      candidate_key TEXT,
      signal_type TEXT NOT NULL,
      score REAL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS promotions (
      key TEXT PRIMARY KEY,
      sweep_id TEXT NOT NULL,
      marker TEXT NOT NULL,
      promoted_at TEXT NOT NULL,
      memory_path TEXT NOT NULL
    )
  `)
  sqlite.run(
    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?)",
    [SCHEMA_VERSION]
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS sweeps_agent_date_idx ON sweeps (agent_id, local_date)'
  )
  sqlite.run('CREATE INDEX IF NOT EXISTS sweeps_event_idx ON sweeps (event_id)')
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS recall_candidates_score_idx ON recall_candidates (status, score)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS recall_candidates_last_seen_idx ON recall_candidates (last_seen_at)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS evidence_candidate_idx ON evidence_snippets (candidate_key)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS evidence_source_idx ON evidence_snippets (source_type, source_id)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS phase_signals_sweep_idx ON phase_signals (sweep_id, phase)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS phase_signals_candidate_idx ON phase_signals (candidate_key)'
  )
  sqlite.run(
    'CREATE INDEX IF NOT EXISTS promotions_sweep_idx ON promotions (sweep_id)'
  )
}
