UPDATE "agent_events"
SET "workflow_run_id" = NULL
WHERE "workflow_run_id" LIKE 'starting:%';

ALTER TABLE "agent_events" DROP COLUMN "publisher_workflow_run_id";
