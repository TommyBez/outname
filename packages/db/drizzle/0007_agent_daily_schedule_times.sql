ALTER TABLE "agent"
  ADD COLUMN IF NOT EXISTS "heartbeat_schedule_mode" text DEFAULT 'interval' NOT NULL;

ALTER TABLE "agent"
  ADD COLUMN IF NOT EXISTS "heartbeat_schedule_times" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "agent"
  ADD COLUMN IF NOT EXISTS "dreaming_schedule_mode" text DEFAULT 'interval' NOT NULL;

ALTER TABLE "agent"
  ADD COLUMN IF NOT EXISTS "dreaming_schedule_times" jsonb DEFAULT '[]'::jsonb NOT NULL;
