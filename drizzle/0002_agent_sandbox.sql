-- Add a per-agent sandbox pointer. The column holds the persistent-sandbox
-- NAME (not id) so the agent can resume its own Vercel Sandbox via
-- Sandbox.get({ name }). Nullable: the first run provisions the sandbox and
-- stores the name.
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "sandbox_name" text;

-- Unique where present, to guarantee one-sandbox-per-agent.
CREATE UNIQUE INDEX IF NOT EXISTS "agent_sandbox_name_idx"
  ON "agent" ("sandbox_name")
  WHERE "sandbox_name" IS NOT NULL;
