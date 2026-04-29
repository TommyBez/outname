import { tool } from "ai"
import { z } from "zod"
import { getExecSandbox, resetExecSandbox } from "@/lib/agent-sandbox"
import { EXEC_SANDBOX_WORKSPACE } from "@/lib/agent-sandbox-registry"
import { enqueueAppend, type PendingWrites } from "./pending-writes"

/**
 * Exec tools — surface the agent's *exec* sandbox to the LLM.
 *
 * The exec sandbox is a separate, longer-timeout Vercel Sandbox that
 * the agent can shell into for general-purpose work: running scripts,
 * reading/writing arbitrary files, hitting network APIs, etc. Files
 * persist across events through snapshot-on-stop, so a heartbeat run
 * can pick up artifacts a chat turn left behind.
 *
 * Surface: `bash`, `file_read`, `file_write`, `file_list`, `reset_exec`.
 * Every tool's `execute` callback delegates to a `"use step"` worker
 * (`bashStep`, `fileReadStep`, etc.) so the workflow bundle stays
 * free of Sandbox-instance closures.
 *
 * `bashStep` delegates to the third-party `bash-tool` package
 * (vercel-labs/bash-tool). To keep the workflow bundler happy we
 * never let a `bash-tool` kit, the wrapped sandbox, or the AI-SDK
 * tool objects it returns escape a `"use step"` boundary —
 * `createBashTool` is invoked inside `bashStep` itself, the relevant
 * tool's `execute` is destructured and called, and the kit is
 * discarded when the step body returns. The earlier integration
 * tripped a serde warning because `createExecTools` was async and
 * held the kit (and via it, a Sandbox handle) in a workflow-body
 * closure across tool invocations.
 *
 * `file_read`, `file_write`, and `file_list` are kept hand-rolled —
 * they need richer return shapes (truncation flags, byte counts,
 * directory listings) than `bash-tool` exposes.
 *
 * Why these tools are *not* buffered like memory tools:
 *   - Bash output is the agent's primary feedback signal; buffering
 *     would hide errors until end-of-event.
 *   - The exec sandbox has no `agent_files` mirror, so there's nothing
 *     to atomicity-protect at the turn boundary.
 *
 * Per-call sizing limits keep the response payload safe to feed back
 * into the model without blowing the context window.
 */

/** Hard cap on stdout / stderr each, in bytes. */
const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KiB
/** Default per-command timeout. */
const DEFAULT_TIMEOUT_MS = 60_000
/** Hard ceiling regardless of what the model asks for. */
const MAX_TIMEOUT_MS = 5 * 60_000
/** Hard cap on `file_read` and `file_write` payloads, in bytes. */
const MAX_FILE_BYTES = 256 * 1024 // 256 KiB

export interface ExecToolsContext {
  agentId: string
  /**
   * Per-event mutation buffer shared with the memory tools. Bash and
   * `reset_exec` calls enqueue a one-line append into
   * `logs/<UTC date>.md` here; `endOfEvent` flushes the queue to the
   * system sandbox in a single round-trip.
   */
  pending: PendingWrites
}

