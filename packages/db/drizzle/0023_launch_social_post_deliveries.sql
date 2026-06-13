CREATE TABLE IF NOT EXISTS "launch_social_post_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "launch_key" text NOT NULL,
  "post_id" text NOT NULL,
  "platform" text NOT NULL,
  "connector_id" text NOT NULL,
  "social_set_id" text NOT NULL,
  "typefully_draft_id" text,
  "scheduled_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "launch_social_post_delivery_unique_idx" ON "launch_social_post_deliveries" USING btree ("launch_key","post_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "launch_social_post_delivery_launch_idx" ON "launch_social_post_deliveries" USING btree ("launch_key","created_at" DESC NULLS LAST);
