-- Multi-session chat: drop the 1:1 unique index on chat_conversation
-- and add a compound index to make "most recent conversation per agent"
-- and sidebar ordering cheap.

DROP INDEX IF EXISTS "chat_conversation_agent_unique_idx";

CREATE INDEX IF NOT EXISTS "chat_conversation_agent_updated_idx"
  ON "chat_conversation" ("agent_id", "updated_at" DESC);
