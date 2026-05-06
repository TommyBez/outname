CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"accessTokenExpiresAt" timestamp with time zone,
	"refreshTokenExpiresAt" timestamp with time zone,
	"scope" text,
	"idToken" text,
	"password" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"capability_summary" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"model" text DEFAULT 'openai/gpt-5-mini' NOT NULL,
	"step_limit_mode" text DEFAULT 'medium' NOT NULL,
	"step_limit_custom" integer,
	"heartbeat_enabled" boolean DEFAULT true NOT NULL,
	"heartbeat_interval_minutes" integer DEFAULT 30 NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"reflection_enabled" boolean DEFAULT true NOT NULL,
	"reflection_interval_minutes" integer DEFAULT 1440 NOT NULL,
	"last_reflection_at" timestamp with time zone,
	"last_reflection_local_date" text,
	"sandbox_system_id" text,
	"sandbox_exec_id" text,
	"last_session_run_id" text,
	"last_ticker_run_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_channel_bindings" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"channel" text NOT NULL,
	"team_id" text DEFAULT '' NOT NULL,
	"external_key" text NOT NULL,
	"kind" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_file_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"path" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text,
	"before_content" text,
	"after_content" text,
	"before_sha256" text,
	"after_sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "agent_files" (
	"agent_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"sha256" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_files_agent_id_path_pk" PRIMARY KEY("agent_id","path")
);
--> statement-breakpoint
CREATE TABLE "agent_token_usage" (
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
CREATE TABLE "agent_tools" (
	"agent_id" text NOT NULL,
	"tool_id" text NOT NULL,
	"kind" text DEFAULT 'maintainer' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"tool_sandbox_manifest" text,
	"tool_sandbox_manifest_hash" text,
	"tool_sandbox_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tools_agent_id_kind_tool_id_pk" PRIMARY KEY("agent_id","kind","tool_id")
);
--> statement-breakpoint
CREATE TABLE "budget_rule" (
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
CREATE TABLE "channel_installations" (
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
CREATE TABLE "channel_thread_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"team_id" text DEFAULT '' NOT NULL,
	"external_thread_key" text NOT NULL,
	"conversation_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"parts" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_file_writes" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"path" text NOT NULL,
	"content" text NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tool_invocations" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"user_id" text,
	"run_id" text,
	"conversation_id" text,
	"tool_id" text NOT NULL,
	"kind" text NOT NULL,
	"ok" boolean NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_sandbox_builds" (
	"id" text PRIMARY KEY NOT NULL,
	"manifest_id" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"status" text NOT NULL,
	"workflow_run_id" text,
	"error_text" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tool_sandbox_snapshots" (
	"manifest_id" text PRIMARY KEY NOT NULL,
	"snapshot_id" text NOT NULL,
	"manifest_hash" text NOT NULL,
	"built_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_connections" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"credentials" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_connections_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_channel_bindings" ADD CONSTRAINT "agent_channel_bindings_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_file_changes" ADD CONSTRAINT "agent_file_changes_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_files" ADD CONSTRAINT "agent_files_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_token_usage" ADD CONSTRAINT "agent_token_usage_root_agent_id_agent_id_fk" FOREIGN KEY ("root_agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tools" ADD CONSTRAINT "agent_tools_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_rule" ADD CONSTRAINT "budget_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_rule" ADD CONSTRAINT "budget_rule_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_installations" ADD CONSTRAINT "channel_installations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD CONSTRAINT "channel_thread_conversations_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_thread_conversations" ADD CONSTRAINT "channel_thread_conversations_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_file_writes" ADD CONSTRAINT "pending_file_writes_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_channel_bindings_lookup_idx" ON "agent_channel_bindings" USING btree ("channel","team_id","external_key","kind");--> statement-breakpoint
CREATE INDEX "agent_channel_bindings_agent_idx" ON "agent_channel_bindings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_file_changes_agent_created_idx" ON "agent_file_changes" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_file_changes_path_idx" ON "agent_file_changes" USING btree ("path");--> statement-breakpoint
CREATE INDEX "agent_files_agent_idx" ON "agent_files" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_token_usage_user_created_idx" ON "agent_token_usage" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_token_usage_root_agent_created_idx" ON "agent_token_usage" USING btree ("root_agent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_token_usage_agent_created_idx" ON "agent_token_usage" USING btree ("agent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_tools_agent_idx" ON "agent_tools" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_tools_sandbox_manifest_idx" ON "agent_tools" USING btree ("tool_sandbox_manifest");--> statement-breakpoint
CREATE INDEX "agent_tools_kind_idx" ON "agent_tools" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "budget_rule_user_idx" ON "budget_rule" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budget_rule_agent_idx" ON "budget_rule" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_rule_user_general_period_unique_idx" ON "budget_rule" USING btree ("user_id","period") WHERE agent_id IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "budget_rule_user_agent_period_unique_idx" ON "budget_rule" USING btree ("user_id","agent_id","period") WHERE agent_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_installations_unique_idx" ON "channel_installations" USING btree ("user_id","channel","external_id");--> statement-breakpoint
CREATE INDEX "channel_installations_channel_idx" ON "channel_installations" USING btree ("channel");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_thread_conversations_external_idx" ON "channel_thread_conversations" USING btree ("channel","team_id","external_thread_key");--> statement-breakpoint
CREATE INDEX "channel_thread_conversations_conversation_idx" ON "channel_thread_conversations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "channel_thread_conversations_agent_idx" ON "channel_thread_conversations" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "chat_conversation_agent_updated_idx" ON "chat_conversation" USING btree ("agent_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chat_message_conversation_idx" ON "chat_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "pending_file_writes_agent_unapplied_idx" ON "pending_file_writes" USING btree ("agent_id") WHERE "pending_file_writes"."applied_at" is null;--> statement-breakpoint
CREATE INDEX "tool_invocations_agent_created_idx" ON "tool_invocations" USING btree ("agent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tool_invocations_user_created_idx" ON "tool_invocations" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tool_invocations_tool_created_idx" ON "tool_invocations" USING btree ("tool_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tool_sandbox_builds_manifest_status_idx" ON "tool_sandbox_builds" USING btree ("manifest_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_sandbox_builds_active_unique_idx" ON "tool_sandbox_builds" USING btree ("manifest_id","manifest_hash") WHERE status in ('pending', 'running');--> statement-breakpoint
CREATE INDEX "user_connections_user_idx" ON "user_connections" USING btree ("user_id");