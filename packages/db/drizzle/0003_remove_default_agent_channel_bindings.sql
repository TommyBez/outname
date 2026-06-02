-- Deprecated workspace-fallback bindings (kind = default) are no longer supported.
DELETE FROM "agent_channel_bindings" WHERE "kind" = 'default';
