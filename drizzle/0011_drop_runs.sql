-- Phase 5 cleanup: workflow/runtime ids and markdown logs now replace
-- the legacy app-level run history tables.

ALTER TABLE "agent"
	ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone;

--> statement-breakpoint
DROP TABLE "run_result";

--> statement-breakpoint
DROP TABLE "runs";
