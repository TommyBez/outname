DROP TABLE "digest_items" CASCADE;--> statement-breakpoint
DROP TABLE "digests" CASCADE;--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "emails_scanned";--> statement-breakpoint
CREATE TABLE "run_result" (
	"run_id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_result" ADD CONSTRAINT "run_result_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
