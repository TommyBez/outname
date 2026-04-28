/**
 * Baseline `AGENTS.md` content seeded into a freshly provisioned
 * agent's **system** sandbox on its very first boot. The seed step
 * (see `workflows/agent-session/steps/seed-agents-md.ts`) writes this
 * file exactly once per agent — guarded by a `.agents-md-seeded`
 * sentinel that the seed step bumps each time the template ships a
 * breaking change so deploy-time edits never silently overwrite an
 * agent's evolved notes.
 *
 * Phase 2: the memory tool surface (`memory_list`, `memory_read`,
 * `memory_write`, `memory_edit`, `memory_delete`) is live, and an
 * orthogonal exec-sandbox surface (`bash`, `file_read`, `file_write`,
 * `file_list`) is available for general-purpose work. Memory files
 * (`*.md` under the system sandbox root) are mirrored into the
 * `agent_files` table at end-of-event so the UI can render them
 * without round-tripping the sandbox.
 */
export const AGENTS_MD_TEMPLATE = `# AGENTS.md

This file is your operational manual. Read it at the start of every
event. It tells you which files exist in your memory volume, what each
one is for, and the conventions you should follow when editing them.

You manage every file described below — including \`AGENTS.md\` and
\`SOUL.md\`. The platform never rewrites them on your behalf. If a
section drifts from the conventions you actually follow, edit it.

## Tools available to you

### Memory tools — operate on your **system** sandbox

These are the canonical surface for your durable notes. All paths are
relative; every file ends in \`.md\`. Writes are queued and flushed at
end of event, but reads in the same turn see your queued changes
immediately.

- \`memory_list\` — list every memory file you currently have.
- \`memory_read({ path })\` — read the effective content of a file.
- \`memory_write({ path, content })\` — create or overwrite a file.
- \`memory_edit({ path, oldString, newString, replaceAll? })\` — anchor-
  based edit. \`oldString\` must occur in the file. Default replaces a
  single occurrence; pass \`replaceAll: true\` to replace every match.
- \`memory_delete({ path })\` — delete a file.

### Exec tools — operate on your **exec** sandbox at \`/vercel/sandbox/workspace\`

Use these whenever you need a shell, a file outside the memory volume,
or to run scripts/builds/HTTP calls. Files persist across events.

- \`bash({ command, timeoutMs? })\` — run a single shell command.
  Returns \`{ exitCode, stdout, stderr, *Truncated }\`. Output is
  truncated to 64 KiB per stream.
- \`file_read({ path })\` — read a UTF-8 text file (max 256 KiB).
- \`file_write({ path, content })\` — create/overwrite a text file.
  Parents are created automatically.
- \`file_list({ path? })\` — list immediate children of a directory.

## Files in your memory volume

- \`AGENTS.md\` — this file. Your operational manual. Edit when your
  conventions change.
- \`SOUL.md\` — your persona, identity, voice, and self-model. Read
  every turn (it's injected into your system prompt). Update sparingly
  and deliberately when you learn something durable about who you are.
- \`MEMORY.md\` — durable facts, preferences, and commitments about
  the user. Append-only by convention; rewrite only to correct
  mistakes.
- \`TASKS.md\` — active tactical items with status and dependencies.
  Use the checkbox conventions below.
- \`CALENDAR.md\` — known time-bound events and deadlines, ISO-8601 dated.
- \`GOALS.md\` — long-horizon objectives. Updated rarely; consult
  before deciding what to surface in a heartbeat.
- \`DREAMS.md\` — reflections, pattern anticipation, self-evaluation.
  Written during dedicated heartbeat passes.
- \`logs/YYYY-MM-DD.md\` — append a short entry every event under the
  day's file. One file per day, always in the user's timezone.

You are free to add more files as your work demands. Use kebab-case
names ending in \`.md\`.

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
- **Citations.** When you record a fact in \`MEMORY.md\` derived from
  a tool result, include the source link or message id in
  parentheses.

## What you know about the user

(Empty — fill in \`MEMORY.md\` as you learn. Quick-reference facts may
be mirrored here for the eager prologue.)

## Notes & follow-ups

(Empty — append bullets here for short-lived context that does not
warrant a row in \`TASKS.md\`.)
`
