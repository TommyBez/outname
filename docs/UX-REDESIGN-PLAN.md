# UX Flow Map and Consistency Redesign

## Objective
Create a clear, discoverable, and consistent UX across the **entire application flow**, without changing the visual design system.

## Complete UX Flow Map (Current)

### 1) Access and session
1. Login (`/login`)
2. Redirect to private surfaces after auth (`/dashboard`)

### 2) Global app navigation
1. Dashboard (`/dashboard`) — system summary and activity
2. Agents (`/agents`) — list and browse agents
3. Settings (`/settings`) — account, connections, budgets

### 3) Agent lifecycle
1. Create agent (`/agents/new`)
2. Return path to list (`/agents`)
3. Open specific agent (`/agents/[agentId]`)

### 4) Agent workspace entry flow
1. Agent root (`/agents/[agentId]`) redirects to chat entry
2. Chat entry (`/agents/[agentId]/chat`) resolves to:
   - most recent conversation (`/agents/[agentId]/chat/[conversationId]`) or
   - new conversation draft (`/agents/[agentId]/chat/new`)

### 5) Agent workspace destinations
1. Overview (`/agents/[agentId]/about`)
2. Settings (`/agents/[agentId]/edit`)
3. Tools (`/agents/[agentId]/tools`)
4. Files (`/agents/[agentId]/files`)
5. Timeline (`/agents/[agentId]/timeline`)
6. DREAMS (`/agents/[agentId]/dreams`)
7. Conversations list and per-conversation routes

### 6) Settings subflows
1. Connections (OAuth/API-key integration state)
2. Budget rules
3. Agent summary and handoff back to `/agents`
4. Account identity status

## Evaluation

### What to remove
1. **Remove mixed-intent nav blocks** where creation, management, and history are merged in one undifferentiated list.
2. **Remove ambiguous labels** that hide intent:
   - About → Overview
   - Configure → Settings
3. **Remove hidden-path dependency** where users must discover core surfaces by route guessing.

### What to improve
1. **Global discoverability**: provide a direct “New agent” path from the global sidebar.
2. **Local discoverability**: ensure every durable agent surface is visible inside the agent sidebar.
3. **Flow consistency**: enforce a stable order:
   - create/work action
   - management destinations
   - historical artifacts
4. **Terminology consistency**: destination names should be nouns and match page intent.

### What to add
1. Add a global quick action to create agents.
2. Add explicit sectioning in agent sidebar:
   - Workspace
   - Manage
   - Conversations
3. Add direct links for Tools and Files in primary in-context nav.

## Implemented changes

1. **Application sidebar** now includes a first-class **New agent** action to reduce path friction from anywhere in the app.
2. **Agent workspace sidebar IA** reorganized into explicit sections to separate action, management, and history.
3. **Label normalization** implemented for better findability and scanability.
4. **Tools/Files surfaced** as first-class destinations in the manage section.

## Consistency rules enforced

1. One global source of truth for top-level app destinations.
2. One contextual source of truth for all agent-level destinations.
3. Stable ordering of flows across agents.
4. No visual redesign; only information architecture and wayfinding updates.
