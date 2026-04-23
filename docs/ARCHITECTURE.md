# Personal Assistant Agent — Target Architecture

**Status:** design spec for the main refactor (pre-1.0, not in production).
**Audience:** the engineer(s) executing the refactor; future contributors.

---

## 0. How to read this doc

Sections 3–6 describe the **end state**. Section 7 describes **how we get there**, phase by phase, with each phase leaving the app in a working, demoable, testable state.

Disruptive changes are allowed. We are not yet in production and will not be until the full refactor is complete — no data-preserving migrations are required. Where the refactor forces us to throw away existing code or tables, we do so without ceremony.

Section 8 names the known follow-ups that are explicitly **out of scope** for this refactor.

---

## 1. Scope & non-goals

### In scope
- Generalising from a single hard-coded agent (`daily-email-brief`) to **user-created agents** configured from a UI.
- A **tool catalog** of maintainer-built tools users can attach to their agents.
- **Proactive agents** via a heartbeat loop, driven by structured markdown files.
- **Agents-as-tools** (sub-agents) with recursion and cycle guards.
- **Persistent-identity home sandboxes** per agent, with a markdown-based "mind" (SOUL, MEMORY, TASKS, CALENDAR, GOALS, DREAMS, daily logs).
- **On-demand tool sandboxes** for tools with heavy runtime needs.

### Non-goals (this refactor)
- **Multi-user sharing of agents.** One user owns each agent; no team / shared-agent concept.
- **User-defined tools.** No no-code/low-code tool builder — tools are maintainer code. (Sub-agents are the only user-authored "tools.")
- **Structured UI widgets** (task lists, calendar grids, etc.) over agent-produced MD. v1 renders markdown verbatim.
- **Persistent per-agent tool-sandboxes** (logged-in browser sessions, long-lived dev environments). Designed-for but built later — see §8.
- **Multi-tenancy beyond per-user scoping.** No orgs, no workspaces, no billing.
- **Backwards-compatible data migration.** Disruptive reset of existing `daily-email-brief` data is allowed.

---

## 2. Current state (one paragraph)

Next.js 16 on Vercel. One hard-coded agent kind (`daily-email-brief`) using `@workflow/ai`'s `DurableAgent`. Drizzle + Neon Postgres. Better Auth for user accounts. `@vercel/sandbox` is wired in with a persistent-sandbox-per-agent pattern in [`lib/agent-sandbox.ts`](lib/agent-sandbox.ts). No tool catalog; tools are defined inline per agent in [`workflows/agents/daily-email-brief/agent.ts`](workflows/agents/daily-email-brief/agent.ts). Cron triggers were just removed (commit `723b33b`). Chat UI streams via `useChat`.

---

## 3. Core abstractions

The system has exactly four primitives. Everything else is composition.

### Agent
A user-created entity with:
- **Structured config** (DB columns): name, model, heartbeat enabled + interval, attached tool IDs, owner user ID.
- **Prose identity** (`SOUL.md` in its sandbox): personality, ethics, communication style.
- **A lifelong session workflow** (§4.1) — one per agent, always running while the agent is enabled.
- **A home sandbox** (§4.2) — a persistent filesystem for its markdown "mind."

### Tool
An invocable capability. Two populations, one interface:
- **Maintainer tools** — global, code-defined, versioned with the app (`gmail.search`, `bash`, `browser.open`, …).
- **Synthesized agent-tools** — one per user-owned agent, generated at runtime so agents can call each other (§4.5).

To the LLM they are indistinguishable.

### Sandbox
A Vercel Sandbox microVM. Every agent has **one home sandbox** for its markdown files and a bash workspace. Tools with heavy runtime needs (Chromium, Python, ffmpeg) get **on-demand tool sandboxes**, spun up per invocation from pre-built base snapshots.

### Session workflow
A single long-lived Vercel Workflow run per agent. It parks on an iterable `createHook()` and is fed by a sibling "ticker" workflow that drives the heartbeat. All events in the agent's life — chat messages, heartbeat ticks, sub-agent invocations, sub-agent replies — arrive on this hook and are processed sequentially. The sandbox is snapshotted at the end of every event.