export function createExecTools(ctx: ExecToolsContext) {
  const { agentId, pending } = ctx

  return {
    bash: tool({
      description:
        "Run a shell command inside the agent's persistent exec sandbox, rooted at /vercel/sandbox/workspace. Returns { exitCode, stdout, stderr } truncated to 64 KiB each. Every bash call is automatically appended to logs/<UTC date>.md in your memory volume — you can grep your own command history with search_memory. Use for builds, scripts, API calls, anything that needs a shell.",
      inputSchema: z.object({
        command: z.string().min(1).describe("Single-string shell command."),
        timeoutMs: z
          .number()
          .int()
          .min(1_000)
          .max(MAX_TIMEOUT_MS)
          .optional()
          .describe(
            `Per-command timeout in ms. Defaults to ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS}.`,
          ),
      }),
      execute: async ({ command, timeoutMs }) => {
        const result = await bashStep(
          agentId,
          command,
          timeoutMs ?? DEFAULT_TIMEOUT_MS,
        )
        // Audit log: append a single line per bash call into a daily
        // log file under the memory volume. ISO timestamp + exit code
        // + truncated command. The append is buffered through the
        // pending queue and flushes at end of event.
        const day = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
        const auditCommand =
          command.length > 240 ? `${command.slice(0, 240)}…` : command
        const line = [
          new Date().toISOString(),
          `exit=${result.exitCode ?? "null"}`,
          auditCommand.replace(/\r?\n/g, " "),
        ].join(" ")
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),

    file_read: tool({
      description:
        "Read a UTF-8 file from the exec sandbox workspace. Returns up to 256 KiB; longer files are truncated with `truncated: true`. Use for inspecting build output, generated files, etc.",
      inputSchema: z.object({
        path: z.string().describe("Workspace-relative path."),
      }),
      execute: async ({ path }) => fileReadStep(agentId, path),
    }),

    file_write: tool({
      description:
        "Write a UTF-8 file in the exec sandbox workspace. Overwrites existing content. Up to 256 KiB per call.",
      inputSchema: z.object({
        path: z.string().describe("Workspace-relative path."),
        content: z
          .string()
          .max(MAX_FILE_BYTES)
          .describe("UTF-8 content. Max 256 KiB."),
      }),
      execute: async ({ path, content }) =>
        fileWriteStep(agentId, path, content),
    }),

    file_list: tool({
      description:
        "List files under a directory in the exec sandbox workspace. Returns paths relative to the workspace root, tagged 'file' or 'dir'. Faster than parsing `ls` output yourself.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe(
            "Workspace-relative directory. Defaults to the workspace root.",
          ),
      }),
      execute: async ({ path }) => fileListStep(agentId, path ?? ""),
    }),

    reset_exec: tool({
      description:
        "Destroy the exec sandbox (workspace AND snapshot) and re-provision a clean one. Use as a last resort when the workspace is wedged — broken installs, leftover daemons, half-cloned repos, etc. Memory files in your system sandbox are NOT affected. Returns once the new sandbox is ready.",
      inputSchema: z.object({
        reason: z
          .string()
          .min(1)
          .max(500)
          .describe(
            "One-sentence justification for the reset. Logged for the user; helps you avoid re-resetting on the next turn for the same root cause.",
          ),
      }),
      execute: async ({ reason }) => {
        const result = await resetExecSandbox({ agentId })
        // Audit the reset into the same daily log the bash tool
        // writes to, so the model can grep its own reset history
        // alongside the commands it ran. We tag the line with
        // 'reset_exec' instead of 'exit=N' so a quick grep
        // separates the two surfaces.
        const day = new Date().toISOString().slice(0, 10)
        const auditReason =
          reason.length > 240 ? `${reason.slice(0, 240)}…` : reason
        const line = [
          new Date().toISOString(),
          `reset_exec destroyed=${result.destroyed}`,
          auditReason.replace(/\r?\n/g, " "),
        ].join(" ")
        enqueueAppend(pending, `logs/${day}.md`, `${line}\n`)
        return result
      },
    }),
  }
}

/* -------------------------------------------------------------------------- */
/* Path helpers                                                                */
/* -------------------------------------------------------------------------- */

function resolveWorkspacePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("path must be a non-empty string")
  }
  if (input.includes("\0")) {
    throw new Error("path may not contain NUL bytes")
  }
  const abs = input.startsWith("/")
    ? input
    : `${EXEC_SANDBOX_WORKSPACE}/${input}`
  const normalized = normalizePath(abs)
  if (
    normalized !== EXEC_SANDBOX_WORKSPACE &&
    !normalized.startsWith(`${EXEC_SANDBOX_WORKSPACE}/`)
  ) {
    throw new Error(
      `path must stay under ${EXEC_SANDBOX_WORKSPACE} (got ${normalized})`,
    )
  }
  return normalized
}

function normalizePath(p: string): string {
  const out: string[] = []
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue
    if (seg === "..") {
      out.pop()
      continue
    }
    out.push(seg)
  }
  return "/" + out.join("/")
}

function truncateUtf8(s: string, maxBytes: number): { value: string; truncated: boolean } {
  // Cheap byte estimate via Buffer.byteLength would require pulling in
  // a Node dep. The agent only needs an upper-bound truncation
  // signal, so we approximate: 1 char ≈ 1 byte for ASCII,
  // up to 4 bytes for emoji. Worst-case slice on chars => ~maxBytes
  // bytes. For our 64 KiB cap this is more than sufficient.
  if (s.length <= maxBytes) return { value: s, truncated: false }
  return { value: s.slice(0, maxBytes), truncated: true }
}

/* -------------------------------------------------------------------------- */
/* Steps — all top-level Node / @vercel/sandbox imports happen inside these   */
/* "use step" function bodies, which the workflow bundler lifts into a        */
/* separate worker bundle. The workflow body itself stays free of those       */
/* imports.                                                                    */
/* -------------------------------------------------------------------------- */

interface BashResult {
  exitCode: number | null
  stdout: string
  stdoutTruncated: boolean
  stderr: string
  stderrTruncated: boolean
}

