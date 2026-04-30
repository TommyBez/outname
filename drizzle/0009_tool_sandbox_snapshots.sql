-- Phase 4: tool-sandbox snapshots + per-attempt build tracking, plus
-- new columns on `agent_tools` so an attach can pre-create the row in
-- a `pending` state while the snapshot build runs.

-- One row per manifest (e.g. "agent-browser") holding the most recent
-- READY snapshot id. Read by the tool runtime at every tool call.
CREATE TABLE IF NOT EXISTS "tool_sandbox_snapshots" (
	"manifest_id"   text PRIMARY KEY,
	"snapshot_id"   text NOT NULL,
	"manifest_hash" text NOT NULL,
	"built_at"      timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
-- One row per build attempt. Only stores terminal state; per-step
-- progress messages live on the build workflow's per-run stream.
CREATE TABLE IF NOT EXISTS "tool_sandbox_builds" (
	"id"               text PRIMARY KEY,
	"manifest_id"      text NOT NULL,
	"manifest_hash"    text NOT NULL,
	"status"           text NOT NULL,
	"workflow_run_id"  text,
	"error_text"       text,
	"started_at"       timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at"      timestamp with time zone
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_sandbox_builds_manifest_status_idx"
	ON "tool_sandbox_builds" ("manifest_id", "status");

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'connected' NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "tool_sandbox_manifest" text;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "tool_sandbox_error" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_sandbox_manifest_idx"
	ON "agent_tools" ("tool_sandbox_manifest");