---

## 4. Architecture

### 4.1 Session workflow — the agent's life

```
┌────────── agent session workflow (durable, long-lived) ──────────┐
│                                                                    │
│   hook = createHook({ token: sessionToken(agentId) })              │
│   ticker = await startTicker(agentId)  // child workflow, see below │
│                                                                    │
│   for await (event of hook):                                       │
│     switch (event.type):                                           │
│       case "chat":        await handleChat(event)                  │
│       case "heartbeat":   await handleHeartbeat(event)             │
│       case "invocation":  await handleSubAgentCall(event)          │
│       case "reply":       await resolvePendingSubCall(event)       │
│       case "shutdown":    break                                    │
│     await snapshotSandbox()                                        │
│     await flushFilesToCache()                                      │
│                                                                    │
│   await ticker.stop()                                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Why this shape.**
- **Single-threaded by construction.** The hook's iterable guarantees events are processed one at a time. No locks; no race between chat and heartbeat; snapshot-after-every-event is safe.
- **Heartbeat as a sibling ticker workflow.** A single workflow can't trivially race `sleep()` against `createHook()`. The heartbeat is fired by a small child workflow: `while (running) { await sleep(interval); await resumeHook(parentToken, { type: 'heartbeat' }); interval = await readInterval(agentId) }`. Per-agent cadence is re-read each tick so UI changes take effect on next tick.
- **Graceful restart.** No single workflow run lives forever. After N events or T hours, the session hands off: it snapshots, ends the run, and its very last step kicks off a fresh session run. State continuity is provided by the sandbox snapshot + `agents.last_session_run_id`.
- **Crash recovery.** Workflows resume from their own snapshot automatically. A low-frequency liveness sweeper (Vercel Cron every ~15 min) scans for `enabled = true` agents with no live session run and restarts them.
- **Observability.** `agents.last_session_run_id` + `npx workflow inspect run` give a 1:1 view of "what this agent is doing right now."

#### Enable / disable
- **Enable** → `start(agentSessionWorkflow, [agentId])`, store `last_session_run_id`.
- **Disable** → `resumeHook(sessionToken, { type: 'shutdown' })`; session drains its current event, snapshots, and returns cleanly.

### 4.2 Sandbox model

Every agent has a **home sandbox**. It is persistent in identity only; physically, it is snapshotted and rehydrated.

```
agents.home_sandbox_snapshot_id ─┐
                                 │
          Sandbox.create ◀───────┤  on session event
                                 ▼
               [ running sandbox with /home/agent/*.md ]
                                 │
          sandbox.snapshot() ────┤  at end of event
                                 ▼
                agents.home_sandbox_snapshot_id  (updated)
```

Rules:
- The snapshot is taken **at the end of every event**, not just on idle. A lost snapshot = lost work since the previous snapshot.
- The snapshot ID on the agent row is authoritative. Any cached copy elsewhere is advisory.
- The home base image has bash, Node, and anything tools can run in-process. No Chromium, no Python ML — those live in tool sandboxes.

**Tool sandboxes** are ephemeral per invocation, created from a tool-specific base snapshot, and **never read or write the home sandbox's filesystem directly**. All data crosses the boundary via the tool's `execute` arguments and return value. This keeps the home sandbox the single source of truth for agent state.

### 4.3 The agent's mind — markdown files

Every file lives in the home sandbox under `/home/agent/`. They are the sole persistent memory of the agent between events.

| File | Role | Written by | Read by |
|---|---|---|---|
| `SOUL.md` | Identity, ethics, style (the effective system prompt) | User (via pending-writes queue); agent may self-rewrite (discouraged by default base prompt) | Agent, every event |
| `AGENTS.md` | Other agents the user owns + brief descriptions | System (regenerated on agent-set changes) | Agent when considering delegation |
| `SKILLS.md` | Attached tools with descriptions | System (regenerated on tool-attach changes) | Agent when reasoning about capability |
| `MEMORY.md` | Durable facts, preferences, commitments | Agent, via a dedicated memory-write tool | Agent, every event |
| `GOALS.md` | Long-horizon objectives | User + agent (synthesized from DREAMS) | Agent on heartbeat |
| `CALENDAR.md` | Known time-bound events & deadlines | Agent (from tool results); user (manual) | Agent on heartbeat |
| `TASKS.md` | Active tactical items, status, dependencies | Agent | Agent on heartbeat; UI displays |
| `DREAMS.md` | Reflection, pattern anticipation, self-evaluation | Agent during dedicated heartbeat runs | Agent for future planning |
| `logs/YYYY-MM-DD.md` | Raw event trace for the day | Agent (auto-appended each event) | Agent (DREAMS pass); UI timeline |

#### Event-loop reading pattern
Every event the agent processes starts with the same prologue (assembled by a step before the `DurableAgent` call):
```
base system prompt + SOUL.md + MEMORY.md + GOALS.md + TASKS.md
+ CALENDAR.md + today's log
(+ AGENTS.md / SKILLS.md if the event requires delegation/tool reasoning)
```

#### UI read path — the flat file cache
The UI cannot read the sandbox directly (it is stopped most of the time). At the end of every event (after snapshotting), a step pulls every `.md` under `/home/agent/` and upserts rows into:
```
agent_files(agent_id, path, content, sha256, updated_at)
```
The UI renders from this table. Staleness bound = one event. No structured extraction in v1; MD is rendered verbatim.

#### UI write path — the pending-writes queue
When the user edits a file via the UI (correct a task, add a fact to MEMORY, rewrite SOUL):
```
pending_file_writes(id, agent_id, path, content, enqueued_at, applied_at)
```
On the next sandbox boot, a setup step drains this queue into the home sandbox *before* the agent is handed control. This guarantees no write conflicts with the running agent and supports manual MD editing without boot-on-edit latency.

### 4.4 Tools

A tool is the minimal wrapper around an AI SDK `tool()`:

```ts
export interface MaintainerTool {
  id: string;                            // stable catalog key, e.g. "gmail.search"
  displayName: string;
  displayDescription: string;            // shown in the catalog UI
  category: "communication" | "compute" | "browser" | "memory" | ...;
  requirements: {
    oauthProvider?: "gmail" | "google-calendar" | "github" | ...;
    sandboxBaseSnapshotId?: string;      // only for tools needing a tool sandbox
  };
  build: (ctx: ToolBuildContext) => ToolSet;  // closed over credentials + sandbox spec
}
```

`ToolBuildContext` carries `{ agentId, userId, credentials, homeSandbox }`. `build()` is called at session start for every tool attached to the agent, producing a `ToolSet` passed to `DurableAgent`.

**Catalog.** Maintainer tools live in a static registry (`tools/registry.ts`). Attaching a tool that requires an OAuth provider the user has not connected triggers the generalised connection flow (§5).

**Agent-as-tool synthesiser.** Takes an agent row and returns an AI SDK tool whose `execute` sends an `invocation` event to the target agent's session hook and awaits a `reply` event (§4.5). Both populations are listed in `SKILLS.md`; the LLM cannot tell them apart.

### 4.5 Sub-agent invocation

Agents are always invoked **cross-workflow**, never inline. This keeps "agent" and "sub-agent" genuinely the same primitive (an inline sub-agent would be a second-class thing that can't be chatted with, can't have its own MEMORY, can't be heartbeat-driven).

```
┌─ Parent session workflow ──────┐    ┌─ Child session workflow ─────┐
│                                 │    │                               │
│  agent-tool.execute(input):     │    │  on event "invocation":       │
│    replyToken = rand()          │    │    run DurableAgent with      │
│    resumeHook(child.sessionTkn, │    │      input + child's context  │
│      { type: "invocation",      │───▶│    resumeHook(replyToken,     │
│        input,                   │    │      { type: "reply",         │
│        replyTo: replyToken,     │    │        output })              │
│        callStack: [...ids,      │    │                               │
│                     child.id],  │    │                               │
│        depth: d+1 })            │    │                               │
│    return await                 │◀───│                               │
│      createHook({ token:        │    │                               │
│        replyToken })            │    │                               │
└─────────────────────────────────┘    └───────────────────────────────┘
```

Guardrails:
- **Depth bound** (default `MAX_DEPTH = 3`). Exceeding rejects at dispatch.
- **Cycle detection.** `callStack` is carried; reject if the target is already in it.
- **Owner-only for v1.** You can only invoke agents you own.
- **Credentials are the callee's.** In v1 caller and callee share a user, so this simplifies to "the user's own OAuth." When sharing is added later (§8), this rule becomes load-bearing.

### 4.6 Identity & config — hybrid

| Concern | Where it lives | Edited by |
|---|---|---|
| Model ID | `agents.model` column | UI form (instant effect on next event) |
| Attached tool IDs | `agent_tools` table | UI (attach/detach; `SKILLS.md` regenerated) |
| Heartbeat enabled & interval | columns on `agents` | UI (instant; next tick picks it up) |
| Display name, icon | columns on `agents` | UI |
| Prose identity | `SOUL.md` in the sandbox | Primarily UI via pending-writes queue; agent may self-rewrite but the default base system prompt discourages it |

The default base system prompt, prepended to `SOUL.md` at every event, includes a clause along the lines of:

> *Treat `SOUL.md` as given. Do not rewrite it unless the user has explicitly asked you to revise your identity.*

Opt-in self-rewrite (e.g. an agent whose whole purpose is meta-reflection) is a per-agent flag we can add later.

### 4.7 Event flows

**Chat turn.**
```
POST /api/agents/:id/chat
  │  persist user message, allocate replyStreamToken
  ▼
resumeHook(agent.sessionToken, { type: "chat", message, replyStreamToken })
  │
  ▼
session workflow consumes event → DurableAgent streams UIMessageChunks
  to getWritable({ namespace: replyStreamToken }) → HTTP handler pipes
  run.getReadable({ namespace: replyStreamToken }) to the client.
End of event: persist assistant message(s), snapshot sandbox, flush file cache.
```

**Heartbeat tick.**
```
ticker workflow (sleep → resume) ──► session hook { type: "heartbeat" }
  │
  ▼
session workflow runs DurableAgent with a heartbeat prompt
  ("consult GOALS, TASKS, CALENDAR, DREAMS — decide and act").
MD writes and tool calls are the work product; a summary is appended
to today's log. End of event: snapshot + cache flush.
```

**Sub-agent call.** See §4.5.

### 4.8 Mapping to Vercel primitives

| Concern | Primitive |
|---|---|
| Session durability, hook-driven event loop, heartbeat sleep | Vercel Workflow (`workflow`, `@workflow/ai`, `@workflow/next`) |
| Per-agent durable VM + snapshot | Vercel Sandbox (`@vercel/sandbox`) |
| Model calls | AI Gateway via AI SDK |
| Agent config, file cache, pending writes, connections, chat persistence | Neon Postgres via Drizzle |
| User auth | Better Auth (unchanged) |
| Scheduling | **Almost none.** Proactivity lives in the session workflow + ticker. The only Vercel Cron is a low-frequency **liveness sweeper** (every ~15 min) that restarts sessions for enabled agents whose run has ended unexpectedly. |
| Static assets, UI | Next.js on Vercel (unchanged) |

No Redis, no external queue, no separate scheduler service. The workflow + hook + sleep loop is the scheduler.

---

## 5. Data model (new / changed)

Disruptive migrations allowed.

```
-- Unchanged: user, session, account, verification (Better Auth)

-- Replaced:
agents (
  id                         uuid pk,
  user_id                    uuid fk → user.id,
  name                       text,
  icon                       text,
  model                      text,             -- e.g. "anthropic/claude-sonnet-4-5"
  enabled                    boolean,
  heartbeat_enabled          boolean,
  heartbeat_interval_mins    int,
  home_sandbox_snapshot_id   text null,        -- null until first snapshot
  last_session_run_id        text null,
  created_at                 timestamptz
)

agent_tools (
  agent_id   uuid fk → agents.id,
  tool_id    text,                             -- maintainer tool key OR "agent:<uuid>"
  config     jsonb,                            -- per-attachment config, if any
  primary key (agent_id, tool_id)
)

agent_files (                                  -- flat file cache for UI reads
  agent_id   uuid fk → agents.id,
  path       text,                             -- e.g. "MEMORY.md", "logs/2026-04-23.md"
  content    text,
  sha256     text,
  updated_at timestamptz,
  primary key (agent_id, path)
)

pending_file_writes (                          -- UI → sandbox write queue
  id          uuid pk,
  agent_id    uuid fk → agents.id,
  path        text,
  content     text,
  enqueued_at timestamptz,
  applied_at  timestamptz null
)

user_connections (                             -- generalises gmailConnection
  user_id      uuid fk → user.id,
  provider     text,                           -- "gmail" | "google-calendar" | ...
  credentials  bytea,                          -- encrypted
  expires_at   timestamptz null,
  primary key (user_id, provider)
)

-- Unchanged in shape (possibly renamed):
chat_conversation, chat_message

-- Removed:
runs, run_result                               -- subsumed by logs/*.md + workflow run history
```

---

## 6. Non-architectural conventions

These aren't architectural beams but are canonical enough to codify here.

- **Timezones.** Daily-log filenames and heartbeat-clock semantics use the owning user's timezone (stored on `user`, default UTC).
- **Log retention.** Daily logs are never auto-deleted. `DREAMS.md` digests and summarises old logs. Users may prune manually.
- **Base system prompt.** Prepended to `SOUL.md` on every event. Contains the "treat SOUL.md as given" clause, the list of available files, the expected markdown conventions for checklists / dates, and a pointer to `SKILLS.md`.
- **Tool failure handling.** `FatalError` for bad inputs / revoked auth; `RetryableError` for rate limits / 5xx. Fatal tool errors become an agent-visible message, not a workflow crash.
- **Streaming namespaces.** Each chat turn uses a per-turn namespace keyed by `replyStreamToken`. Heartbeat and sub-agent work emit to a `logs` namespace the UI may optionally subscribe to for a live activity feed.
- **Model selection** goes through AI Gateway; the supported model list is a small allow-list curated by the maintainer.

---

## 7. Phased migration plan

Every phase ends in a state where the app runs, passes tests, and can be demoed. Disruptive schema changes and deletes are fine. We do not preserve existing `daily-email-brief` data.

### Phase 1 — Session workflow skeleton for the existing agent
*No user-facing feature changes. Internal plumbing only.*

- Introduce `agentSessionWorkflow(agentId)` with the iterable-hook event loop (`chat`, `heartbeat`, `shutdown`).
- Introduce the ticker child workflow; wire it to a fixed 30-min cadence for the one existing agent kind.
- Move the existing `daily-email-brief` chat + trigger logic onto this loop. Keep its tools inline, its sandbox pattern, its UI.
- Add `agents.last_session_run_id`, start-on-enable / shutdown-on-disable plumbing.
- Add the `agent_files` cache + end-of-event flush step.
- Add the low-frequency liveness sweeper cron.

**Testable end state.** The existing agent still works via chat; it now also runs itself on heartbeat (replacing the manual trigger); an admin page reads `agent_files` and shows the sandbox MD tree.

### Phase 2 — Generalise the agent model
*The agent becomes a user-editable row.*

- Replace the hard-coded `kind` with the full `agents` table from §5. Delete `lib/agent-runtime-registry.ts` and the `agents/daily-email-brief` directory.
- Ship a "create agent" UI: name, model, system prompt, heartbeat toggle + interval. System prompt is written via the pending-writes queue into a seed `SOUL.md`.
- Implement the pending-writes queue (drained on sandbox boot) and the flat file cache read path in the UI.
- Only one maintainer tool in this phase: `bash` (runs a command in the home sandbox) — validates the generalised flow without pulling in full catalog plumbing.

**Testable end state.** A user can create a blank agent from the UI, chat with it (equipped only with `bash`), and see its MEMORY / TASKS / logs in an admin MD viewer. The old `daily-email-brief` is entirely gone.

### Phase 3 — Tool catalog + connections
*Users can compose an agent from a tool catalog.*

- Ship `MaintainerTool` + `ToolBuildContext` from §4.4; build `tools/registry.ts`.
- Generalise `gmailConnection` → `user_connections`. Tool-attach flow triggers OAuth when the requirement isn't met.
- First real tool set: `gmail.search`, `gmail.send`, `google-calendar.read`, `google-calendar.create`, `web.fetch`, `memory.write` (wraps `MEMORY.md` edits), `tasks.write` (wraps `TASKS.md` edits).
- Tool-catalog UI and attach/detach flow; `SKILLS.md` regeneration on attach/detach.

**Testable end state.** A user can rebuild an equivalent of the original "daily email brief" agent entirely through the UI — create an agent, attach `gmail.search` + `memory.write`, author a `SOUL.md` — with no code deploy required.

### Phase 4 — Sub-agents + tool sandboxes
*Agents can call each other; tools can have heavy runtimes.*

- Agent-as-tool synthesiser and the cross-workflow invocation protocol from §4.5, with depth and cycle guards.
- First tool that requires a tool sandbox: a browser tool using the `@vercel/sandbox` snapshot pattern. This validates the "no cross-sandbox FS" data-flow rule end-to-end.
- `AGENTS.md` regeneration on the user's agent-set changes.
- Depth/cycle guard tests.

**Testable end state.** A user can create an "orchestrator" agent whose toolset includes other agents they own plus the browser tool. Sub-agent calls show up as linked workflow runs in observability.

### Phase 5 — DREAMS / reflection
*Proactivity becomes self-improving.*

- Dedicated heartbeat mode (first tick of the day, or on user demand): digest `logs/*.md`, write to `DREAMS.md`, propose updates to `GOALS.md` / `TASKS.md` (agent writes them directly; UI surfaces diffs for user review).
- Admin UI for the daily-log timeline and the DREAMS stream.
- Tune the default base system prompt based on what the reflection loop actually produces in practice.

**Testable end state.** An agent left running for a few days produces coherent `DREAMS.md` entries that cite specific log events and propose plausible new tasks / goals. The app is then eligible for production.

---

## 8. Explicit follow-ups (not in this refactor)

- **Persistent per-agent tool-sandboxes** (option B from the Q6 design discussion). The `requirements` field in the tool interface is already forward-compatible (add a `persistence: "ephemeral" | "agent-owned"` key). Introduce a `sandbox_instances(agent_id, tool_id, snapshot_id)` table when this lands.
- **Agent sharing.** Relax "owner-only invocation" to ACLs. Makes the "credentials are the callee's owner's" rule load-bearing.
- **Structured UI widgets over MD.** Parse `TASKS.md` / `CALENDAR.md` into shadow tables for filterable / interactive UI. The flat file cache is a stepping stone.
- **User-defined tools.** No-code tool builder (e.g. "call this HTTPS endpoint with these params"). For now, sub-agents are the only user-authored "tools."
- **Multi-user orgs / workspaces / billing.**
- **Per-agent opt-in to aggressive `SOUL.md` self-rewrite** (meta-reflection agents).

---

## 9. References

- [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents) — technical reference for agent + workflow patterns on the Vercel stack.
- [paperclip.ing](https://paperclip.ing/) — product-shape reference for the markdown-as-mind, proactivity-via-files model.
- Workflow DevKit docs (bundled in `node_modules/workflow/docs/`, `node_modules/@workflow/ai/docs/`).
- Vercel Sandbox docs (bundled in the `vercel-sandbox` skill).
