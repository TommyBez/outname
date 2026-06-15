# Sandbox Files Contract

System sandbox:
- Name is `agent-<id>-system`, stored in `agent.sandbox_system_id`.
- It is persistent, `node22`, one vCPU, short timeout, and `deny-all` networking.
- Startup ensures the sandbox and seeds `AGENTS.md`/`IDENTITY.md` once per marker.
- Settings writes can update bootstrap files and merge them into the cache.
- The model gets only `readFile`, `writeFile`, `listFiles`, and `grepFiles`; no shell.

File contract:
- Paths may be relative or absolute but normalize under `/vercel/sandbox`.
- Empty/root paths, NUL bytes, paths over 512 chars, and escapes are rejected.
- `AGENTS.md`, `IDENTITY.md`, and `SOUL.md` are settings-owned read-only files.
- `USER.md` is eager context but agent-writable.
- Missing reads return `exists=false`; non-missing read errors propagate.
- Reads cap at 256 KiB and require valid UTF-8.
- Writes create parent directories with fixed `mkdir -p` argv and write UTF-8 bytes.
- Lists use fixed `find`, return safe relative paths, and cap at 1000.
- Grep uses fixed `grep -RInI`, caps at 200, and truncates long match lines.
- Sandbox files are source of truth; Redis caches tracked canonical files and `logs/*.md`.
- Cache records store content, path, SHA-256, and `updatedAt`; Redis absence is tolerated.

Source anchors: `packages/ai/agent-runtime/server/agent-sandbox.ts`, `packages/ai/agent-runtime/server/system-sandbox-startup.ts`, `packages/ai/agent-runtime/workflows/session/tools/file-tools*`, `packages/ai/agent-runtime/server/file-cache.ts`.
Test anchors: `packages/ai/agent-runtime/workflows/session/tools/file-tools.test.ts`, `packages/ai/agent-runtime/workflows/session/tools/file-tools/file-steps.step.unit.test.ts`, `packages/ai/agent-runtime/server/file-cache.test.ts`.
