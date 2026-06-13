CREATE TABLE IF NOT EXISTS "launch_admin_digest_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "launch_key" text NOT NULL,
  "digest_key" text NOT NULL,
  "resend_message_id" text,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "launch_admin_digest_delivery_unique_idx" ON "launch_admin_digest_deliveries" USING btree ("launch_key","digest_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "launch_admin_digest_delivery_launch_idx" ON "launch_admin_digest_deliveries" USING btree ("launch_key","sent_at" DESC NULLS LAST);
