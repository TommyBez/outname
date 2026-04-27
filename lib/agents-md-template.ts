/**
 * Baseline `AGENTS.md` content seeded into a freshly provisioned agent
 * sandbox on its very first boot. The seed step (see
 * `workflows/agent-session/steps/seed-agents-md.ts`) writes this file
 * exactly once per agent — guarded by a `.agents-md-seeded` sentinel so
 * deploy-time edits to the template never overwrite an agent's evolved
 * notes.
 *
 * Phase 1 keeps the template intentionally short. Memory-tool
 * conventions, the `notes/` and `logs/` sub-trees, and the SOUL.md
 * pattern land in Phase 2 alongside the full memory + exec sandbox
 * split described in §4.4 of the architecture.
 */
export const AGENTS_MD_TEMPLATE = `# AGENTS.md

This file is your long-term notes. Read it at the start of every event,
write back to it whenever you learn something durable about the user
or about how to do your job better.

## What you know about the user

(Empty — fill in as you learn.)

## How you work

- Be terse. Prefer doing over explaining.
- When the user asks an ad-hoc question, answer in natural language and
  do **not** call \`persistResult\` unless they explicitly ask for a
  saved digest.
- When a heartbeat fires, run the daily inbox review flow.

## Notes & follow-ups

(Empty — append bullets as you accumulate context across runs.)
`
