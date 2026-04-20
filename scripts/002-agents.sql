-- Multi-agent platform migration
-- Idempotent: safe to run multiple times

-- Per-user settings (timezone for all schedule math)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  timezone   TEXT NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An agent = one configured instance of an agent kind for a user.
-- Agent kinds are an in-code registry; `kind` is a plain string FK.
CREATE TABLE IF NOT EXISTS agent (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  kind           TEXT NOT NULL,                    -- 'daily-email-brief' | future kinds
  name           TEXT NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  schedule_time  TEXT,                             -- 'HH:MM' user-local (NULL = manual only)
  schedule_days  INTEGER[] NOT NULL DEFAULT '{}',  -- 0=Sun .. 6=Sat
  config         JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_user_idx    ON agent (user_id);
CREATE INDEX IF NOT EXISTS agent_enabled_idx ON agent (enabled) WHERE enabled = true;

-- Link runs back to their agent (runs.trigger already exists)
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS agent_id TEXT REFERENCES agent(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS runs_agent_idx ON runs (agent_id);
