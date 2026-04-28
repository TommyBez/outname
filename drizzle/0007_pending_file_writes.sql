-- Phase 2 follow-up: persona files (AGENTS.md / SOUL.md) become
-- user-managed via the agent settings UI (Identity / Instructions
-- tabs). The agent's memory tools refuse to write them; instead, UI
-- saves enqueue rows here, and `drainPendingWrites` (called at the
-- top of `agentSessionWorkflow`) writes them through to the system
-- sandbox via `sandbox.writeFiles`.
--
-- The free-form `agent.system_prompt` column goes away — its
-- semantics now live entirely in SOUL.md / AGENTS.md, both of which
-- are inlined into the composed system prompt verbatim. We're not in
-- production, so the destructive drop is acceptable per the architect
-- review (#2 — pending-writes queue + drop systemPrompt column).

ALTER TABLE "agent" DROP COLUMN "system_prompt";--> statement-breakpoint

CREATE TABLE "pending_file_writes" (
    "id" text PRIMARY KEY NOT NULL,
    "agent_id" text NOT NULL,
    "path" text NOT NULL,
    "content" text NOT NULL,
    "enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
    "applied_at" timestamp with time zone,
    CONSTRAINT "pending_file_writes_agent_id_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint

CREATE INDEX "pending_file_writes_agent_unapplied_idx"
    ON "pending_file_writes" ("agent_id")
    WHERE "pending_file_writes"."applied_at" IS NULL;
