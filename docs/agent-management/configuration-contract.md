# Agent Configuration Contract

Implementation contract:
- `AgentFormState` mirrors persisted fields; `activeBootstrapFile` is view state and excluded from dirty checks.
- Save rejects blank names client-side and trims before calling server actions.
- Create sends `CreateInput` to `createAgentAction`; edit sends `UpdateAgentInput` plus original bootstrap contents.
- Bootstrap mapping is `identityCard -> IDENTITY.md`, `identity -> SOUL.md`, `instructions -> AGENTS.md`, and `userProfile -> USER.md`.
- Configure provider options include the current provider even if it is no longer configured.
- Changing provider keeps the current model only when it exists for that provider; otherwise it selects the provider default.
- Custom step limit is persisted only for `custom`; other modes persist `stepLimitCustom: null`.
- Dirty and unload guards cover persisted field changes, not bootstrap tab selection.
- The update service revalidates provider/model changes, normalizes schedule values, writes changed bootstrap files, and refreshes capability summary.

Source anchors: `packages/shared/agents/components/agent-form.tsx`, `packages/shared/agents/components/agent-form/agent-form-state.ts`, `packages/shared/agents/components/agent-form/model-selector.tsx`, `packages/shared/agents/components/agent-form/options.ts`, `packages/shared/agents/server/update-service.ts`.
