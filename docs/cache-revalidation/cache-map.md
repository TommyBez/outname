# Cache Map

Scope: cache tags, cached readers, and mutation invalidators.

Tags:
- `userAgentsTag(userId)`: agent lists and owner-scoped agent reads.
- `agentTag(agentId)`: agent detail, memory files, log files, and memory file reads.
- `userConnectionsTag(userId)`: cached user connection lists.
- `agentToolsTag(agentId)`: cached tool attachments for an agent.
- `agentSkillsTag(agentId)`: cached skills for an agent.
- `conversationListTag(agentId)`: chat sidebar conversation list.
- `userBudgetTag(userId)`: budget summaries/settings.
- `userTimezoneTag(userId)`: timezone display and settings state.

Invalidators:
- Agent create/update/delete calls refresh user and agent tags plus app paths.
- Tool attach/detach/build calls refresh tool, agent, and user-agent tags.
- Skill writes refresh skill, agent, and user-agent surfaces.
- Connections actions and OAuth callbacks refresh user connection tags.
- Chat actions, realtime runner, title generation, and channel dispatch refresh conversations.
- Budget and timezone actions refresh their user-scoped tags.

Invariants:
- Use helpers from `cache-tags.ts`; never inline tag string formats.
- Most cached readers use `cacheLife('minutes')` plus `cacheTag(...)`.

Anchors: `packages/shared/server/cache-tags.ts`, `packages/shared/server/data.ts`,
`packages/ai/chat/server/chat.ts`, `packages/shared/*/actions.ts`.
