-- Phase 3: replace the bespoke `gmail_connection` table with a generic
-- `user_connections` table (one row per (user, provider)) plus an
-- `agent_tools` table that links agents to entries in the maintainer
-- tool registry. We're not in production yet, so the disruptive drop is
-- acceptable per the architect review.

-- Drop the Gmail-specific table; the generic store supersedes it.
DROP TABLE IF EXISTS "gmail_connection";--> statement-breakpoint

-- One row per (user, provider). Credentials are AES-256-GCM encrypted
-- at rest by the application layer; the column holds the base64-encoded
-- envelope (version | iv | tag | ciphertext). See `lib/connection-crypto.ts`.
--
-- `metadata.scopes` is the source of truth for granted OAuth scopes —
-- runtime scope-gap detection lives there, not on the connector. Other
-- free-form fields (account email, account id, ...) are picked by the
-- connector at exchange/refresh time.
--
-- `status` is owned exclusively by `connectors/runtime.ts` (see the
-- transition table at the top of that file).
CREATE TABLE "user_connections" (
    "user_id" text NOT NULL,
    "provider" text NOT NULL,
    "credentials" text NOT NULL,
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "status" text NOT NULL DEFAULT 'active',
    "expires_at" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_connections_pk" PRIMARY KEY ("user_id", "provider"),
    CONSTRAINT "user_connections_user_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint

CREATE INDEX "user_connections_user_idx"
    ON "user_connections" ("user_id");--> statement-breakpoint

-- Per-agent attached tools. PK is (agent_id, tool_id) so an agent can't
-- accidentally hold two attachments of the same maintainer tool.
-- `tool_id` uses the registry id (e.g. "gmail_search"); registry drift
-- is surfaced as `reason: "tool_removed"` rather than a hard crash.
-- `config` is validated against `tool.configSchema` at attach time AND
-- at every event boot — runtime drift is surfaced as `config_invalid`.
CREATE TABLE "agent_tools" (
    "agent_id" text NOT NULL,
    "tool_id" text NOT NULL,
    "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "agent_tools_pk" PRIMARY KEY ("agent_id", "tool_id"),
    CONSTRAINT "agent_tools_agent_id_fk"
        FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
);--> statement-breakpoint

CREATE INDEX "agent_tools_agent_idx"
    ON "agent_tools" ("agent_id");
