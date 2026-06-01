-- Multi-user channel routing.
--
-- Adds `user_id` to `agent_channel_bindings` and `channel_thread_conversations`
-- so multiple platform users can each have their own bindings + thread
-- conversations against the same external workspace, and tightens the
-- unique indexes to allow that overlap without ambiguity.
--
-- Backfill copies `user_id` from each row's owning `agent`. After the
-- backfill the column is set NOT NULL.

ALTER TABLE "agent_channel_bindings" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "agent_channel_bindings" b SET "user_id" = a."user_id" FROM "agent" a WHERE b."agent_id" = a."id";--> statement-breakpoint
ALTER TABLE "agent_channel_bindings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_channel_bindings" ADD CONSTRAINT "agent_channel_bindings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "agent_channel_bindings_lookup_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "agent_channel_bindings_lookup_idx" ON "agent_channel_bindings" USING btree ("channel","team_id","external_key","kind","user_id");--> statement-breakpoint
CREATE INDEX "agent_channel_bindings_user_idx" ON "agent_channel_bindings" USING btree ("user_id");--> statement-breakpoint

ALTER TABLE "channel_thread_conversations" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "channel_thread_conversations" c SET "user_id" = a."user_id" FROM "agent" a WHERE c."agent_id" = a."id";--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD CONSTRAINT "channel_thread_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP INDEX "channel_thread_conversations_external_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "channel_thread_conversations_external_idx" ON "channel_thread_conversations" USING btree ("channel","team_id","external_thread_key","agent_id");--> statement-breakpoint
CREATE INDEX "channel_thread_conversations_user_idx" ON "channel_thread_conversations" USING btree ("user_id");
