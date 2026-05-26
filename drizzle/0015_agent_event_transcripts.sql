CREATE TABLE "agent_event_message" (
  "id" text PRIMARY KEY NOT NULL,
  "event_id" text NOT NULL,
  "user_id" text NOT NULL,
  "message_id" text NOT NULL,
  "message_order" integer NOT NULL,
  "role" text NOT NULL,
  "parts" jsonb NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "agent_event_message"
  ADD CONSTRAINT "agent_event_message_event_id_agent_events_id_fk"
  FOREIGN KEY ("event_id") REFERENCES "agent_events"("id") ON DELETE cascade;--> statement-breakpoint

ALTER TABLE "agent_event_message"
  ADD CONSTRAINT "agent_event_message_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;--> statement-breakpoint

CREATE UNIQUE INDEX "agent_event_message_event_order_idx"
  ON "agent_event_message" ("event_id", "message_order");--> statement-breakpoint

CREATE INDEX "agent_event_message_user_event_idx"
  ON "agent_event_message" ("user_id", "event_id");
