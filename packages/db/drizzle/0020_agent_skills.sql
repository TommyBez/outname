ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "sandbox_skills_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_skills" (
  "agent_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "name_normalized" text NOT NULL,
  "description" text NOT NULL,
  "source_type" text NOT NULL,
  "source_url" text,
  "source_ref" text,
  "source_path" text,
  "content_hash" text NOT NULL,
  "file_count" integer NOT NULL,
  "total_bytes" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agent_skills_agent_id_slug_pk" PRIMARY KEY("agent_id","slug")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_skills_agent_name_unique_idx" ON "agent_skills" USING btree ("agent_id","name_normalized");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_skills_agent_idx" ON "agent_skills" USING btree ("agent_id");
