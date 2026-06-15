# Agent Creation Chat State

State model:
- The creation transcript is client memory only; there is no durable chat row or replay source.
- A reload/tab close warns while messages exist and no `create_requested_agent` output is available.
- Tool parts carry proposal state, approval state, final config, and creation output inside the AI SDK message stream.
- `AgentCreationRequest` persists into an `agent` row, bootstrap markdown, tool attachments, capability summary, and budget rules.
- Positive budget caps create daily/weekly/monthly rules; null or non-positive creation caps are skipped.
- Tool attachment results return `connected`, `pending`, or `failed` per requested attachment.

Source anchors: `packages/shared/agents/components/agent-creation-chat.tsx`, `packages/shared/agents/api/creation-chat/schemas.ts`, `packages/shared/agents/api/creation-chat/create-requested-agent.ts`, `packages/shared/agents/components/agent-creation-chat/create-agent-tool-card.tsx`.
