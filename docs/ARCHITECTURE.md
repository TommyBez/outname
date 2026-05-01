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
- **Per-agent persistent sandboxes** — a **system sandbox** for the markdown-based "mind" (SOUL, AGENTS, MEMORY, TASKS, CALENDAR, GOALS, DREAMS, daily logs) accessed via a dedicated memory-tool surface, plus an **exec sandbox** for free bash work without risk to memory.
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
- **Prose identity** (`SOUL.md` in its system sandbox): personality, ethics, communication style.
- **A lifelong session workflow** (§4.1) — one per agent, always running while the agent is enabled.
- **Two home sandboxes** (§4.2) — a **system sandbox** holding the markdown "mind," and an **exec sandbox** as a free-bash playground. Both persistent.

### Tool
An invocable capability the agent can call via the AI SDK tool protocol. Four sources at runtime, one interface:
- **Built-in memory tools** — always present. `read_memory`, `write_memory`, `append_memory`, `list_memory`, `search_memory`, `delete_memory`, `move_memory`. The only path to read/write memory files. Tool-layer write block on `SOUL.md` and `AGENTS.md`. A consequence of having a system sandbox.
- **Built-in exec tools** — always present. `bash`, `readFile`, `writeFile` (all run against the **exec sandbox**, supplied by [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool)), plus our own `reset_exec` (drops the exec snapshot, boots fresh next event). None of these can reach memory files (different VM). A consequence of having an exec sandbox.
- **Maintainer catalog tools** — global, code-defined, versioned with the app (`resend.send`, `browser.open`, …). Attached per-agent via the catalog UI.
- **Synthesized agent-tools** — one per user-owned agent, generated at runtime so agents can call each other (§4.5). Attached via the catalog UI as if they were maintainer tools.

To the LLM all three are indistinguishable — they're just functions in the `ToolSet`.

### Sandbox
Vercel Sandbox microVMs. Every agent has **two persistent sandboxes**:
- **System sandbox** — sole home of the agent's markdown memory (`SOUL.md`, `AGENTS.md`, `MEMORY.md`, …). Accessed only via a dedicated **memory tool** surface (`read_memory`, `write_memory`, `search_memory`, …). No raw bash here. `SOUL.md` and `AGENTS.md` are write-blocked at the tool layer (writable only by the user via the pending-writes queue).
- **Exec sandbox** — full bash playground. Disposable by intent; the agent can `rm -rf`, install packages, clone repos, run scripts. Persisted across events but resettable on demand via a `reset_exec` tool.

Tools with heavy runtime needs (Chromium, Python, ffmpeg) still get **on-demand tool sandboxes**, spun up per invocation from pre-built base snapshots — separate from both persistent sandboxes.

### Session workflow
A single long-lived Vercel Workflow run per agent. It parks on an iterable `createHook()` and is fed by a sibling "ticker" workflow that drives the heartbeat. All events in the agent's life — chat messages, heartbeat ticks, sub-agent invocations, sub-agent replies — arrive on this hook and are processed sequentially. Both sandboxes are snapshotted at the end of every event.

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
- **Heartbeat as a sibling ticker workflow, with ack-handshake to prevent pile-up.** A single workflow can't trivially race `sleep()` against `createHook()`. The heartbeat is fired by a small child workflow that waits for session-side completion before starting the next sleep:
  ```ts
  // ticker
  while (running) {
    const ack = `heartbeat-ack:${agentId}:${tickN++}`;
    const completion = createHook({ token: ack });
    await resumeHook(sessionToken, { type: "heartbeat", ack });
    await completion;                          // wait until session finishes this tick
    await sleep(readInterval(agentId));        // only THEN sleep for the configured interval
  }

  // session, end of "heartbeat" case
  await resumeHook(event.ack, { done: true });
  ```
  Net cadence = `max(interval, runtime_of_previous_heartbeat)`. Without this handshake, a heartbeat run that exceeds the interval causes wall-clock ticks to pile up behind it: the agent runs heartbeats back-to-back forever, never idles, starves chat, and wastes tokens. The handshake gives "at least `interval` of rest between completions" semantics, which is what "every 30 min" should actually mean.
