# Agent Skills

Scope/boundary:
- Packages live only in Skill Sandbox `/vercel/sandbox/skills/<slug>` with workspace `/vercel/sandbox/workspace`.
- Every package requires root `SKILL.md` YAML `name`/`description`; instructions are file body.
- `agent_skills` is catalog/source metadata; Skill tools are built-ins, not `agent_tools`.

Main flow:
- Install API accepts `skill_md`, `zip`, GitHub URL, or `skills_sh`; owner session required.
- Prep normalizes paths, limits size/count, hashes content, and enforces unique normalized name unless replace.
- Install ensures Skill Sandbox, writes package, upserts metadata, and revalidates.
- Replace writes temp, backs up old dir, swaps, and restores if activation fails.
- Runtime discovery scans depth-2 `SKILL.md`, skipping hidden slugs, invalid files, duplicate names.

State:
- Agent row stores `sandbox_skills_id`; null until first install.
- Slug is stable for replacement; new slug collision suffixes content hash.
- `resolveSkillPlan` returns empty when sandbox missing or discovery fails.

Invariants:
- Use `skill` before relying on a package; instructions are runtime source of truth.
- `bash` runs only in Skill Sandbox workspace and paths must stay under `/vercel/sandbox`.
- System memory uses system file tools; skill bash must not touch system memory.

Failure modes:
- Install errors include not found, invalid package, name conflict, sandbox unavailable, write failed, GitHub/catalog fetch failed.
- Uninstall fails if sandbox/files cannot be removed; invalid runtime skills are ignored with warnings.

Anchors: `packages/ai/agent-runtime/skills/*`, `packages/ai/agent-runtime/workflows/session/tools/skill-tools.ts`, `packages/shared/agents/server/skills.ts`, `apps/api/app/api/agents/[agentId]/skills/*`.
