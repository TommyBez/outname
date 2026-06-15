# Agent Creation Chat Invariants

Rules enforced in source:
- Before suggesting exact tool ids, the assistant must call `list_available_tools`.
- Multiple enabled providers require an explicit user provider choice before final creation.
- Final creation must include both `inferenceProvider` and provider-scoped `model`.
- The assistant must call `propose_agent_budget` exactly once, wait for the widget follow-up, then use those confirmed values.
- `create_requested_agent` mutates only after AI SDK tool approval.
- If approval is denied, the assistant should ask for changes instead of retrying the same create call.
- `instructions` is only the custom block appended below the platform `AGENTS.md` template.

Source anchors: `packages/shared/agents/api/creation-chat/instructions.ts`, `packages/shared/agents/api/creation-chat/schemas.ts`, `packages/shared/agents/components/agent-creation-chat/budget-card.tsx`, `packages/shared/agents/api/creation-chat/create-requested-agent.ts`.
