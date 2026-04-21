DROP INDEX IF EXISTS "chat_conversation_agent_unique_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversation_agent_updated_idx" ON "chat_conversation" USING btree ("agent_id","updated_at" DESC NULLS LAST);
