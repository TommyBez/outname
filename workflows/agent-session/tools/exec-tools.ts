import { z } from "zod"
import { getExecSandbox } from "@/lib/agent-sandbox"
import { EXEC_SANDBOX_WORKSPACE } from "@/lib/agent-sandbox-registry"

/**
 * Exec tools — surface the agent's *exec* sandbox to the LLM.
 *
 * The exec sandbox is a separate, longer-timeout Vercel Sandbox that
 * the agent can shell into for general-purpose work: running scripts,
 * reading/writing arbitrary files, hitting network APIs, etc. Files
 * persist across events through snapshot-on-stop, so a heartbeat run
 * can pick up artifacts a chat turn left behind.
 *
 * All paths are interpreted relative to the persistent workspace
 * directory (`/vercel/sandbox/workspace`). Absolute paths under that
 * prefix are accepted as-is so the agent can copy paths it sees in
 * shell output without re-rooting them.
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

const MAX_OUTPUT_BYTES = 64 * 1024 // 64 KiB stdout/stderr per call
const MAX_FILE_BYTES = 256 * 1024 // 256 KiB file_read limit
const DEFAULT_TIMEOUT_MS = 30_000
const MAX_TIMEOUT_MS = 240_000 // upper-bounded by the exec sandbox timeout

export interface ExecToolsContext {
  agentId: string
}

export function createExecTools(ctx: ExecToolsContext) {
  const { agentId } = ctx

  return {
    bash: {
      description:
        "Run a shell command inside the agent's persistent exec sandbox, rooted at /vercel/sandbox/workspace. Returns { exitCode, stdout, stderr } truncated to 64 KiB each. Use for builds, scripts, API calls, anything that needs a shell.",
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
        return await bashStep(agentId, command, timeoutMs ?? DEFAULT_TIMEOUT_MS)
      },
    },

    file_read: {
      description:
        "Read a UTF-8 text file from the exec sandbox workspace. Returns content truncated to 256 KiB.",
      inputSchema: z.object({
        path: z.string().describe("Workspace-relative or absolute path."),
      }),
      execute: async ({ path }) => {
        return await fileReadStep(agentId, path)
      },
    },

    file_write: {
      description:
        "Create or overwrite a UTF-8 text file in the exec sandbox workspace. Parent directories are created automatically. The write is immediate (not buffered).",
      inputSchema: z.object({
        path: z.string(),
        content: z.string().describe("Full UTF-8 content of the file."),
      }),
      execute: async ({ path, content }) => {
        return await fileWriteStep(agentId, path, content)
      },
    },

    file_list: {
      description:
        "List files under a directory in the exec sandbox workspace. Returns paths relative to the workspace root.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe(
            "Workspace-relative directory. Defaults to the workspace root.",
          ),
      }),
      execute: async ({ path }) => {
        return await fileListStep(agentId, path ?? "")
      },
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Path helpers                                                                */
/* -------------------------------------------------------------------------- */

function resolveWorkspacePath(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("path must be a non-empty string")
  }
  // Reject NUL chars and obvious traversal early. We allow `..` only
  // if the resolved path stays under the workspace prefix — checked
  // below by string prefix.
  if (input.includes("\0")) {
    throw new Error("path may not contain NUL bytes")
  }
  const abs = input.startsWith("/")
    ? input
    : `${EXEC_SANDBOX_WORKSPACE}/${input}`
  // Lightweight normalization: collapse repeated slashes; reject
  // segments that walk above the workspace root.
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

function truncate(s: string, maxBytes: number): { value: string; truncated: boolean } {
  // Cheap byte-length proxy: most agent output is ASCII-dominant. For
  // mixed UTF-8 we slightly over-truncate, which is fine for safety.
  if (s.length <= maxBytes) return { value: s, truncated: false }
  return { value: s.slice(0, maxBytes), truncated: true }
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

interface BashResult {
  exitCode: number | null
  stdout: string
  stderr: string
  stdoutTruncated: boolean
  stderrTruncated: boolean
  timeoutMsRequested: number
}

async function bashStep(
  agentId: string,
  command: string,
  timeoutMs: number,
): Promise<BashResult> {
  "use step"
  const sandbox = await getExecSandbox(agentId)
  // Sandbox SDK's runCommand inherits the sandbox-level timeout we
  // configured at create time. We surface `timeoutMs` back to the
  // model in the result so it can reason about its own budget, but we
  // don't pass it to the SDK because killing mid-process would
  // corrupt the captured streams.
  const proc = await sandbox.runCommand({
    cmd: "sh",
    args: ["-ec", `cd ${EXEC_SANDBOX_WORKSPACE} && ${command}`],
  })
  const [stdoutRaw, stderrRaw] = await Promise.all([
    proc.stdout(),
    proc.stderr(),
  ])
  const stdout = truncate(stdoutRaw, MAX_OUTPUT_BYTES)
  const stderr = truncate(stderrRaw, MAX_OUTPUT_BYTES)
  return {
    exitCode: proc.exitCode,
    stdout: stdout.value,
    stderr: stderr.value,
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
    timeoutMsRequested: timeoutMs,
  }
}

async function fileReadStep(
  agentId: string,
  rawPath: string,
): Promise<{ path: string; content: string; truncated: boolean }> {
  "use step"
  const path = resolveWorkspacePath(rawPath)
  const sandbox = await getExecSandbox(agentId)
  const buf = await sandbox
    .readFileToBuffer({ path })
    .catch(() => null)
  if (!buf) {
    throw new Error(`file_read: file not found: ${path}`)
  }
  const text = buf.toString("utf8")
  const { value, truncated } = truncate(text, MAX_FILE_BYTES)
  return { path, content: value, truncated }
}

async function fileWriteStep(
  agentId: string,
  rawPath: string,
  content: string,
): Promise<{ ok: true; path: string; bytes: number }> {
  "use step"
  const path = resolveWorkspacePath(rawPath)
  const sandbox = await getExecSandbox(agentId)
  // Ensure parent directory exists. Cheap and idempotent.
  const parent = path.slice(0, path.lastIndexOf("/"))
  if (parent && parent !== "") {
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-ec", `mkdir -p ${shellEscape(parent)}`],
    })
  }
  await sandbox.writeFiles([
    { path, content: Buffer.from(content, "utf8") },
  ])
  return { ok: true, path, bytes: content.length }
}

async function fileListStep(
  agentId: string,
  rawDir: string,
): Promise<{ path: string; entries: { path: string; type: "file" | "dir" }[] }> {
  "use step"
  const dir = rawDir === "" ? EXEC_SANDBOX_WORKSPACE : resolveWorkspacePath(rawDir)
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
