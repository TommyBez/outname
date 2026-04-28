import type { Sandbox } from "@vercel/sandbox"
import { SYSTEM_SANDBOX_ROOT } from "@/lib/agent-sandbox-registry"

/**
 * Per-event buffer of memory mutations.
 *
 * The memory tools are append-only at call time — they push an entry
 * here and return success without ever touching the sandbox. The
 * `endOfEvent` step calls `flushPendingWrites` to apply the queue in
 * insertion order to the live filesystem, then mirrors the result into
 * `agent_files` for the UI.
 *
 * Reads at call time are overlay-aware: `resolveEffectiveContent` /
 * `resolveEffectiveListing` apply the queued ops on top of whatever
 * the sandbox returns so the model sees its own writes within the
 * same turn.
 *
 * Why buffer instead of write-through?
 *   1. Writing inside a tool's execute would force every memory call
 *      to round-trip the sandbox SDK (~100ms each). Buffering keeps
 *      the agent loop hot and amortises the cost into one batched
 *      flush per turn.
 *   2. If the model crashes or is cancelled mid-turn, the queue is
 *      dropped and the on-disk memory is unchanged. Atomicity at the
 *      turn boundary, not the tool-call boundary.
 */

export type PendingOp =
  | { kind: "write"; path: string; content: string }
  | { kind: "append"; path: string; content: string }
  | {
      kind: "edit"
      path: string
      oldString: string
      newString: string
      replaceAll: boolean
    }
  | { kind: "delete"; path: string }

export interface PendingWrites {
  ops: PendingOp[]
}

export function createPendingWrites(): PendingWrites {
  return { ops: [] }
}

/* -------------------------------------------------------------------------- */
/* Path validation — applied at tool entry                                     */
/* -------------------------------------------------------------------------- */

const MEMORY_PATH_RE = /^[A-Za-z0-9._/-]+\.md$/

/**
 * Validate a memory file path. Throws a `MemoryPathError` with a
 * model-friendly message if the path is invalid. The model sees the
 * thrown message verbatim as the tool error result.
 */
export function validateMemoryPath(path: string): string {
  if (typeof path !== "string" || path.length === 0) {
    throw new MemoryPathError("path must be a non-empty string")
  }
  if (path.length > 256) {
    throw new MemoryPathError("path is too long (max 256 chars)")
  }
  if (path.startsWith("/")) {
    throw new MemoryPathError("path must be relative (no leading slash)")
  }
  if (!MEMORY_PATH_RE.test(path)) {
    throw new MemoryPathError(
      "path must match ^[A-Za-z0-9._/-]+\\.md$ (only letters, digits, dot, underscore, slash, dash; must end with .md)",
    )
  }
  for (const segment of path.split("/")) {
    if (segment === "" || segment === "." || segment === "..") {
      throw new MemoryPathError(
        "path may not contain empty, '.' or '..' segments",
      )
    }
  }
  return path
}

export class MemoryPathError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = "MemoryPathError"
  }
}

/* -------------------------------------------------------------------------- */
/* Mutators — called from memory tool executes                                 */
/* -------------------------------------------------------------------------- */

export function enqueueWrite(
  pending: PendingWrites,
  path: string,
  content: string,
): void {
  pending.ops.push({ kind: "write", path, content })
}

/**
 * Append `content` to the tail of `path`. Used by the bash-tool audit
 * log and any other system-driven append surface.
 *
 * Sequencing: a queued append after a queued write/edit on the same
 * path applies on top of the queued state — `resolveEffectiveContent`
 * replays ops in insertion order, and `flushPendingWrites` does the
 * same against the live filesystem. The model sees its own appends
 * within the same turn through `memory_read`.
 */
export function enqueueAppend(
  pending: PendingWrites,
  path: string,
  content: string,
): void {
  pending.ops.push({ kind: "append", path, content })
}

export function enqueueEdit(
  pending: PendingWrites,
  path: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): void {
  pending.ops.push({
    kind: "edit",
    path,
    oldString,
    newString,
    replaceAll,
  })
}

export function enqueueDelete(pending: PendingWrites, path: string): void {
  pending.ops.push({ kind: "delete", path })
}

/* -------------------------------------------------------------------------- */
/* Overlay-aware reads — used by memory_read / memory_list                     */
/* -------------------------------------------------------------------------- */

/**
 * Compute the effective content of `path` by replaying queued ops on
 * top of `liveContent`. Returns `null` if the file is currently
 * deleted (or never existed).
 *
 * `liveContent === null` means the sandbox does not (yet) have the
 * file. That can flip to a non-null value if a queued `write`
 * recreates it.
 */
