-- Phase 5: reflection scheduling, timezone-aware daily cadence, and
-- reviewable memory-file diffs.

ALTER TABLE "user"
	ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'UTC' NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent"
	ADD COLUMN IF NOT EXISTS "reflection_enabled" boolean DEFAULT true NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent"
	ADD COLUMN IF NOT EXISTS "reflection_interval_minutes" integer DEFAULT 1440 NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent"
	ADD COLUMN IF NOT EXISTS "last_reflection_at" timestamp with time zone;

--> statement-breakpoint
ALTER TABLE "agent"
	ADD COLUMN IF NOT EXISTS "last_reflection_local_date" text;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_file_changes" (
	"id"             text PRIMARY KEY,
	"agent_id"       text NOT NULL REFERENCES "agent"("id") ON DELETE cascade,
	"path"           text NOT NULL,
	"source_type"    text NOT NULL,
	"source_id"      text,
	"before_content" text,
	"after_content"  text,
	"before_sha256"  text,
	"after_sha256"   text,
	"created_at"     timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at"    timestamp with time zone
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_file_changes_agent_created_idx"
	ON "agent_file_changes" ("agent_id", "created_at");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_file_changes_path_idx"
	ON "agent_file_changes" ("path");
