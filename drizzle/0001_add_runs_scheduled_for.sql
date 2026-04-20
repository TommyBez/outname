-- Add runs.scheduled_for (nullable, TIMESTAMPTZ).
-- Set by the daily cron when starting a workflow so the UI can show the
-- future local-time slot the run is sleeping until.
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "scheduled_for" timestamp with time zone;
