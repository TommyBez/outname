ALTER TABLE "session" ADD COLUMN "impersonatedBy" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banReason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banExpires" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"use_case" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"confirmation_token_hash" text,
	"confirmation_token_expires_at" timestamp with time zone,
	"confirmation_email_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"invite_email_sent_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_idx" ON "waitlist_entries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_entries_status_created_idx" ON "waitlist_entries" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "waitlist_entries_source_created_idx" ON "waitlist_entries" USING btree ("source","created_at" DESC NULLS LAST);