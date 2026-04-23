-- Agent-agnostic run persistence.
--
-- Retires the Gmail-shaped `digests` + `digest_items` tables in favour
-- of a single `run_result` table that any agent can use to persist the
-- final output of a run as text. `metrics` lives on the same row so
-- publishing a result is one atomic insert.
--
-- Also drops `runs.emails_scanned`, which was Gmail-specific; the same
-- count (or any other agent-specific number) can now be published via
-- `run_result.metrics` instead.
--
-- Idempotent — safe to re-run.

DROP TABLE IF EXISTS digest_items;
DROP TABLE IF EXISTS digests;

ALTER TABLE runs DROP COLUMN IF EXISTS emails_scanned;

CREATE TABLE IF NOT EXISTS run_result (
  run_id     TEXT PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  metrics    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
