-- Backfill: give every existing user a "Daily email brief" agent
-- so current users don't lose functionality after the refactor.
-- Idempotent: only inserts when the user has no agent of that kind.

INSERT INTO agent (id, user_id, kind, name, enabled, schedule_time, schedule_days, config)
SELECT
  'ag_' || substr(md5(random()::text || u.id), 1, 16),
  u.id,
  'daily-email-brief',
  'Daily email brief',
  TRUE,
  '08:00',
  ARRAY[1, 2, 3, 4, 5],  -- Mon..Fri
  '{}'::jsonb
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1 FROM agent a
  WHERE a.user_id = u.id AND a.kind = 'daily-email-brief'
);

-- Backfill runs.agent_id to the user's daily-email-brief agent.
-- We infer the user from the gmail_connection table (single-user singleton today).
-- This only touches rows where agent_id IS NULL.
UPDATE runs r
SET agent_id = a.id
FROM agent a, gmail_connection gc
WHERE r.agent_id IS NULL
  AND a.user_id = gc.user_id
  AND a.kind = 'daily-email-brief';

-- Seed UTC timezone for any user without a settings row.
INSERT INTO user_settings (user_id, timezone)
SELECT u.id, 'UTC'
FROM "user" u
WHERE NOT EXISTS (SELECT 1 FROM user_settings us WHERE us.user_id = u.id);
