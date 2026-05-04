CREATE TABLE IF NOT EXISTS "channel_installations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"credentials" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_installations" DROP CONSTRAINT IF EXISTS "channel_installations_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_installations" ADD CONSTRAINT "channel_installations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_installations_unique_idx" ON "channel_installations" ("user_id", "channel", "external_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_installations_channel_idx" ON "channel_installations" ("channel");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_channel_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"channel" text NOT NULL,
	"external_key" text NOT NULL,
	"kind" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_channel_bindings" DROP CONSTRAINT IF EXISTS "agent_channel_bindings_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_channel_bindings" ADD CONSTRAINT "agent_channel_bindings_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_channel_bindings_lookup_idx" ON "agent_channel_bindings" ("channel", "external_key", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_channel_bindings_agent_idx" ON "agent_channel_bindings" ("agent_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "channel_thread_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"external_thread_key" text NOT NULL,
	"conversation_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" DROP CONSTRAINT IF EXISTS "channel_thread_conversations_conversation_id_chat_conversation_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD CONSTRAINT "channel_thread_conversations_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" DROP CONSTRAINT IF EXISTS "channel_thread_conversations_agent_id_agent_id_fk";
--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD CONSTRAINT "channel_thread_conversations_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_thread_conversations_external_idx" ON "channel_thread_conversations" ("channel", "external_thread_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_thread_conversations_conversation_idx" ON "channel_thread_conversations" ("conversation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_thread_conversations_agent_idx" ON "channel_thread_conversations" ("agent_id");
