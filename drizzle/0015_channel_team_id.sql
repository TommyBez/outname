ALTER TABLE "agent_channel_bindings" ADD COLUMN IF NOT EXISTS "team_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD COLUMN IF NOT EXISTS "team_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "agent_channel_bindings_lookup_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_channel_bindings_lookup_idx" ON "agent_channel_bindings" ("channel", "team_id", "external_key", "kind");
--> statement-breakpoint
DROP INDEX IF EXISTS "channel_thread_conversations_external_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_thread_conversations_external_idx" ON "channel_thread_conversations" ("channel", "team_id", "external_thread_key");
