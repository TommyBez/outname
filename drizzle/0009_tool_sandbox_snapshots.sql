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
CREATE UNIQUE INDEX IF NOT EXISTS "tool_sandbox_builds_active_unique_idx"
	ON "tool_sandbox_builds" ("manifest_id", "manifest_hash")
	WHERE "status" IN ('pending', 'running');

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'maintainer' NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	DROP CONSTRAINT IF EXISTS "agent_tools_agent_id_tool_id_pk";

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD CONSTRAINT "agent_tools_agent_id_kind_tool_id_pk"
	PRIMARY KEY ("agent_id", "kind", "tool_id");

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'connected' NOT NULL;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "tool_sandbox_manifest" text;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "tool_sandbox_manifest_hash" text;

--> statement-breakpoint
ALTER TABLE "agent_tools"
	ADD COLUMN IF NOT EXISTS "tool_sandbox_error" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_sandbox_manifest_idx"
	ON "agent_tools" ("tool_sandbox_manifest");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_kind_idx"
	ON "agent_tools" ("kind");

--> statement-breakpoint
ALTER TABLE "runs"
	ADD COLUMN IF NOT EXISTS "parent_run_id" text;

--> statement-breakpoint
ALTER TABLE "runs"
	ADD COLUMN IF NOT EXISTS "parent_tool_id" text;

--> statement-breakpoint
ALTER TABLE "runs"
	ADD COLUMN IF NOT EXISTS "invocation_reply_token" text;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "runs_parent_run_idx"
	ON "runs" ("parent_run_id");
