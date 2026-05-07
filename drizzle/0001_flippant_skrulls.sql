ALTER TABLE "agent" ADD COLUMN "session_start_token" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_start_expires_at" timestamp with time zone;