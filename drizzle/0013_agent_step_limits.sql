ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "step_limit_mode" text DEFAULT 'medium' NOT NULL;
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "step_limit_custom" integer;
