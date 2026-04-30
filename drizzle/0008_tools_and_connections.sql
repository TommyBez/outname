-- Drop the bespoke gmail_connection table from Phase 2.
-- Pre-prod, no data preservation needed.
DROP TABLE IF EXISTS "gmail_connection";

--> statement-breakpoint
-- Generic per-(user, provider) API-key credential store. `credentials` is the
-- base64 AES-256-GCM envelope produced by lib/connection-crypto.ts.
-- `metadata` is connector-defined status context. `status` lifecycle
-- is owned by connectors/runtime.ts (`active` | `invalid`).
CREATE TABLE IF NOT EXISTS "user_connections" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"credentials" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_connections_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);

--> statement-breakpoint
ALTER TABLE "user_connections" DROP CONSTRAINT IF EXISTS "user_connections_user_id_user_id_fk";
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_connections_user_idx" ON "user_connections" ("user_id");

--> statement-breakpoint
-- Agent's attached maintainer tools. tool_id is the registry id.
-- config is validated against the tool's configSchema at attach time
-- and at every event boot.
CREATE TABLE IF NOT EXISTS "agent_tools" (
	"agent_id" text NOT NULL,
	"tool_id" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tools_agent_id_tool_id_pk" PRIMARY KEY("agent_id","tool_id")
);

--> statement-breakpoint
ALTER TABLE "agent_tools" DROP CONSTRAINT IF EXISTS "agent_tools_agent_id_agent_id_fk";
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_tools_agent_idx" ON "agent_tools" ("agent_id");
