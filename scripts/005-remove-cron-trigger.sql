-- Remove cron scheduling from the app.
--
-- Background: we used to have a Vercel Cron that fired /api/cron/schedule
-- once per UTC day. For each enabled agent whose schedule fired today,
-- a run was queued with status='scheduled' and trigger='cron' and the
-- workflow slept until the user-local time. All of that is gone — agents
-- are only started via the manual trigger button.
--
-- This migration:
--   1. Coerces any historical status='scheduled' runs to 'failed' so the
--      remaining application status union ('running' | 'completed' |
--      'failed') stays valid.
--   2. Drops runs.trigger and runs.scheduled_for since nothing populates
--      them anymore.
--   3. Drops agent.schedule_time and agent.schedule_days since agents no
--      longer have recurring schedules.
--   4. Drops the user_settings table (it existed only to hold a per-user
--      timezone used for cron scheduling math).
--
-- Safe to re-run; uses IF EXISTS everywhere.

BEGIN;

-- 1. Orphan any previously-scheduled runs so they don't violate the new
--    narrower RunStatus union.
UPDATE runs
SET
  status = 'failed',
  error = COALESCE(error, 'cron scheduling removed'),
  completed_at = COALESCE(completed_at, now())
WHERE status = 'scheduled';

-- 2. Drop cron-only columns on runs.
ALTER TABLE runs DROP COLUMN IF EXISTS trigger;
ALTER TABLE runs DROP COLUMN IF EXISTS scheduled_for;

-- 3. Drop schedule fields on agent.
ALTER TABLE agent DROP COLUMN IF EXISTS schedule_time;
ALTER TABLE agent DROP COLUMN IF EXISTS schedule_days;

-- 4. Drop the user_settings table entirely.
DROP TABLE IF EXISTS user_settings;

COMMIT;