async function bashStep(
  agentId: string,
  command: string,
  timeoutMs: number,
): Promise<BashResult> {
  "use step"
  const sandbox = await getExecSandbox(agentId)

  // Build the kit *inside* the step. The wrapped sandbox handle and
  // the AI-SDK tool objects bash-tool returns all live in this
  // function's local scope; nothing escapes back to the workflow
  // body. This is the constraint the workflow bundler cares about —
  // the previous integration tripped a serde warning because the kit
  // (and via it, a Sandbox handle) was held in a workflow-side
  // closure across tool invocations.
  //
  // `onBeforeBashCall` lets us prepend our `timeout` wrapper to every
  // command without losing bash-tool's `cd "${cwd}" && ...` prefix
  // (the modified command is concatenated after the cd). The hard
  // ceiling means a runaway script can't hold the sandbox open past
  // `MAX_TIMEOUT_MS`.
  const timeoutSeconds = Math.max(1, Math.floor(timeoutMs / 1000))
  const kit = await createBashTool({
    sandbox,
    destination: EXEC_SANDBOX_WORKSPACE,
    maxOutputLength: MAX_OUTPUT_BYTES,
    onBeforeBashCall: ({ command: original }) => ({
      command: `timeout --foreground ${timeoutSeconds}s bash -lc ${shellEscape(original)}`,
    }),
  })

  // Destructure the bash tool's `execute` and call it directly. The
  // toolkit's bash execute doesn't read the AI-SDK options arg — it
  // only uses the input — so we pass an inert stub. The cast keeps
  // the type fudge confined to one line; the call itself is safe.
  const execute = kit.tools.bash.execute
  if (!execute) {
    throw new Error("bash-tool returned a tool without an execute callback")
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (await execute({ command }, {} as any)) as {
    stdout: string
    stderr: string
    exitCode: number | null
  }

  // bash-tool inlines a "[stdout truncated: N characters removed]"
  // marker into the string itself instead of returning a flag. We
  // sniff that marker so the workflow surface keeps its boolean-flag
  // contract — the model can branch on `stdoutTruncated` without
  // parsing the message.
  return {
    exitCode: raw.exitCode,
    stdout: raw.stdout,
    stdoutTruncated: /\[stdout truncated:/.test(raw.stdout),
    stderr: raw.stderr,
    stderrTruncated: /\[stderr truncated:/.test(raw.stderr),
  }
}

interface FileReadResult {
  path: string
  content: string
  truncated: boolean
}

async function fileReadStep(
  agentId: string,
  rawPath: string,
): Promise<FileReadResult> {
  "use step"
  const path = resolveWorkspacePath(rawPath)
  const sandbox = await getExecSandbox(agentId)
  const buf = await sandbox.readFileToBuffer({ path })
  if (!buf) {
    // `readFileToBuffer` returns null when the file is missing.
    // Surface a structured error so the model can branch on it.
    throw new Error(`file_read: file not found: ${path}`)
  }
  const text = buf.toString("utf8")
  const out = truncateUtf8(text, MAX_FILE_BYTES)
  return { path, content: out.value, truncated: out.truncated }
}

interface FileWriteResult {
  path: string
  bytesWritten: number
}

async function fileWriteStep(
  agentId: string,
  rawPath: string,
  content: string,
): Promise<FileWriteResult> {
  "use step"
  const path = resolveWorkspacePath(rawPath)
  const sandbox = await getExecSandbox(agentId)
  const buf = Buffer.from(content, "utf8")
  // Make sure the parent directory exists. Without -p, writeFiles
  // fails if the parent isn't created yet.
  const parent = path.slice(0, path.lastIndexOf("/"))
  if (parent && parent !== EXEC_SANDBOX_WORKSPACE) {
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-ec", `mkdir -p ${shellEscape(parent)}`],
    })
  }
  await sandbox.writeFiles([{ path, content: buf }])
  return { path, bytesWritten: buf.byteLength }
}

async function fileListStep(
  agentId: string,
  rawDir: string,
): Promise<{ path: string; entries: { path: string; type: "file" | "dir" }[] }> {
  "use step"
  const dir =
    rawDir === "" ? EXEC_SANDBOX_WORKSPACE : resolveWorkspacePath(rawDir)
  const sandbox = await getExecSandbox(agentId)
  // `find` with -mindepth 1 -maxdepth 1 lists immediate children only.
  // We tag each entry with its type via printf so the model gets a
  // structured response without us shelling out twice.
  const list = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-ec",
      `cd ${shellEscape(dir)} && find . -mindepth 1 -maxdepth 1 \\( -type f -printf '%P\\tfile\\n' \\) -o \\( -type d -printf '%P\\tdir\\n' \\) 2>/dev/null || true`,
    ],
  })
  const stdout = await list.stdout()
  const entries = stdout
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, type] = line.split("\t")
      return {
        path: name ?? "",
        type: (type === "dir" ? "dir" : "file") as "file" | "dir",
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path))
  return { path: dir, entries }
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'"'"'`)}'`
}
