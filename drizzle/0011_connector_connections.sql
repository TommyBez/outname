ALTER TABLE "user_connections" ADD COLUMN "connector_id" text;

UPDATE "user_connections"
SET "connector_id" = CASE "provider"
  WHEN 'resend' THEN 'resend.api_key'
  WHEN 'calcom' THEN 'calcom.api_key'
  WHEN 'context7' THEN 'context7.api_key'
  WHEN 'firecrawl' THEN 'firecrawl.api_key'
  WHEN 'github' THEN 'github.personal_access_token'
  WHEN 'parallel' THEN 'parallel.api_key'
  WHEN 'posthog' THEN 'posthog.api_key'
  WHEN 'x' THEN 'x.bearer_token'
  WHEN 'typefully' THEN 'typefully.api_key'
  WHEN 'supabase' THEN 'supabase.personal_access_token'
  WHEN 'v0' THEN 'v0.api_key'
  WHEN 'vercel' THEN 'vercel.api_token'
  ELSE "provider"
END;

ALTER TABLE "user_connections" ALTER COLUMN "connector_id" SET NOT NULL;
ALTER TABLE "user_connections" ADD COLUMN "granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "user_connections" DROP CONSTRAINT "user_connections_user_id_provider_pk";
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_connector_id_pk" PRIMARY KEY("user_id","connector_id");
ALTER TABLE "user_connections" DROP COLUMN "provider";