- **Chat latency under long events — accepted tradeoff.** The single-threaded mind means a chat message arriving mid-heartbeat is queued and only processed when the heartbeat completes. A 45-min heartbeat = 45-min chat delay. UI surfaces an "agent busy" state with the in-flight event type. Preserving the invariant is worth this cost; fixes (preempting heartbeats, forking the sandbox, non-durable fast-path chat) each compromise the single-source-of-truth guarantee and are deferred past v1.
- **Safety valve: per-agent `max_event_duration_mins`.** Bounds worst-case chat-starvation. If a single event exceeds it, the session aborts that event (logs to today's `logs/…md`, snapshots, moves on). Default generous (e.g. 30); tunable per agent.
- **Graceful restart.** No single workflow run lives forever. After N events or T hours, the session hands off: it snapshots, ends the run, and its very last step kicks off a fresh session run. State continuity is provided by the sandbox snapshot + `agents.last_session_run_id`.
- **Crash recovery.** Workflows resume from their own snapshot automatically. A low-frequency liveness sweeper (Vercel Cron every ~15 min) scans for `enabled = true` agents with no live session run and restarts them.
- **Observability.** `agents.last_session_run_id` + `npx workflow inspect run` give a 1:1 view of "what this agent is doing right now."

#### Enable / disable
- **Enable** → `start(agentSessionWorkflow, [agentId])`, store `last_session_run_id`.
- **Disable** → `resumeHook(sessionToken, { type: 'shutdown' })`; session drains its current event, snapshots, and returns cleanly.

### 4.2 Sandbox model

Every agent owns **two persistent sandboxes** — `system` and `exec` — and may transiently use **tool sandboxes** during a tool call.

#### Why two
- **System sandbox** = the agent's mind. Memory files only. Strict access surface (memory tools). `SOUL.md` and `AGENTS.md` are write-blocked at the tool layer (only the user, via the pending-writes queue, can edit them). Sacred — corruption here is corruption of identity.
- **Exec sandbox** = the agent's hands. Free bash. Destructive operations are by-design safe: a `rm -rf`, a runaway install, a misbehaving script all hit the exec sandbox only. Memory files are not reachable from here.

The split satisfies two drivers at once:
1. Hard guarantee that agent action cannot corrupt `SOUL.md` / `AGENTS.md` (or, by tool-layer policy, any other memory file the user has marked read-only).
2. A blast-radius-bounded environment in which the agent can run arbitrary bash without us — or it — worrying.

#### Lifecycle

Both sandboxes follow the same snapshot/rehydrate pattern; they are persistent in identity, ephemeral in physical instance.

```
agents.system_sandbox_snapshot_id ─┐                  agents.exec_sandbox_snapshot_id ─┐
                                   │                                                   │
            Sandbox.create ◀───────┤  on session event       Sandbox.create ◀──────────┤  on session event
                                   ▼                                                   ▼
        [ running system sandbox ]                                  [ running exec sandbox ]
                                   │                                                   │
            sandbox.snapshot() ────┤  at end of event       sandbox.snapshot() ────────┤  at end of event
                                   ▼                                                   ▼
   agents.system_sandbox_snapshot_id  (updated)        agents.exec_sandbox_snapshot_id  (updated)
```

Rules:
- Both sandboxes snapshot at the **end of every event** (same cadence). One mental model.
- The system snapshot is sacred. If the system snapshot fails, the event fails.
- The exec snapshot is best-effort. If the exec snapshot fails, the event still succeeds; the next event rehydrates from the last good exec snapshot. Logged as a warning.
- The snapshot IDs on the agent row are authoritative. Any cached copy elsewhere is advisory.
- The system base image is minimal: just enough to host markdown files and the memory-tool implementations.
- The exec base image has bash, Node, common CLI utilities. No Chromium, no Python ML — those still live in tool sandboxes.
- A `reset_exec` built-in tool drops the exec snapshot and boots fresh on the next event. The agent owns it; the user can also trigger it from the UI. Never affects the system sandbox.

#### Tool sandboxes (third tier)

**Tool sandboxes** are ephemeral per invocation, created from a tool-specific base snapshot, and **never read or write either persistent sandbox's filesystem directly**. All data crosses the boundary via the tool's `execute` arguments and return value. This keeps the system sandbox the single source of truth for agent state, and the exec sandbox the agent's private playground.

### 4.3 The agent's mind — markdown files

Every file lives in the **system sandbox** under `/home/agent/`. They are the sole persistent memory of the agent between events. **The agent never accesses these files via bash** — bash runs in the exec sandbox, which is a different VM. Memory access is mediated entirely through the **memory tool** surface (§4.4).

Two tiers:
- **Eager** — `AGENTS.md` (HOW) and `SOUL.md` (WHO) are read by a setup step (via `read_memory`) and injected into the system message on every event. Small, stable, always relevant.
- **Lazy** — every other file is read by the agent on demand via memory tools (`read_memory`, `search_memory`, `list_memory`). Keeps prompts compact as files grow; matches how a coding agent navigates a codebase, but through a strict tool surface rather than free bash.

| File | Tier | Role | Written by | Read by |
|---|---|---|---|---|
| `SOUL.md` | **eager** | **WHO** — identity, persona, values, voice, scope of interest | User only (via pending-writes queue). **Tool-layer write block.** Agent self-rewrite rejected by `write_memory` | Setup step, every event |
| `AGENTS.md` | **eager** | **HOW** — operational manual for this sandbox per the [agents.md](https://agents.md/) spec: filesystem layout, roles and conventions of the other MD files, date/checklist formats, memory-tool conventions — **plus per-agent workflow instructions** (escalation rules, preferred tools, "read MEMORY.md before chat," domain checklists) | System (template seed at agent creation) **+ user** (via pending-writes queue for per-agent instructions). **Tool-layer write block.** Agent self-rewrite rejected by `write_memory` | Setup step, every event |
| `MEMORY.md` | lazy | Durable facts, preferences, commitments | Agent (via `write_memory` / `append_memory`); user (via pending-writes queue) | Agent on demand (`read_memory`) |
| `GOALS.md` | lazy | Long-horizon objectives | User + agent (synthesized from DREAMS) | Agent on demand (typically on heartbeat) |
| `CALENDAR.md` | lazy | Known time-bound events & deadlines | Agent (from tool results); user (manual) | Agent on demand (typically on heartbeat) |
| `TASKS.md` | lazy | Active tactical items, status, dependencies | Agent | Agent on demand; UI displays |
| `DREAMS.md` | lazy | Reflection, pattern anticipation, self-evaluation | Agent during dedicated heartbeat runs | Agent on demand (DREAMS runs) |
| `logs/YYYY-MM-DD.md` | lazy | Raw event trace for the day | Agent (auto-appended each event via `append_memory`) | Agent on demand; UI timeline |

> **Note — `AGENTS.md` follows the [agents.md](https://agents.md/) public standard, with per-agent customization.** The spec defines a markdown file that tells AI agents how to operate within a given codebase, and explicitly supports hierarchical / context-specific variants. Each agent's "codebase" is its own system sandbox, so a per-agent `AGENTS.md` is spec-aligned. It has two layers: a **template baseline** seeded by the system at agent creation (memory-file layout, conventions, memory-tool usage notes, exec-sandbox guidance), and **per-agent instructions** appended or edited by the user via the pending-writes queue (escalation rules, preferred tools, "always read MEMORY.md before replying to chat," domain-specific checklists). Agents should not self-rewrite `AGENTS.md`; the `write_memory` tool rejects writes to it regardless.
>
> **`SOUL.md` vs `AGENTS.md` — WHO vs HOW.** `SOUL.md` is identity and persona; `AGENTS.md` is operational instructions. The UI surfaces them on separate tabs (*Identity* / *Instructions*) to avoid user confusion.
>
> **No "other agents" file.** Agents are not automatically aware of other agents the user owns. Sub-agents are made available only by explicit attachment via the tool catalog (§4.4–4.5, stored in `agent_tools` as `"agent:<uuid>"`). An agent knows exactly what has been given to it — nothing more.
>
> **Deploy-time updates to the template baseline** are not auto-merged into existing agents' `AGENTS.md` files. If a new standard instruction must apply to all agents, ship it in the code-side base system prompt instead.
>
> The repo itself may separately adopt a **root** `AGENTS.md` per the same spec, describing *this codebase* to AI coding agents working on it — that is a tooling concern, not part of this refactor.

#### Event-loop reading pattern
Every event the agent processes starts with the same minimal prologue (assembled by a step before the `DurableAgent` call):
```
base system prompt + AGENTS.md + SOUL.md
```
The setup step reads both files via `read_memory` from the system sandbox. All other MD files (`MEMORY.md`, `TASKS.md`, `CALENDAR.md`, `GOALS.md`, `DREAMS.md`, `logs/*.md`) are **read lazily** by the agent via memory tools when it decides they are relevant. `AGENTS.md` tells the agent what exists, when to consult each file, and which memory tool to use; per-agent instructions in `AGENTS.md` (e.g. *"always read MEMORY.md before replying to chat"*) can force eager-style behavior for files the agent's owner deems load-bearing. Keeps prompts compact as memory files grow; matches how a coding agent navigates a codebase, but routed through a strict tool surface rather than free bash.

#### UI read path — the flat file cache
The UI cannot read the system sandbox directly (it is stopped most of the time). At the end of every event (after snapshotting), a step pulls every `.md` under `/home/agent/` and upserts rows into:
```
agent_files(agent_id, path, content, sha256, updated_at)
```
The UI renders from this table. Staleness bound = one event. No structured extraction in v1; MD is rendered verbatim. The exec sandbox's filesystem is **not** surfaced to the UI — it is the agent's private playground, not part of its persisted state.

#### UI write path — the pending-writes queue
When the user edits a file via the UI (correct a task, add a fact to MEMORY, rewrite SOUL or AGENTS):
```
pending_file_writes(id, agent_id, path, content, enqueued_at, applied_at)
```
On the next system sandbox boot, a setup step drains this queue **before** the agent is handed control, bypassing the tool layer's write-block on `SOUL.md` / `AGENTS.md` (the queue carries user authority). This guarantees no write conflicts with the running agent and supports manual MD editing without boot-on-edit latency.

### 4.4 Tools

A tool is the minimal wrapper around an AI SDK `tool()`:

```ts
export type ToolRequirement =
  | { kind: "connection"; provider: string }                           // API key for Phase 3
  | { kind: "tool_sandbox"; manifest: string };                        // logical manifest id; resolved to current snapshot at session start

export interface MaintainerTool<TConfig = unknown> {
  id: string;                            // stable catalog key, e.g. "resend.send"
  displayName: string;
  displayDescription: string;            // shown in the catalog UI
  category: "communication" | "compute" | "browser" | "memory" | ...;
  requirements: ToolRequirement[];       // empty array = no creds, no sandbox
  configSchema?: ZodSchema<TConfig>;     // per-attachment user config; rendered as a form on attach
  build: (ctx: ToolBuildContext<TConfig>) => ToolSet;
}
```

`ToolBuildContext` is the runtime closure handed to `build()`:
```ts
interface ToolBuildContext<TConfig = unknown> {
  agentId: string;
  userId: string;
  config: TConfig;                                                          // validated against tool.configSchema at attach time
  credentials: Record<string /* provider */, Credential>;                    // resolved from user_connections; only providers in requirements
  spawnToolSandbox: (manifestId: string) => Promise<EphemeralSandbox>;       // ephemeral; auto-disposed when execute() resolves
}
```

**Maintainer tools never receive handles to the agent's system or exec sandboxes.** Memory access is reserved to the built-in memory tools, and the exec sandbox is the agent's private playground; exposing those handles to third-party tool code would be a backdoor around the tool-layer write block on `SOUL.md` / `AGENTS.md` and would let any tool stomp on the agent's exec workspace. Maintainer tools' only sandbox surface is `spawnToolSandbox(manifestId)`, which returns an ephemeral, isolated VM.

`build()` is called at session start for every attached tool, producing a `ToolSet` merged with the built-in set (below) and passed to `DurableAgent`. If a required API-key connection is missing or invalid, the session refuses to build the tool and surfaces a "replace key / reconnect" prompt to the user via the next-event UI state — it does not crash.

**Credential abstraction.** Phase 3 only supports API-key connections. All user-provided API keys flow through a single `user_connections` table (§5). Tool authors declare `provider:"resend"`; they never touch encryption, validation, or storage. Per-provider form schema and optional validation logic live in a separate **connector registry** (§4.4a). OAuth is deferred to §8.

**`ToolSet` composition at session start.**
```ts
toolSet = {
  // Memory tools — bound to the system sandbox. Always present; not catalog entries.
  ...builtInMemoryTools(systemSandbox),

  // Exec-sandbox tools — bound to the exec sandbox. Always present; not catalog entries.
  ...builtInExecTools(execSandbox),

  ...buildAttachedTools(agent_tools, ctx),      // maintainer tools
  ...buildAgentTools(agent_tools, ctx),         // synthesised sub-agents (rows with "agent:<uuid>")
}
```

**Memory tools (system sandbox surface).** Always present. Not catalog entries — users cannot detach them.

| Tool | Behaviour |
|---|---|
| `read_memory(path)` | Read a single file from the system sandbox |
| `write_memory(path, content)` | Overwrite a file. **Rejects** writes to `SOUL.md` and `AGENTS.md` (and any other path the per-agent policy marks read-only) |
| `append_memory(path, content)` | Append. Same path-allowlist rules as `write_memory` |
| `list_memory(dir?)` | List files under a directory in the system sandbox |
| `search_memory(query, paths?, regex?)` | grep across the system sandbox; returns line-context matches across multiple files. The agent's substitute for "grep -r" |
| `delete_memory(path)` / `move_memory(src, dst)` | Same path-allowlist rules as `write_memory` |

`SOUL.md` and `AGENTS.md` are write-blocked at the tool layer. The only way they change is the user via the pending-writes queue, drained at boot before the agent is handed control.

**Exec-sandbox tools.** Always present. Not catalog entries. Implemented on top of [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool) — a thin AI-SDK wrapper around `@vercel/sandbox` that exactly matches our snapshot/rehydrate persistence model (`Sandbox.get({ sandboxId })`).

| Tool | Source | Behaviour |
|---|---|---|
| `bash` | bash-tool | Runs a command inside the **exec sandbox** and returns stdout/stderr/exit code. Free shell — agent can edit anything in the exec sandbox, install packages, run scripts |
| `readFile(path)` | bash-tool | Reads a file from the exec sandbox |
| `writeFile(path, content)` | bash-tool | Writes a file to the exec sandbox; creates parent directories as needed |
| `reset_exec` | ours | Drops the exec snapshot and boots fresh on the next event. Idempotent. Never affects the system sandbox |

All four are bound to the exec sandbox only and **cannot reach memory files** — memory lives in a different VM (system sandbox), reachable only through the memory tools above.

bash-tool's `onBeforeBashCall` / `onAfterBashCall` hooks are wired to (a) append every command + exit code to today's log via `append_memory`, and (b) optionally enforce a per-agent command policy in the future. The agent has full read/write inside the exec sandbox; the audit trail is on the system side, where it cannot be edited from inside the exec sandbox.

> **On bash-tool's experimental Skills support.** [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool) ships an `experimental_createSkillTool` that loads markdown skill files from a directory. We do **not** wire it in this refactor (skills are a §8 follow-up), but adopting bash-tool now lines us up to enable its skill tool later without swapping libraries.

**Catalog.** Maintainer tools live in a static registry (`tools/registry.ts`). Attaching a tool with unmet `connection` requirements points the user to the API-key form for that provider (§4.4a). Attaching a tool with a `tool_sandbox` requirement may trigger a one-time snapshot build (§4.4b).

**Agent-as-tool synthesiser.** Takes an agent row and returns an AI SDK tool whose `execute` sends an `invocation` event to the target agent's session hook and awaits a `reply` event (§4.5). The LLM sees built-in memory tools, exec tools (`bash`, `readFile`, `writeFile`, `reset_exec`), maintainer tools, and sub-agents as ordinary function tools and cannot tell them apart. Tool discovery is native to the AI SDK — there is no markdown index of tools.

### 4.4a Connector registry — API-key credential flows

Per-provider flow logic lives in a separate registry (`connectors/registry.ts`), keyed by provider id. Each connector declares:

```ts
export interface Connector {
  provider: string;                                  // "resend" | "stripe" | "openai" | ...
  kind: "api_key";
  displayName: string;
  apiKey: {
    formSchema: ZodSchema;                           // form fields rendered to user (e.g. { apiKey: string, region?: string })
    validate?: (value: unknown) => Promise<{ ok: boolean; error?: string }>;   // optional cheap provider probe
  };
}
```

Tool authors only declare `provider:"resend"` in their requirements. The connector handles form rendering, validation, encryption, and storage. Saving the form creates or replaces a row in `user_connections`; subsequent attaches by the same user reuse it.

### 4.4b Tool sandboxes — definition, build, lifecycle

Tools that need a heavy runtime (Chromium, Python ML, ffmpeg) declare a `tool_sandbox` requirement referencing a **manifest id**. Manifests live alongside the tool registry:

```
tools/
├── registry.ts
├── sandboxes/
│   ├── chromium/
│   │   ├── setup.sh                # commands run once during snapshot build
│   │   └── manifest.ts             # { id, baseImage, setup, resources }
│   └── python-data/
│       ├── setup.sh
│       └── manifest.ts
└── browser/
    └── tool.ts                     # references "chromium" via { kind: "tool_sandbox", manifest: "chromium" }
```

`manifest.ts`:
```ts
export const chromium: ToolSandboxManifest = {
  id: "chromium",                    // logical name, stable across deploys
  baseImage: "node:24",              // Vercel Sandbox base image
  setup: "./setup.sh",               // installs chromium, fonts, deps; runs at snapshot-build time only
  resources: { memoryMb: 2048, timeoutSec: 60 },
};
```

**Build pipeline (v1 — lazy first-attach).**
1. The first time a user attaches a tool whose `tool_sandbox` manifest has no current snapshot, the attach handler kicks off a one-time build: `Sandbox.create({ image: baseImage })` → run `setup.sh` → `sandbox.snapshot()` → persist `(manifest_id, snapshot_id, manifest_hash, built_at)` into `tool_sandbox_snapshots`.
2. Subsequent attaches by any user reuse the snapshot — the table is global, not per-user.
3. `manifest_hash` (content hash of `setup.sh` + `manifest.ts`) drives rebuilds. On deploy with a changed manifest, the next attach triggering that manifest does a fresh build and updates the row.
4. UI shows a "preparing tool environment" state on first attach to keep the latency visible.

**Deploy-time pre-build** (CI step that snapshots all manifests before traffic) is a §8 follow-up — cleaner ops, faster first-attach UX, but more deploy machinery than v1 needs.

**Invocation lifecycle.**
- Ephemeral per call. `spawnToolSandbox(manifestId)` resolves to the current snapshot id from `tool_sandbox_snapshots`, calls `Sandbox.create({ snapshotId })`, hands back an `EphemeralSandbox` handle.
- Auto-disposed when the tool's `execute()` resolves or throws. No snapshot taken at the end — these sandboxes carry no agent state.
- **No FS access to system / exec sandboxes.** Inputs cross via `execute()` arguments; outputs cross via the return value. Re-stated from §4.2 because it is the load-bearing rule.

**Persistent per-agent tool sandboxes** (logged-in browser sessions, long-lived dev environments) are a §8 follow-up. The `requirements` field is forward-compatible — a future `persistence: "ephemeral" | "agent-owned"` key on the `tool_sandbox` requirement, plus a `sandbox_instances(agent_id, manifest_id, snapshot_id)` table.

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
- **Credentials are the callee's.** In v1 caller and callee share a user, so this simplifies to "the user's own API-key connections." When sharing is added later (§8), this rule becomes load-bearing.

### 4.6 Identity & config — hybrid

| Concern | Where it lives | Edited by |
|---|---|---|
| Model ID | `agents.model` column | UI form (instant effect on next event) |
| Attached tool IDs | `agent_tools` table | UI (attach/detach; session rebuilds `ToolSet` on next event) |
| Heartbeat enabled & interval | columns on `agents` | UI (instant; next tick picks it up) |
| Display name, icon | columns on `agents` | UI |
| Prose identity (WHO) | `SOUL.md` in the system sandbox | UI *Identity* tab via pending-writes queue. **Tool-layer write block** — agent self-rewrite rejected by `write_memory` |
| Operational instructions (HOW) | `AGENTS.md` in the system sandbox | UI *Instructions* tab via pending-writes queue (layered on the system baseline template). **Tool-layer write block** — agent self-rewrite rejected by `write_memory` |

The default base system prompt, prepended at every event, makes the policy explicit:

> *`AGENTS.md` and `SOUL.md` are read-only for you. Treat them as given. Write attempts via memory tools will be rejected. The user owns these files via the UI.*

Opt-in self-rewrite of `SOUL.md` or `AGENTS.md` (e.g. for meta-reflection agents) would be a per-agent flag relaxing the tool-layer write block; not in scope for this refactor.

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
End of event: persist assistant message(s), snapshot system sandbox (sacred),
  snapshot exec sandbox (best-effort), flush file cache from system sandbox.
```

**Heartbeat tick.**
```
ticker workflow (sleep → resume) ──► session hook { type: "heartbeat" }
  │
  ▼
session workflow runs DurableAgent with a heartbeat prompt
  ("consult GOALS, TASKS, CALENDAR, DREAMS — decide and act").
Memory writes (via memory tools) and tool calls are the work product; a summary
is appended to today's log via append_memory. End of event: snapshot both
sandboxes + cache flush from system sandbox.
```

**Sub-agent call.** See §4.5.

### 4.8 Mapping to Vercel primitives

| Concern | Primitive |
|---|---|
| Session durability, hook-driven event loop, heartbeat sleep | Vercel Workflow (`workflow`, `@workflow/ai`, `@workflow/next`) |
| Per-agent durable VMs + snapshots (system sandbox + exec sandbox) | Vercel Sandbox (`@vercel/sandbox`) — two persistent instances per agent, plus ephemeral tool sandboxes on demand |
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
  max_event_duration_mins    int,              -- safety valve; aborts runaway events
  system_sandbox_snapshot_id text null,        -- memory files; null until first snapshot
  exec_sandbox_snapshot_id   text null,        -- bash playground; null until first snapshot or after reset_exec
  last_session_run_id        text null,
  created_at                 timestamptz
)

agent_tools (
  agent_id   uuid fk → agents.id,
  tool_id    text,                             -- maintainer tool key OR "agent:<uuid>"
  config     jsonb,                            -- per-attachment config; validated against tool.configSchema at attach time
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

user_connections (                             -- API-key credentials
  user_id      uuid fk → user.id,
  provider     text,                           -- "resend" | "stripe" | "openai" | ...
  credentials  bytea,                          -- encrypted API-key payload
  status       text,                           -- "active" | "invalid"
  last_error   text null,
  metadata     jsonb,                          -- e.g. key label, account id, region
  primary key (user_id, provider)
)

tool_sandbox_snapshots (                       -- one row per tool-sandbox manifest
  manifest_id    text primary key,             -- logical id from the manifest, e.g. "chromium"
  snapshot_id    text,                         -- current Vercel Sandbox snapshot id
  manifest_hash  text,                         -- hash of manifest + setup script; drives rebuilds
  built_at       timestamptz
)

-- Unchanged in shape (possibly renamed):
chat_conversation, chat_message

-- Removed:
runs, run_result                               -- subsumed by logs/*.md + workflow run history
```

> **Phase 1 footnote.** Phase 1 kept the legacy `runs` / `run_result` tables to keep the existing `/runs` UI working unchanged. Phase 5 removes them once the replacement logs viewer, DREAMS UI, and workflow runtime observability are in place.

---

## 6. Non-architectural conventions

These aren't architectural beams but are canonical enough to codify here.

- **Timezones.** Daily-log filenames and heartbeat-clock semantics use the owning user's timezone (stored on `user`, default UTC).
- **Log retention.** Daily logs are never auto-deleted. `DREAMS.md` digests and summarises old logs. Users may prune manually.
- **Base system prompt.** Short code-side preamble prepended on every event. Tells the agent: (1) you have two files pre-loaded (`AGENTS.md` = how, `SOUL.md` = who); treat both as given; (2) memory files live in the **system sandbox** and are accessed only via the memory tools (`read_memory`, `write_memory`, `append_memory`, `list_memory`, `search_memory`, …) — read other files (`MEMORY.md`, `TASKS.md`, etc.) lazily when relevant, per the guidance in `AGENTS.md`; (3) `bash` runs in a separate **exec sandbox** — a private, persistent playground — and **cannot reach memory files**; use it freely for risky or destructive work; (4) `SOUL.md` and `AGENTS.md` are read-only for you (write attempts will be rejected); the user owns those. Operational conventions (file layout, checkbox / date formats, memory-tool notes, exec-sandbox guidance, per-agent workflow rules) live in `AGENTS.md` in the system sandbox, not in the base prompt — auditable and version-controlled alongside the agent's other files. Tools are exposed through the AI SDK `ToolSet`, not through a markdown index.
- **Tool failure handling.** `FatalError` for bad inputs / invalid credentials; `RetryableError` for rate limits / 5xx. Fatal tool errors become an agent-visible message, not a workflow crash.
- **Streaming namespaces.** Each chat turn uses a per-turn namespace keyed by `replyStreamToken`. Heartbeat/reflection and sub-agent work use the workflow runtime id directly as their stream namespace, with breadcrumbs under `events:${runId}`. The UI may subscribe selectively per turn/event instead of multiplexing through a single global feed.
- **Model selection** goes through AI Gateway; the supported model list is a small allow-list curated by the maintainer.

---

## 7. Phased migration plan

Every phase ends in a state where the app runs, passes tests, and can be demoed. Disruptive schema changes and deletes are fine. We do not preserve existing `daily-email-brief` data.

### Phase 1 — Session workflow skeleton for the existing agent
*No user-facing feature changes. Internal plumbing only.*

- Introduce `agentSessionWorkflow(agentId)` with the iterable-hook event loop (`chat`, `heartbeat`, `shutdown`).
- Introduce the ticker child workflow; wire it to a fixed 30-min cadence for the one existing agent kind.
- Move the existing `daily-email-brief` chat + trigger logic onto this loop. Keep its tools inline, its sandbox pattern (single sandbox in this phase — dual sandbox lands in Phase 2), its UI.
- Add `agents.last_session_run_id`, start-on-enable / shutdown-on-disable plumbing.
- Add the `agent_files` cache + end-of-event flush step.
- Author the initial `AGENTS.md` baseline template (standard memory-file layout, MD file conventions, memory-tool usage notes — stub for now since memory tools land Phase 2; refined when Phase 2 ships) and seed it into the sandbox on first bootstrap. Deploy-time template changes do **not** overwrite existing agents' `AGENTS.md`.
- Add the low-frequency liveness sweeper cron.

**Testable end state.** The existing agent still works via chat; it now also runs itself on heartbeat (replacing the manual trigger); an admin page reads `agent_files` and shows the sandbox MD tree.

### Phase 2 — Generalise the agent model + dual sandbox + memory tools
*The agent becomes a user-editable row, and the system/exec split lands.*

- Replace the hard-coded `kind` with the full `agents` table from §5 (with `system_sandbox_snapshot_id` + `exec_sandbox_snapshot_id`). Delete `lib/agent-runtime-registry.ts` and the `agents/daily-email-brief` directory.
- **Split the home sandbox into system + exec.** Build base images for each. The system base image hosts memory files + memory-tool implementations; the exec base image carries bash + Node + common CLI utilities. Snapshot both at end of every event (system sacred, exec best-effort).
- **Ship the built-in memory tools** (`read_memory`, `write_memory`, `append_memory`, `list_memory`, `search_memory`, `delete_memory`, `move_memory`) bound to the system sandbox. Tool-layer write block on `SOUL.md` and `AGENTS.md`.
- **Ship the built-in exec tools** (`bash`, `readFile`, `writeFile` via [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool); `reset_exec` ours) bound to the exec sandbox. Wire bash-tool's `onBeforeBashCall` / `onAfterBashCall` hooks to append each command + exit code to today's log via `append_memory`.
- Update `agent_files` cache flush to read from the system sandbox; exec sandbox is **not** surfaced to the UI.
- Implement the pending-writes queue, drained into the system sandbox at boot **before** the agent is handed control (queue carries user authority, bypasses the tool-layer write block on SOUL/AGENTS).
- Ship a "create agent" UI with two editable prose tabs — *Identity* (`SOUL.md`) and *Instructions* (`AGENTS.md` per-agent section, layered on the baseline template) — plus structured fields: name, model, heartbeat toggle + interval. Prose edits flow through the pending-writes queue.
- Update `AGENTS.md` baseline template to teach the dual-sandbox model + memory-tool conventions.

In this phase the agent's `ToolSet` is just memory tools + exec tools (`bash` + `readFile` + `writeFile` + `reset_exec`). No maintainer catalog yet — that's enough to edit memory files via tools, run scripts in the exec sandbox, and demonstrate the generalised flow.

**Testable end state.** A user can create a blank agent from the UI, chat with it (equipped only with built-in memory tools + exec tools), watch it edit its own MEMORY / TASKS via memory tools, run experiments in the exec sandbox without risk to memory, and see memory results in the admin MD viewer. Attempts by the agent to overwrite `SOUL.md` / `AGENTS.md` are rejected. Bash audit log lands in `logs/YYYY-MM-DD.md`. The old `daily-email-brief` is entirely gone.

### Phase 3 — Tool catalog + API-key connector registry
*Users can compose an agent from a tool catalog; API-key and no-auth tools work. OAuth is deferred.*

- Ship `MaintainerTool` + `ToolRequirement` + `ToolBuildContext` from §4.4; build `tools/registry.ts`.
- Ship the **connector registry** (§4.4a) for API-key providers only, with a Zod-driven form modal and optional validation hook.
- Generalise credential storage to `user_connections` with encrypted API-key payloads, `status`, `last_error`, and connector-defined `metadata`. Tool attach points users to the provider form when a `connection` requirement is unmet.
- Per-attachment config: render `tool.configSchema` as a form alongside the "Attach" button; persist into `agent_tools.config`; surface in `ToolBuildContext.config` (Zod-validated) at session start.
- First real tool set: `resend.send` to exercise the API-key connector path. No-auth catalog tools may also ship in this phase if useful. OAuth-backed Gmail / Calendar tools are deferred to §8.
- Tool-catalog UI and attach/detach flow. Attachment updates `agent_tools`; the session rebuilds its `ToolSet` at the start of the next event. Missing / invalid API keys surface as a reconnect / replace-key prompt instead of crashing the session.

**Testable end state.** A user can create an agent, attach `resend.send`, save a Resend API key through the settings form, configure the per-attachment sender address, and have the agent send email via the attached tool with no code deploy required. Tools with no auth can be attached without any connection flow.

### Phase 4 — Sub-agents + tool sandboxes
*Agents can call each other; tools can have heavy runtimes.*

- Agent-as-tool synthesiser and the cross-workflow invocation protocol from §4.5, with depth and cycle guards.
- Ship the **tool-sandbox build pipeline** (§4.4b, lazy first-attach variant) with `tools/sandboxes/<id>/{manifest.ts, setup.sh}` convention and the `tool_sandbox_snapshots` table.
- First manifest: `chromium`. First tool that uses it: a browser-open tool. UI shows a "preparing tool environment" state during the one-time snapshot build. Validates the `spawnToolSandbox` path and the "no cross-sandbox FS" data-flow rule end-to-end.
- Depth/cycle guard tests.

**Testable end state.** A user can create an "orchestrator" agent whose toolset includes other agents they own plus the browser tool. First attach of the browser tool builds the chromium snapshot once (cached for everyone after); subsequent invocations are fast. Sub-agent calls show up as linked workflow runs in observability.

### Phase 5 — DREAMS / reflection
*Proactivity becomes self-improving.*

- Independent reflection ticker scheduled via `reflection_interval_minutes` plus a forced run on each local-day boundary (using `user.timezone` + `localDateKey`). Manual trigger via `pokeReflection` from `/agents/:id/dreams` "Reflect now".
- `agent_file_changes` table stores before/after content + sha256 + source attribution (`chat | heartbeat | reflection | invocation`) for every event-touching DREAMS/GOALS/TASKS/logs path. UI surfaces diffs at `/agents/:id/dreams`.
- Admin UI for the daily-log timeline and the DREAMS stream.
- Tune the default base system prompt based on what the reflection loop actually produces in practice.

**Testable end state.** An agent left running for a few days produces coherent `DREAMS.md` entries that cite specific log events and propose plausible new tasks / goals. The app is then eligible for production.

---

## 8. Explicit follow-ups (not in this refactor)

- **Agent-authored skills** — distinct from the maintainer tool catalog. Users (or agents themselves) author markdown "skill" files the agent invokes via a bash-style harness. Inspiration: [vercel-labs/bash-tool — `skills-tool`](https://github.com/vercel-labs/bash-tool/tree/main/examples/skills-tool). Out of scope for this refactor; the tool catalog is the only extension surface in v1.
- **OAuth connectors and OAuth-backed tools.** Gmail, Google Calendar, and similar tools need a product-quality OAuth loop: redirect/callback UX, state binding, scope upgrades, refresh-token lifecycle, reconnect prompts, and provider-specific failure handling. Too much surface for Phase 3; build it later as a focused auth phase.
- **Deploy-time tool-sandbox pre-build.** A CI step that walks `tools/sandboxes/*/manifest.ts`, builds and snapshots each, and updates `tool_sandbox_snapshots` before traffic. v1 builds lazily on first attach (§4.4b). Pre-build trades deploy time for a friction-free first-attach UX.
- **Persistent per-agent tool-sandboxes.** The `tool_sandbox` requirement is forward-compatible — add a `persistence: "ephemeral" | "agent-owned"` key. Introduce a `sandbox_instances(agent_id, manifest_id, snapshot_id)` table when this lands. Use cases: logged-in browser sessions, long-lived dev environments.
- **Agent sharing.** Relax "owner-only invocation" to ACLs. Makes the "credentials are the callee's owner's" rule load-bearing.
- **Structured UI widgets over MD.** Parse `TASKS.md` / `CALENDAR.md` into shadow tables for filterable / interactive UI. The flat file cache is a stepping stone.
- **User-defined tools.** No-code tool builder (e.g. "call this HTTPS endpoint with these params"). For now, sub-agents are the only user-authored "tools."
- **Retention/pruning for `agent_file_changes`.** Unbounded today; cap N most recent per `(agent_id, path)` via cron, or store sha-only and look up content from `agent_files` history. Sized for v1.0.
- **Multi-user orgs / workspaces / billing.**
- **Per-agent opt-in to aggressive `SOUL.md` self-rewrite** (meta-reflection agents).

---

## 9. References

- [vercel-labs/open-agents](https://github.com/vercel-labs/open-agents) — technical reference for agent + workflow patterns on the Vercel stack.
- [paperclip.ing](https://paperclip.ing/) — product-shape reference for the markdown-as-mind, proactivity-via-files model.
- [vercel-labs/bash-tool](https://github.com/vercel-labs/bash-tool) — implementation backing the exec-sandbox tools (`bash`, `readFile`, `writeFile`); ships AI-SDK-native wrappers around `@vercel/sandbox` with persistent-sandbox support via `Sandbox.get({ sandboxId })` and `onBeforeBashCall` / `onAfterBashCall` hooks. Its experimental `experimental_createSkillTool` is the inspiration for future agent-authored skill support (see §8).
- Workflow DevKit docs (bundled in `node_modules/workflow/docs/`, `node_modules/@workflow/ai/docs/`).
- Vercel Sandbox docs (bundled in the `vercel-sandbox` skill).
