-- Run event log: one row per step/run progress breadcrumb.
-- The client polls this table to render the live progress timeline.
-- We keep it simple: an append-only log, ordered by seq per run.

CREATE TABLE IF NOT EXISTS run_events (
  id          text       PRIMARY KEY,
  run_id      text       NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq         integer    NOT NULL,
  type        text       NOT NULL,               -- 'run' | 'step'
  step        text,                              -- 'read' | 'classify' | 'persist' | 'finalize' (nullable for run-level events)
  status      text       NOT NULL,               -- 'start' | 'progress' | 'done' | 'error' | 'started' | 'completed' | 'failed'
  message     text       NOT NULL,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The client reads with (run_id, seq > last_seq order by seq).
CREATE INDEX IF NOT EXISTS run_events_run_id_seq_idx
  ON run_events (run_id, seq);

-- (run_id, seq) is unique per run for safe "insert next" semantics.
CREATE UNIQUE INDEX IF NOT EXISTS run_events_run_id_seq_uniq
  ON run_events (run_id, seq);
