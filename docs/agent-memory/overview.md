# Agent Memory

Scope/boundary:
- Memory lives in persistent system Vercel Sandbox root `/vercel/sandbox`.
- `agent.sandbox_system_id` stores name `agent-<id>-system`; network policy is `deny-all`.
- System sandbox is separate from Skill Sandbox, tool sandboxes, brokered HTTP, and repo workspaces.

Main flow:
- Startup ensures the sandbox exists, then seeds `AGENTS.md` and `IDENTITY.md` once per marker.
- Creation/update writes bootstrap files; `AGENTS.md` is rendered through template.
- Model file tools read/write/list/grep live sandbox; cleanup refreshes Redis cache.

State:
- Redis cache has index and per-file records; sandbox is source of truth.
- Cached UI reads Redis first; misses refresh sandbox/list or single file.
- Tracked cache refresh includes canonical markdown and `logs/*.md`.

Invariants:
- No system bash tool; only `readFile`, `writeFile`, `listFiles`, and `grepFiles`.
- Paths must stay under root; reject root, NUL, over 512 chars, and escapes.
- `AGENTS.md`, `IDENTITY.md`, and `SOUL.md` are settings-owned/read-only to agent.
- `USER.md` is eager context but agent-writable.
- Reads cap 256 KiB and require UTF-8; grep/list use fixed argv and max results.

Failure modes:
- Missing file returns `exists=false`; missing sandbox becomes nonretryable workflow error.
- Cache absence is tolerated; writes go to sandbox and may merge cache.
- Cleanup cache refresh failures are logged/ignored when sandbox is gone.

Anchors: `packages/shared/agents/server/bootstrap-files.ts`, `packages/ai/agent-runtime/server/agent-sandbox*.ts`, `packages/ai/agent-runtime/server/file-cache.ts`, `packages/ai/agent-runtime/workflows/session/tools/file-tools*`, `apps/app/app/agents/[agentId]/memory/*`.