export function resolveEffectiveContent(
  path: string,
  liveContent: string | null,
  pending: PendingWrites,
): string | null {
  let content: string | null = liveContent
  for (const op of pending.ops) {
    if (op.path !== path) continue
    if (op.kind === "delete") {
      content = null
      continue
    }
    if (op.kind === "write") {
      content = op.content
      continue
    }
    if (op.kind === "append") {
      // Append-on-missing creates the file with the appended chunk.
      content = (content ?? "") + op.content
      continue
    }
    // edit
    if (content === null) {
      // Edit-on-missing — leave content null; the tool execute should
      // already have surfaced an error to the model.
      continue
    }
    content = op.replaceAll
      ? content.split(op.oldString).join(op.newString)
      : content.replace(op.oldString, op.newString)
  }
  return content
}

/**
 * Compose the effective directory listing: start with `livePaths`,
 * remove anything queued for delete, add anything queued for write
 * that isn't already present. Edits don't change the path set.
 */
export function resolveEffectiveListing(
  livePaths: readonly string[],
  pending: PendingWrites,
): string[] {
  const present = new Set(livePaths)
  for (const op of pending.ops) {
    if (op.kind === "delete") {
      present.delete(op.path)
    } else if (op.kind === "write" || op.kind === "append") {
      present.add(op.path)
    }
  }
  return Array.from(present).sort()
}

/* -------------------------------------------------------------------------- */
/* Sandbox-side helpers — called by memory tool executes                       */
/* -------------------------------------------------------------------------- */

/**
 * Read the live (on-disk) content of a memory file from the system
 * sandbox. Returns `null` if the file is missing.
 */
export async function readLiveMemory(
  sandbox: Sandbox,
  path: string,
): Promise<string | null> {
  const buf = await sandbox
    .readFileToBuffer({ path: `${SYSTEM_SANDBOX_ROOT}/${path}` })
    .catch(() => null)
  return buf ? buf.toString("utf8") : null
}

/**
 * List every `*.md` file under `SYSTEM_SANDBOX_ROOT`, returning
 * sandbox-relative paths.
 */
export async function listLiveMemory(sandbox: Sandbox): Promise<string[]> {
  const list = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-ec",
      `cd ${SYSTEM_SANDBOX_ROOT} && find . -type f -name '*.md' \
        -not -path './.*' \
        -not -path './node_modules/*' \
        -print 2>/dev/null || true`,
    ],
  })
  const stdout = await list.stdout()
  return stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("./") ? p.slice(2) : p))
    .sort()
}

/* -------------------------------------------------------------------------- */
/* Flush — invoked by `endOfEvent`                                              */
/* -------------------------------------------------------------------------- */

/**
 * Apply queued ops to the live sandbox in insertion order. Edits use
 * the same semantics as `resolveEffectiveContent`: the file is read,
 * mutated in memory, then written back. Deletes use `rm -f` (no-op if
 * the file is already gone). Writes overwrite unconditionally.
 *
 * Returns silently on error per individual op so one bad mutation
 * doesn't block the rest. The caller logs failures via `console.error`
 * already at the step level.
 */
export async function flushPendingWrites(
  sandbox: Sandbox,
  pending: PendingWrites,
): Promise<void> {
  for (const op of pending.ops) {
    const abs = `${SYSTEM_SANDBOX_ROOT}/${op.path}`
    try {
      if (op.kind === "delete") {
        await sandbox.runCommand({
          cmd: "sh",
          args: ["-ec", `rm -f ${shellEscape(abs)}`],
        })
        continue
      }

      if (op.kind === "write") {
        await sandbox.writeFiles([
          { path: abs, content: Buffer.from(op.content, "utf8") },
        ])
        continue
      }

      if (op.kind === "append") {
        // Read-modify-write. Two simultaneous appends to the same
        // path within one event are queued in order, so the second
        // one sees the first one's bytes from the just-written file
        // (we re-read on each iteration). Append-on-missing creates
        // the file.
        const prev = await sandbox
          .readFileToBuffer({ path: abs })
          .catch(() => null)
        const next = (prev?.toString("utf8") ?? "") + op.content
        await sandbox.writeFiles([
          { path: abs, content: Buffer.from(next, "utf8") },
        ])
        continue
      }

      // edit
      const buf = await sandbox.readFileToBuffer({ path: abs }).catch(() => null)
      if (!buf) {
        // Edit-on-missing — skip silently. The model already received
        // an error from the tool; flushing it would create a dangling
        // empty file.
        continue
      }
      const before = buf.toString("utf8")
      const after = op.replaceAll
        ? before.split(op.oldString).join(op.newString)
        : before.replace(op.oldString, op.newString)
      // Skip no-op edits to avoid touching mtimes for unchanged files.
      if (after === before) continue
      await sandbox.writeFiles([
        { path: abs, content: Buffer.from(after, "utf8") },
      ])
    } catch (err) {
      console.error(
        "[v0] flushPendingWrites: op failed",
        op.kind,
        op.path,
        err,
      )
    }
  }
}

/**
 * Single-quote a path for embedding in a `sh -c` script. We only ever
 * use this for absolute paths under SYSTEM_SANDBOX_ROOT, but defending
 * against unexpected single quotes keeps the code reviewable.
 */
function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`
}
