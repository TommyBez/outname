ALTER TABLE "user" DROP CONSTRAINT "user_email_key";--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_token_key";--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_agent_id_fkey";
--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_userId_fkey";
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";
--> statement-breakpoint
ALTER TABLE "digests" DROP CONSTRAINT "digests_run_id_fkey";
--> statement-breakpoint
ALTER TABLE "digest_items" DROP CONSTRAINT "digest_items_digest_id_fkey";
--> statement-breakpoint
ALTER TABLE "gmail_connection" DROP CONSTRAINT "gmail_connection_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "agent" DROP CONSTRAINT "agent_user_id_fkey";
--> statement-breakpoint
DROP INDEX "agent_enabled_idx";--> statement-breakpoint
DROP INDEX "runs_agent_idx";--> statement-breakpoint
DROP INDEX "runs_started_at_idx";--> statement-breakpoint
DROP INDEX "digests_run_id_idx";--> statement-breakpoint
DROP INDEX "digest_items_category_idx";--> statement-breakpoint
DROP INDEX "digest_items_digest_id_idx";--> statement-breakpoint
DROP INDEX "agent_user_idx";--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "schedule_time" SET DEFAULT '08:00';--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "schedule_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "schedule_days" SET DEFAULT '{1,2,3,4,5}';--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "config" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "config" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "config" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "sandbox_name" text;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_items" ADD CONSTRAINT "digest_items_digest_id_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_connection" ADD CONSTRAINT "gmail_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_kind_idx" ON "agent" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_sandbox_name_idx" ON "agent" USING btree ("sandbox_name") WHERE "agent"."sandbox_name" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "runs_agent_idx" ON "runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "runs_started_at_idx" ON "runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "digests_run_id_idx" ON "digests" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "digest_items_category_idx" ON "digest_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "digest_items_digest_id_idx" ON "digest_items" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_token_unique" UNIQUE("token");