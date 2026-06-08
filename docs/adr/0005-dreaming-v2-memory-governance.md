# Dreaming v2 is runtime-owned memory governance

OUTNA.ME will replace the current LLM-led dreaming pass with a runtime-owned
memory governance pipeline. The design is inspired by OpenClaw's memory-core
shape, but Outname owns the runtime contract, storage format, marker format, and
UI behavior; the implementation is not intended to be artifact-compatible with
OpenClaw.

Dreaming v2 uses the phase names `Light`, `REM`, and `Deep`, but the phases are
defined by Outname. Light, REM, and Deep are deterministic TypeScript phases:
Light ingests bounded evidence, REM reinforces staged candidates with
rule-derived metadata, and Deep authorizes durable promotion through scoring,
source rehydration, and duplicate markers. The only LLM call is an optional
best-effort Dream Diary narrative, implemented as a tool-less `ToolLoopAgent`
whose output is validated and appended to `DREAMS.md` by runtime code.

Scratch state lives in a sandbox-backed `DreamingStore`, initially
`memory/.dreams/dreaming.sqlite`, rather than scattered JSON files. Completed
event transcripts may be read transiently from the database-backed transcript
store, but raw or compact transcript corpora are not persisted into the sandbox.
`DREAMS.md` is the single cumulative human-readable diary file; separate report
files and manifest JSON exports are debug-only opt-ins.

Deep promotions append to `MEMORY.md` only through Outname-owned markers such as
`<!-- outname:dreaming:promotion key="..." source="..." at="..." -->`. We will
not copy upstream marker strings. This keeps durable memory ownership clear and
prevents future code from depending on upstream artifact compatibility.

## Consequences

Budget gating is a total operational stop: if preflight budget fails, the event
completes with `budget_skipped` and no sweep state, checkpoint, diary, or memory
file is written. Required phase failures mark the `dreaming` event failed,
leave `lastDreamingLocalDate` unchanged, and are retryable as new sweep attempts
over idempotent `DreamingStore` state. Scheduled and manual dreaming share one
per-agent run lock; repeated **Dream now** triggers return the active or queued
event instead of creating parallel or duplicate sweeps.

This design deliberately rejects a free-form `DurableAgent`/file-tool dreaming
session, upstream-compatible marker strings, persisted sandbox transcript
corpora, JSON scratch state as the primary store, and multiple default diary
report files. Those alternatives are easier to prototype, but they make durable
memory less grounded, increase persistent sandbox storage, and blur ownership of
the memory file contract.
