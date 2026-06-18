# Agent Product Shell

Implementation contract:
- `AgentLayout` wraps every agent page in `AppShell`, agent sidebar extras, `AgentWorkspaceFrame`, and the global command palette.
- `AgentWorkspaceFrame` requires session, loads the owned agent plus user timezone, and calls `notFound()` on missing ownership.
- Header badges show active/paused, model, heartbeat schedule, and dreaming state.
- Header actions are `Trigger now`, `Dream`, and `Configure`; trigger POST rejects paused agents with 412.
- Workspace tabs are Overview, Chat, Events, Configure, Tools, Skills, and Memory.
- Active-tab aliases include `/about` for overview, `/edit` for configure, and `/files`, `/timeline`, `/dreams` for memory.
- Sidebar extras load cached conversations as ISO strings, then SWR owns client refresh.
- Cmd+K receives the current user's agent ids, names, and enabled flags.

Source anchors: `apps/app/app/agents/[agentId]/layout.tsx`, `packages/shared/agents/components/agent-workspace.tsx`, `packages/shared/agents/components/agent-workspace-header.tsx`, `packages/ai/chat/components/agent-sidebar-section.tsx`, `packages/shared/agents/components/global-command-palette.tsx`, `apps/api/app/api/agents/[agentId]/trigger/route.ts`.
