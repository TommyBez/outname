CREATE TABLE IF NOT EXISTS "budget_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text,
	"period" text NOT NULL,
	"limit_usd" numeric(12, 6) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "budget_rule" DROP CONSTRAINT IF EXISTS "budget_rule_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_rule" ADD CONSTRAINT "budget_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "budget_rule" DROP CONSTRAINT IF EXISTS "budget_rule_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_rule" ADD CONSTRAINT "budget_rule_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_rule_user_idx" ON "budget_rule" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "budget_rule_agent_idx" ON "budget_rule" ("agent_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_rule_user_general_period_unique_idx" ON "budget_rule" ("user_id", "period") WHERE agent_id IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budget_rule_user_agent_period_unique_idx" ON "budget_rule" ("user_id", "agent_id", "period") WHERE agent_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_token_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"root_agent_id" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"reasoning_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"cost_usd" numeric(14, 9) DEFAULT '0' NOT NULL,
	"input_rate_usd_per_token" numeric(14, 12),
	"output_rate_usd_per_token" numeric(14, 12),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_token_usage" DROP CONSTRAINT IF EXISTS "agent_token_usage_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_token_usage" DROP CONSTRAINT IF EXISTS "agent_token_usage_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_token_usage" DROP CONSTRAINT IF EXISTS "agent_token_usage_root_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_root_agent_id_agent_id_fk" FOREIGN KEY ("root_agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_token_usage_user_created_idx" ON "agent_token_usage" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_token_usage_root_agent_created_idx" ON "agent_token_usage" ("root_agent_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_token_usage_agent_created_idx" ON "agent_token_usage" ("agent_id", "created_at" DESC);
