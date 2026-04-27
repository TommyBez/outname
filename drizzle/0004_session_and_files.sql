CREATE TABLE "agent_files" (
	"agent_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"sha256" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_files_agent_id_path_pk" PRIMARY KEY("agent_id","path")
);
--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "last_session_run_id" text;--> statement-breakpoint
ALTER TABLE "agent_files" ADD CONSTRAINT "agent_files_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_files_agent_idx" ON "agent_files" USING btree ("agent_id");
