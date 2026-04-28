-- Phase 2: drop the daily-email-brief kind. Every agent becomes a
-- generic LLM with a user-authored system prompt + a chosen model
-- + a built-in tool catalog (memory + exec). Schema reshape is
-- destructive; we are not in production yet, so wipe agent-scoped
-- data first and then drop / add columns.

-- Wipe agent-scoped data. Cascades cover the rest, but explicit is
-- clearer here.
DELETE FROM agent_files;--> statement-breakpoint
DELETE FROM run_result;--> statement-breakpoint
DELETE FROM runs;--> statement-breakpoint
DELETE FROM chat_message;--> statement-breakpoint
DELETE FROM chat_conversation;--> statement-breakpoint
DELETE FROM agent;--> statement-breakpoint

-- Drop kind / config / sandbox_name. Postgres drops their indexes
-- automatically (`agent_kind_idx`, `agent_sandbox_name_idx`).
ALTER TABLE "agent" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "config";--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "sandbox_name";--> statement-breakpoint

-- Add Phase 2 columns. NOT NULL with sane defaults works because we
-- just truncated the table.
ALTER TABLE "agent" ADD COLUMN "system_prompt" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "model" text NOT NULL DEFAULT 'openai/gpt-5-mini';--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "heartbeat_enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "heartbeat_interval_minutes" integer NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "sandbox_system_id" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "sandbox_exec_id" text;
