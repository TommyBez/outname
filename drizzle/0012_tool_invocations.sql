CREATE TABLE IF NOT EXISTS "tool_invocations" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text,
	"run_id" text,
	"conversation_id" text,
	"tool_id" text NOT NULL,
	"kind" text NOT NULL,
	"ok" boolean NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tool_invocations" DROP CONSTRAINT IF EXISTS "tool_invocations_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tool_invocations" DROP CONSTRAINT IF EXISTS "tool_invocations_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_agent_created_idx" ON "tool_invocations" ("agent_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_user_created_idx" ON "tool_invocations" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tool_invocations_tool_created_idx" ON "tool_invocations" ("tool_id", "created_at" DESC);
