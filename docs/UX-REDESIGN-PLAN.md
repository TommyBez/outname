# UX Flow Map and Information Architecture Redesign

## Goal
Make every core workflow clear, discoverable, and consistent without changing the visual design system.

## Current UX Flow Map

### Global flows
1. **Login** → `/login`
2. **Dashboard** → `/dashboard` (high-level status and agent list)
3. **Agents index** → `/agents` (browse/select agents)
4. **Settings** → `/settings` (global config)

### Agent workspace flows
1. **Agent entry**: `/agents/[agentId]` redirects to `/agents/[agentId]/chat`
2. **Chat entry**: `/agents/[agentId]/chat` redirects to latest conversation or `/chat/new`
3. **Conversation detail**: `/agents/[agentId]/chat/[conversationId]`
4. **Agent overview**: `/agents/[agentId]/about`
5. **Agent configuration**: `/agents/[agentId]/edit`
6. **Agent timeline**: `/agents/[agentId]/timeline`
7. **Agent dreams**: `/agents/[agentId]/dreams`
8. **Agent tools**: `/agents/[agentId]/tools`
9. **Agent files**: `/agents/[agentId]/files`

## UX Issues Identified

1. **Scattered configuration paths**: some management pages existed but were not consistently surfaced from the primary navigation.
2. **Mixed intent in one list**: action items (new chat), management pages, and conversation history were blended together.
3. **Inconsistent naming**: “About” and “Configure” labels were less explicit than “Overview” and “Settings”.
4. **Low discoverability for non-chat pages**: Tools and Files were hidden paths for many users.

## Redesign Decisions

### Remove (from primary decision complexity)
- Removed ambiguous top-level wording in agent workspace nav:
  - “About” → replaced with **Overview**
  - “Configure” → replaced with **Settings**
- Removed ungrouped mixed navigation pattern that combined creation, management, and history without separation.

### Improve
- **Structured sidebar IA** into three explicit sections:
  1. **Workspace** (immediate action)
  2. **Manage** (agent-level configuration and diagnostics)
  3. **Conversations** (history and switching)
- Promoted missing-but-important pages (Tools, Files) into the **Manage** section.
- Kept existing route architecture and visual styling intact.

### Add
- Added explicit section labels for mental-model clarity.
- Added direct navigation entries for:
  - Tools
  - Files

## Consistency Rules Enforced

1. **Action first, configuration second, history third** in sidebar order.
2. **Noun-based labels** for destination pages (Overview, Settings, Tools, Files, Timeline, DREAMS).
3. **All durable agent-level destinations discoverable from one place** (agent sidebar).
4. **No visual redesign**: only information architecture and labeling updates.

## Expected UX Outcomes

- Faster orientation for first-time users entering an agent workspace.
- Reduced “where is X?” path-hunting for files/tools/config.
- Clear separation between starting work (new chat), managing agent behavior, and navigating prior conversations.
