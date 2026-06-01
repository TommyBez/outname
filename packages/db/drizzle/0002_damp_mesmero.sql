ALTER TABLE "agent" ADD COLUMN "session_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_event_run_id" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_event_type" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_event_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_control_lease_id" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "session_control_lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "last_recovery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "last_recovery_mode" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "last_recovery_reason" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "last_recovery_error" text;--> statement-breakpoint
UPDATE "agent"
SET
  "session_epoch" = 0,
  "last_session_run_id" = NULL,
  "last_ticker_run_id" = NULL,
  "session_event_run_id" = NULL,
  "session_event_type" = NULL,
  "session_event_started_at" = NULL,
  "session_control_lease_id" = NULL,
  "session_control_lease_until" = NULL;
