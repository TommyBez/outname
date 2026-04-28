/**
 * Baseline `AGENTS.md` content seeded into a freshly provisioned agent
 * sandbox on its very first boot. The seed step (see
 * `workflows/agent-session/steps/seed-agents-md.ts`) writes this file
 * exactly once per agent — guarded by a `.agents-md-seeded` sentinel so
 * deploy-time edits to the template never overwrite an agent's evolved
 * notes.
 *
 * Phase 1 ships the full memory-file _layout_ and conventions even
 * though the matching tools (`read_memory`, `append_memory`, …) only
 * land in Phase 2. Reading is fine — bash and the future memory-tool
 * surface both see the same files — so an agent that decides to start
 * keeping notes today will produce a directory tree that the Phase 2
 * tool surface and UI can adopt without renaming anything.
 */
export const AGENTS_MD_TEMPLATE = `# AGENTS.md

This file is your operational manual. Read it at the start of every
event. It tells you which files exist in your workspace, what each one
is for, and the conventions you should follow when editing them.

You may freely append to or rewrite the lazy memory files described
below. Treat \`AGENTS.md\` itself as system-managed: the next phase of
the platform will write-block it at the tool layer; today, please do
not edit this file yourself.

## Files in your workspace

> **Phase 2 surface.** The dedicated memory tools that will mediate
> reads and writes (\`read_memory\`, \`write_memory\`, \`append_memory\`,
> \`list_memory\`, \`search_memory\`) are not yet wired up. In Phase 1
> you reach these files via whatever filesystem affordance you have
> available; the directory layout is already final.

- \`AGENTS.md\` — this file. Operational manual. **System-managed.**
- \`MEMORY.md\` — durable facts, preferences, and commitments about the
  user. Append-only by convention; rewrite only to correct mistakes.
- \`TASKS.md\` — active tactical items with status and dependencies.
  Use the checkbox conventions below.
- \`CALENDAR.md\` — known time-bound events and deadlines, ISO-8601 dated.
- \`GOALS.md\` — long-horizon objectives. Updated rarely; consult before
  deciding what to surface in a heartbeat.
- \`DREAMS.md\` — reflections, pattern anticipation, self-evaluation.
  Written during dedicated heartbeat passes.
- \`logs/YYYY-MM-DD.md\` — append a short entry every event under the
  day's file. One file per day, always in the user's timezone.

## Conventions

- **Terse output.** Prefer doing over explaining. Bullets over prose.
- **Dates.** Always ISO-8601 (\`2026-04-27\`, \`2026-04-27T15:30:00Z\`).
  Day filenames in \`logs/\` use \`YYYY-MM-DD\`.
- **Checkboxes.** Use \`- [ ]\` for open items and \`- [x]\` for done.
  Match the GitHub-Flavored Markdown spec exactly so the UI renders
  them correctly.
- **Today's log.** At the end of every event, append one bullet to
  \`logs/<today>.md\` summarising what happened. Create the file if
  missing. Never delete previous days' files.
- **Citations.** When you record a fact in \`MEMORY.md\` derived from a
  tool result, include the source link or message id in parentheses.

## What you know about the user

(Empty — fill in \`MEMORY.md\` as you learn. Quick-reference facts may be
mirrored here for the eager prologue.)

## Notes & follow-ups

(Empty — append bullets here for short-lived context that does not
warrant a row in \`TASKS.md\`.)
`
