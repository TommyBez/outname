# Realtime Turns Edge Cases

Failure modes:
- Missing agent throws `runRealtimeChatTurn: agent ... not found`.
- Owner mismatch throws before budget or sandbox work.
- Budget exceeded writes a persisted refusal and optionally posts the same text to a channel.
- UI `finishReason: error` logs and drops the assistant turn; aborted turns are also dropped.
- Usage-recording failures are caught inside the scheduled background task.
- Title-generation failures are caught and logged after the stream finishes.
- Missing system sandbox during cleanup/file-cache refresh is downgraded to a warning in cleanup code.

Source anchors: `packages/ai/agent-runtime/server/realtime-chat-runner.ts`, `packages/ai/agent-runtime/server/realtime-cleanup.ts`, `packages/ai/agent-runtime/server/agent-sandbox.ts`.
