# OUTNA.ME

This context defines the language for OUTNA.ME personal agents, their model
runtime choices, and the external capabilities they use.

## Language

**Inference Provider**:
A service selected to run language model requests for agents and assistant
workflows.
_Avoid_: AI provider, provider

**Default Inference Provider**:
The user's preferred inference provider for assistant workflows that are not tied
to a specific agent.
_Avoid_: General provider, global provider

**Agent Inference Provider**:
The inference provider selected for a specific agent's runtime.
_Avoid_: Agent provider, runtime provider

**Enabled Inference Provider**:
An inference provider whose credential has been accepted and verified for use.
_Avoid_: Configured provider, saved provider

**Inference Credential**:
A user-provided secret that authorizes OUTNA.ME to use an inference provider on
that user's behalf.
_Avoid_: Tool connection, connector credential

**Tool Provider**:
A third-party service or API exposed to agents through tools or connections.
_Avoid_: Inference provider, provider

**Upstream Provider**:
The backend provider endpoint that actually serves or bills a model generation
behind an inference provider.
_Avoid_: Inference provider, model provider, provider

**Model**:
A provider-scoped language model identifier that an agent can use at runtime.
_Avoid_: Provider, engine

**Model Selection**:
The complete runtime choice of an inference provider and one of its models.
_Avoid_: Model id, model

**Estimated Cost**:
A projected model generation cost calculated before the actual billed cost is
known.
_Avoid_: Spend, actual cost

**Actual Cost**:
The billed model generation cost reported by an inference provider after a run.
_Avoid_: Estimated cost, spend

**Budget**:
A user-defined operational guardrail for limiting agent spend; it is not a
billing ledger or financial guarantee.
_Avoid_: Billing, invoice, charge

**Budget Gate**:
The pre-run stop condition that prevents a Dreaming run from making any state or
file changes when the agent is budget-blocked.
_Avoid_: LLM-only budget check, partial deterministic run

**Budget-Skipped Dreaming**:
A Dreaming event that completes successfully with a `budget_skipped` outcome
without running a sweep or marking the local day as completed.
_Avoid_: Failed dream, cancelled dream, completed sweep

**Failed Dreaming Sweep**:
A Dreaming event whose required Light, REM, or Deep phase failed; it records the
error and remains eligible for retry because the local day is not completed.
_Avoid_: Budget skip, narrative failure, completed dream

**Dreaming Retry Idempotence**:
The rule that a failed Dreaming sweep retries as a new attempt over accumulated
Dreaming Store evidence without globally rolling back prior idempotent state.
_Avoid_: Global rollback, duplicate promotion, blind replay

**Dreaming**:
An offline agent memory governance run that consolidates recent evidence without
delivering a user-facing work session.
_Avoid_: Free-form agent session, heartbeat

**OpenClaw-Inspired Design**:
An Outname-owned Dreaming design that borrows architectural ideas from OpenClaw
without adopting OpenClaw artifact compatibility, marker strings, or file
contracts.
_Avoid_: OpenClaw parity, OpenClaw-compatible implementation, copied behavior

**Dreaming Phase Names**:
The canonical Outname phase labels `Light`, `REM`, and `Deep`; they are generic
sleep metaphors whose behavior is defined by Outname's Dreaming contract.
_Avoid_: Upstream-compatible phase contract, renamed phases

**Dreaming Store**:
The runtime-owned scratch state for a Dreaming run, including recall candidates,
phase signals, ingestion checkpoints, sweep manifests, and locks.
_Avoid_: JSON files, SQLite API

**Dreaming Debug Export**:
An opt-in diagnostic file derived from Dreaming Store state; it is not required
for normal runtime behavior or the user-facing Dreaming UI.
_Avoid_: Primary manifest, required JSON export

**Dreaming Run Lock**:
The per-agent serialization guard that prevents scheduled and manual Dreaming
runs from executing concurrently.
_Avoid_: Idempotency key, manual bypass

**Dream Now Idempotence**:
The UI/runtime contract that a manual Dreaming trigger returns an existing
active or queued Dreaming run instead of creating additional queued work.
_Avoid_: Manual queue, duplicate dream

**REM Phase**:
A rule-governed Dreaming phase that reinforces staged memory candidates with
pattern metadata before durable promotion.
_Avoid_: REM LLM, semantic generation

**Dream Diary**:
A human-readable, non-canonical Dreaming output for review and observability.
_Avoid_: Durable memory, source of truth

**Cumulative Dream Diary**:
The single `DREAMS.md` file that accumulates dated Dreaming reports and optional
narrative entries.
_Avoid_: Per-phase report files, per-day diary files

**Tool-less Diary Agent**:
The Dream Diary narrative generator that uses the agent abstraction without
sandbox, file, or provider tools; runtime code owns all writes.
_Avoid_: File-editing diary agent, narrative tool loop

**Durable Promotion**:
A Deep-authorized append to durable agent memory after scoring, diversity checks,
and source rehydration.
_Avoid_: Memory write, diary insight, REM decision

**Outname Promotion Marker**:
The application-owned HTML marker used to identify durable promotions in
`MEMORY.md` and prevent duplicate appends.
_Avoid_: Upstream-compatible marker, copied marker string

**Event Transcript Evidence**:
Completed agent event transcript content consumed transiently by Dreaming to
stage memory candidates without duplicating transcripts into the sandbox.
_Avoid_: Session evidence, sandbox session corpus, raw chat history

**Bounded Evidence Ingestion**:
The Dreaming rule that evidence sources are read through explicit caps before
candidate extraction, so oversized inputs are truncated or deferred.
_Avoid_: Full transcript copy, unbounded ingestion

**Agent Skill**:
A user-installed capability package that teaches an agent a specialized workflow
and may include supporting files or executable scripts.
_Avoid_: Tool, connector, prompt

**Skill Slug**:
The stable directory identifier for an installed Agent Skill on a specific
agent. Agents load skills by skill name; the slug is internal to OUTNA.ME.
_Avoid_: Skill name, display name

**Skill Sandbox**:
An agent-owned isolated, persistent execution environment dedicated to installed
skills and skill script execution. It exists only for agents that have skills.
_Avoid_: System sandbox, tool sandbox, workspace

**Skill Workspace**:
The writable area inside a Skill Sandbox where an agent runs skill scripts and
keeps working files across turns.
_Avoid_: Agent filesystem, memory, system sandbox

**Skill Permission**:
A user approval that lets a specific installed Agent Skill use external services
or credential brokers beyond the Skill Sandbox filesystem.
_Avoid_: Secret, connector, tool
