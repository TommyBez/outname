CREATE TABLE IF NOT EXISTS "waitlist_launch_email_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "waitlist_entry_id" text NOT NULL,
  "event_key" text NOT NULL,
  "resend_message_id" text,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "waitlist_launch_email_deliveries_waitlist_entry_id_waitlist_entries_id_fk" FOREIGN KEY ("waitlist_entry_id") REFERENCES "public"."waitlist_entries"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_launch_email_delivery_unique_idx" ON "waitlist_launch_email_deliveries" USING btree ("waitlist_entry_id","event_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_launch_email_delivery_event_idx" ON "waitlist_launch_email_deliveries" USING btree ("event_key","sent_at" DESC NULLS LAST);
