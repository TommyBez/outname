-- Rename channel routing columns to provider-neutral canonical terms.

DROP INDEX IF EXISTS "agent_channel_bindings_lookup_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "channel_thread_conversations_external_idx";--> statement-breakpoint

ALTER TABLE "agent_channel_bindings" RENAME COLUMN "team_id" TO "external_scope_id";--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" RENAME COLUMN "team_id" TO "external_scope_id";--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" RENAME COLUMN "external_thread_key" TO "external_thread_id";--> statement-breakpoint

CREATE UNIQUE INDEX "agent_channel_bindings_lookup_idx" ON "agent_channel_bindings" USING btree ("channel","external_scope_id","external_key","kind","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_thread_conversations_external_idx" ON "channel_thread_conversations" USING btree ("channel","external_scope_id","external_thread_id","agent_id");
