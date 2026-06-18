# Agent Skills Use Dedicated Sandboxes

## Decision

Agents with installed Agent Skills use a dedicated persistent Skill Sandbox,
created lazily on first install. It is separate from the agent system sandbox
and maintainer tool sandboxes.

## Context

Skills can include executable scripts and public internet access. The system
sandbox is the canonical memory filesystem, so it should not become the
permissive script workspace.

## Consequences

- Installed skills live under `skills/<slug>`.
- Skill working files live under `workspace`.
- Postgres `agent_skills` stores UI metadata, source data, and collision checks.
- Runtime discovery reads `SKILL.md` files from the Skill Sandbox.
- Names are unique per agent using normalized case-insensitive comparison.
- Runtime adds conditional `skill` and `bash` tools when valid skills exist.
- `bash` runs only in the Skill Sandbox.
- System memory still uses `readFile` and `writeFile`.
- Skill imports copy files without automatic install or build hooks.
- The first UI is `/agents/[agentId]/skills`.

Per-skill permission manifests and credential brokering are deferred until the
product needs finer control.
