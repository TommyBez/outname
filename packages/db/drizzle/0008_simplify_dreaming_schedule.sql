ALTER TABLE "agent"
  DROP COLUMN IF EXISTS "dreaming_schedule_mode";

ALTER TABLE "agent"
  DROP COLUMN IF EXISTS "dreaming_schedule_times";

ALTER TABLE "agent"
  DROP COLUMN IF EXISTS "dreaming_interval_minutes";
