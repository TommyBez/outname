DROP TABLE IF EXISTS "pending_file_writes" CASCADE;
DROP TABLE IF EXISTS "agent_files" CASCADE;

ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_session_run_id";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_epoch";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_ticker_run_id";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_event_run_id";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_event_type";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_event_started_at";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_control_lease_id";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "session_control_lease_until";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_recovery_at";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_recovery_mode";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_recovery_reason";
ALTER TABLE "agent" DROP COLUMN IF EXISTS "last_recovery_error";

CREATE TABLE "agent_events" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL,
  "user_id" text NOT NULL,
  "type" text NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "concurrency_key" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "scheduled_for" timestamp with time zone,
  "attempt" integer DEFAULT 0 NOT NULL,
  "workflow_run_id" text,
  "publisher_workflow_run_id" text,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "heartbeat_at" timestamp with time zone,
  "claim_expires_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "agent_events"
  ADD CONSTRAINT "agent_events_agent_id_agent_id_fk"
  FOREIGN KEY ("agent_id") REFERENCES "agent"("id") ON DELETE cascade;

ALTER TABLE "agent_events"
  ADD CONSTRAINT "agent_events_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;

CREATE UNIQUE INDEX "agent_events_idempotency_idx"
  ON "agent_events" ("idempotency_key");
CREATE UNIQUE INDEX "agent_events_active_concurrency_idx"
  ON "agent_events" ("concurrency_key")
  WHERE "concurrency_key" IS NOT NULL AND "status" in ('starting', 'running');
CREATE INDEX "agent_events_agent_status_idx"
  ON "agent_events" ("agent_id", "status", "queued_at");
CREATE INDEX "agent_events_user_status_idx"
  ON "agent_events" ("user_id", "status", "queued_at");
CREATE INDEX "agent_events_concurrency_status_idx"
  ON "agent_events" ("concurrency_key", "status", "queued_at");
CREATE INDEX "agent_events_scheduled_idx"
  ON "agent_events" ("scheduled_for", "status");
