-- Add missing scheduled_for column (used by cron + sleep scheduling)
ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS runs_scheduled_for_idx
  ON runs (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
