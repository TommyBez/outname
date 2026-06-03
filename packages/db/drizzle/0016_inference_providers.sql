CREATE TABLE "user_inference_credentials" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "inference_provider" text NOT NULL,
  "encrypted_credentials" text NOT NULL,
  "status" text NOT NULL,
  "verified_at" timestamp with time zone,
  "last_error" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "inference_provider")
);

ALTER TABLE "user" ADD COLUMN "default_inference_provider" text;

INSERT INTO "user_inference_credentials" (
  "user_id",
  "inference_provider",
  "encrypted_credentials",
  "status",
  "verified_at",
  "metadata"
)
SELECT
  "id",
  'vercel-ai-gateway',
  "ai_gateway_api_key",
  'enabled',
  now(),
  '{"migratedFrom":"user.ai_gateway_api_key"}'::jsonb
FROM "user"
WHERE "ai_gateway_api_key" IS NOT NULL;

UPDATE "user"
SET "default_inference_provider" = 'vercel-ai-gateway'
WHERE "ai_gateway_api_key" IS NOT NULL
  AND "default_inference_provider" IS NULL;

ALTER TABLE "agent"
  ADD COLUMN "inference_provider" text DEFAULT 'vercel-ai-gateway' NOT NULL;

ALTER TABLE "agent_token_usage"
  ADD COLUMN "inference_provider" text DEFAULT 'vercel-ai-gateway' NOT NULL;

ALTER TABLE "agent_token_usage"
  RENAME COLUMN "model" TO "requested_model";

ALTER TABLE "agent_token_usage"
  RENAME COLUMN "cost_usd" TO "estimated_cost_usd";

ALTER TABLE "agent_token_usage"
  ALTER COLUMN "estimated_cost_usd" TYPE numeric(18, 12)
  USING "estimated_cost_usd"::numeric;

ALTER TABLE "agent_token_usage"
  RENAME COLUMN "cached_input_tokens" TO "cache_read_tokens";

ALTER TABLE "agent_token_usage"
  ADD COLUMN "cache_write_tokens" integer DEFAULT 0 NOT NULL,
  ADD COLUMN "actual_cost_usd" numeric(18, 12),
  ADD COLUMN "cost_source" text DEFAULT 'estimated' NOT NULL,
  ADD COLUMN "generation_id" text,
  ADD COLUMN "upstream_provider" text,
  ADD COLUMN "billed_model" text,
  ADD COLUMN "pricing_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
  ADD COLUMN "cost_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "agent_token_usage"
  DROP COLUMN "input_rate_usd_per_token",
  DROP COLUMN "output_rate_usd_per_token";

ALTER TABLE "user" DROP COLUMN "ai_gateway_api_key";
