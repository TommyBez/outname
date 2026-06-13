CREATE TABLE IF NOT EXISTS "launch_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "launch_key" text NOT NULL,
  "feedback_type" text NOT NULL,
  "message" text NOT NULL,
  "email" text,
  "referrer" text,
  "source" text,
  "user_agent" text,
  "utm_campaign" text,
  "utm_content" text,
  "utm_medium" text,
  "utm_source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "launch_feedback_launch_created_idx" ON "launch_feedback" USING btree ("launch_key","created_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "launch_feedback_email_created_idx" ON "launch_feedback" USING btree ("email","created_at" DESC NULLS LAST);
