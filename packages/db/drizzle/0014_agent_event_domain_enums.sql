-- Remove legacy durable chat events and enforce the current durable event domain.

DELETE FROM "agent_events"
WHERE
  "type" NOT IN ('heartbeat', 'dreaming', 'invocation')
  OR "source" NOT IN ('scheduler', 'manual', 'invocation');--> statement-breakpoint

CREATE TYPE "agent_event_type" AS ENUM (
  'heartbeat',
  'dreaming',
  'invocation'
);--> statement-breakpoint

CREATE TYPE "agent_event_source" AS ENUM (
  'scheduler',
  'manual',
  'invocation'
);--> statement-breakpoint

ALTER TABLE "agent_events"
  ALTER COLUMN "type" TYPE "agent_event_type"
  USING "type"::"agent_event_type";--> statement-breakpoint

ALTER TABLE "agent_events"
  ALTER COLUMN "source" TYPE "agent_event_source"
  USING "source"::"agent_event_source";
