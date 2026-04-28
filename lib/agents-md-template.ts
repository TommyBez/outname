/**
 * Baseline `AGENTS.md` content seeded into a freshly provisioned
 * agent's **system** sandbox on its very first boot. The seed step
 * (see `workflows/agent-session/steps/seed-agents-md.ts`) writes this
 * file exactly once per agent — guarded by a `.agents-md-seeded`
 * sentinel that the seed step bumps each time the template ships a
 * breaking change so deploy-time edits never silently overwrite an
 * agent's evolved notes.
 *
 * Template authoring rules:
 *   - Do not embed information that varies per agent — names,
 *     models, persona — those live in `SOUL.md` (operator-authored)
 *     or get derived at runtime by `composeSystemPrompt`.
 *   - The agent owns this file. After the seed, every edit happens
 *     either via the UI "Instructions" tab (which lands in the
 *     `pending_file_writes` queue and is applied by
 *     `drainPendingWrites`) or via the operator's manual edits.
 *     The agent's own `*_memory` tools refuse this path.
 *
 * Phase 2 / architect rev:
 *   - Documents the six memory tools using the `<verb>_memory`
 *     convention (incl. `search_memory`).
 *   - Documents the five exec tools (incl. `reset_exec`).
 *   - Calls out the automatic bash audit log at `logs/<UTC date>.md`.
 *   - Acknowledges that AGENTS.md / SOUL.md are user-owned via the
 *     settings UI tabs.
 */
export const AGENTS_MD_TEMPLATE = `# AGENTS.md

This file is your operational manual. Read it at the start of every
event. It tells you which files exist in your memory volume, what each
one is for, and the conventions you should follow when editing them.

## Ownership of this file

\`AGENTS.md\` and \`SOUL.md\` are **user-owned**. They are edited via
the agent settings UI ("Instructions" -> AGENTS.md, "Identity" ->
SOUL.md). Your own \`memory_*\` tools will refuse to write to either
path. If something here is wrong, surface it to the user — do not
silently work around it.

Every other file in your memory volume is yours to manage. The
platform never rewrites those on your behalf.

## Tools available to you

### Memory tools — operate on your **system** sandbox

These are the canonical surface for your durable notes. All paths are
relative; every file ends in \`.md\`. Writes are queued and flushed at
end of event, but reads in the same turn see your queued changes
immediately.

- \`memory_list\` — list every memory file you currently have.
- \`memory_read({ path })\` — read the effective content of a file.
- \`memory_search({ pattern, flags?, pathPrefix?, maxResults? })\` —
  regex grep across every memory file. Always reach for this before
  \`memory_read\` when you don't know which file holds a fact.
  Patterns are JS regex source compiled with \`gm\`; pass \`i\` for
  case-insensitive. Returns up to \`maxResults\` matches (default 50)
  as \`{ path, line, text }\`.
- \`memory_write({ path, content })\` — create or overwrite a file.
- \`memory_edit({ path, oldString, newString, replaceAll? })\` —
  anchor-based edit. \`oldString\` must occur in the file. Default
  replaces a single occurrence; pass \`replaceAll: true\` to replace
  every match.
- \`memory_delete({ path })\` — delete a file.

### Exec tools — operate on your **exec** sandbox at \`/vercel/sandbox/workspace\`

Use these whenever you need a shell, a file outside the memory volume,
or to run scripts/builds/HTTP calls. Files persist across events.

- \`bash({ command, timeoutMs? })\` — run a single shell command.
  Returns \`{ exitCode, stdout, stderr, *Truncated }\`. Output is
  truncated to 64 KiB per stream. **Every call is auto-appended to
  \`logs/<UTC date>.md\`** with timestamp, exit code, and the command
  itself, so you can grep your own command history with
  \`memory_search\` in later turns.
- \`file_read({ path })\` — read a UTF-8 text file (max 256 KiB).
- \`file_write({ path, content })\` — create/overwrite a text file.
  Parents are created automatically.
- \`file_list({ path? })\` — list immediate children of a directory.
- \`reset_exec({ reason })\` — last-resort: destroy the exec sandbox
  AND its persisted snapshot, then re-provision a clean one. Memory
  files are unaffected. Use only when the workspace is genuinely
  wedged (broken \`node_modules\`, leftover daemons, half-cloned
  repos) — not as a routine cleanup. The \`reason\` is logged
  alongside your bash history.

## Files in your memory volume

- \`AGENTS.md\` — this file. User-owned (see above).
- \`SOUL.md\` — your persona, identity, voice, and self-model.
  User-owned. Read it every turn (it's injected into your system
  prompt). If you spot a contradiction with your behavior, raise it
  with the user.
- \`MEMORY.md\` — durable facts, preferences, and commitments about
  the user. Append-only by convention; rewrite only to correct
  mistakes.
- \`TASKS.md\` — active tactical items with status and dependencies.
  Use the checkbox conventions below.
- \`CALENDAR.md\` — known time-bound events and deadlines, ISO-8601
  dated.
- \`GOALS.md\` — long-horizon objectives. Updated rarely; consult
  before deciding what to surface in a heartbeat.
- \`DREAMS.md\` — reflections, pattern anticipation, self-evaluation.
  Written during dedicated heartbeat passes.
- \`logs/YYYY-MM-DD.md\` — per-day log. The \`bash\` and
  \`reset_exec\` tools auto-append one line per call. You can append
  your own bullets here too — the file is shared. One file per UTC
  day.

You are free to add more files as your work demands. Use kebab-case
names ending in \`.md\`.

## Conventions

- **Terse output.** Prefer doing over explaining. Bullets over prose.
- **Dates.** Always ISO-8601 (\`2026-04-27\`,
  \`2026-04-27T15:30:00Z\`). Day filenames in \`logs/\` use UTC
  \`YYYY-MM-DD\` to match the auto-appended bash audit lines.
- **Checkboxes.** Use \`- [ ]\` for open items and \`- [x]\` for done.
  Match the GitHub-Flavored Markdown spec exactly so the UI renders
  them correctly.
- **Today's log.** At the end of every event, append one bullet to
  \`logs/<today>.md\` summarising what happened — even if the bash
  tool already wrote rows there. Your bullet should describe intent
  / outcome; the auto-appended lines just record raw commands.
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
