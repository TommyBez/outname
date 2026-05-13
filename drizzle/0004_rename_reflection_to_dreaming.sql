ALTER TABLE "agent" RENAME COLUMN "reflection_enabled" TO "dreaming_enabled";
--> statement-breakpoint
ALTER TABLE "agent" RENAME COLUMN "reflection_interval_minutes" TO "dreaming_interval_minutes";
--> statement-breakpoint
ALTER TABLE "agent" RENAME COLUMN "last_reflection_at" TO "last_dreaming_at";
--> statement-breakpoint
ALTER TABLE "agent" RENAME COLUMN "last_reflection_local_date" TO "last_dreaming_local_date";
--> statement-breakpoint
UPDATE "agent"
SET "session_event_type" = 'dreaming'
WHERE "session_event_type" = 'reflection';
--> statement-breakpoint
UPDATE "agent_file_changes"
SET "source_type" = 'dreaming'
WHERE "source_type" = 'reflection';
--> statement-breakpoint
UPDATE "agent_token_usage"
SET "source_type" = 'dreaming'
WHERE "source_type" = 'reflection';
